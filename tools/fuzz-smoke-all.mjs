#!/usr/bin/env node
/**
 * tools/fuzz-smoke-all.mjs
 *
 * Runs EVERY fuzz smoke target concurrently on one machine, bounded to the CPU
 * count. This is the local equivalent of the CI `fuzz` matrix job — instead of
 * 12 serial ~60s runs (~12 min), all targets fan out at once and finish in
 * roughly one smoke's wall time (~60–75s on a many-core box).
 *
 * Each target is launched as `node tools/fuzz.mjs <target> --smoke` (which in
 * turn spawns jazzer/libFuzzer). jazzer is single-threaded per process, so one
 * target ≈ one core; with N targets and ≥N cores the default concurrency runs
 * them all simultaneously.
 *
 * Usage:
 *   npm run fuzz:smoke                       # all targets, concurrency = min(targets, cpus)
 *   node tools/fuzz-smoke-all.mjs --concurrency 8
 *   node tools/fuzz-smoke-all.mjs --targets sfo,pfd,readsave
 *   node tools/fuzz-smoke-all.mjs --stream   # live [target] prefixed output
 *   node tools/fuzz-smoke-all.mjs --no-corpus
 *
 * Output (default): a `[PASS|FAIL] target (Xs)` line per target as it finishes;
 * each target's full jazzer output is written to fuzz/logs/<target>.log; a
 * failing target's last lines are printed inline; a final N/M summary follows.
 * Exit code is non-zero if any target failed (so it gates `npm run`).
 *
 * @ts-check
 */
import { spawn, spawnSync } from 'node:child_process';
import os from 'node:os';
import { createWriteStream, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TARGETS, SMOKE_TOTAL_TIME } from './fuzz.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const LOG_DIR = path.join(REPO_ROOT, 'fuzz', 'logs');

/* ------------------------------------------------------------------ */
/* Args                                                                */
/* ------------------------------------------------------------------ */
const argv = process.argv.slice(2);
const flag = (/** @type {string} */ name) => argv.includes(name);
const val = (/** @type {string} */ name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};

if (flag('--help') || flag('-h')) {
  process.stdout.write(
    [
      'Usage: node tools/fuzz-smoke-all.mjs [options]',
      '',
      'Options:',
      '  --concurrency N   Max targets run at once (default: min(#targets, #cores)).',
      '  --targets a,b,c   Comma-separated subset of targets to run.',
      '  --stream          Live [target]-prefixed console output (default: buffered).',
      '  --no-corpus       Do not auto-generate fuzz/corpus if missing.',
      '  -h, --help        Show this help.',
      '',
      `Available targets: ${Object.keys(TARGETS).join(', ')}`,
      '',
    ].join('\n') + '\n',
  );
  process.exit(0);
}

const allTargets = Object.keys(TARGETS);

let targets = allTargets;
const targetsArg = val('--targets');
if (targetsArg) {
  const req = targetsArg
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const bad = req.filter((t) => !allTargets.includes(t));
  if (bad.length) {
    console.error(`Unknown target(s): ${bad.join(', ')}`);
    console.error(`Available: ${allTargets.join(', ')}`);
    process.exit(2);
  }
  targets = req;
}

const cores = os.cpus().length;
const concurrencyArg = val('--concurrency');
let concurrency;
if (concurrencyArg !== undefined) {
  concurrency = Number.parseInt(concurrencyArg, 10);
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    console.error('--concurrency must be a positive integer');
    process.exit(2);
  }
} else {
  concurrency = Math.min(targets.length, cores);
}

const stream = flag('--stream');
const noCorpus = flag('--no-corpus');

/* ------------------------------------------------------------------ */
/* Color (TTY only)                                                    */
/* ------------------------------------------------------------------ */
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const wrap = (/** @type {string} */ code) => (/** @type {string} */ s) =>
  useColor ? `\x1b[${code}m${s}\x1b[0m` : s;
const green = wrap('32');
const red = wrap('31');
const dim = wrap('2');
const bold = wrap('1');

/* ------------------------------------------------------------------ */
/* Corpus pre-step                                                     */
/* ------------------------------------------------------------------ */
const corpusDir = path.join(REPO_ROOT, 'fuzz', 'corpus');
if (!noCorpus && !existsSync(corpusDir)) {
  console.log(dim('fuzz/corpus not found — generating (node tools/gen-fuzz-corpus.mjs)…'));
  const gen = spawnSync(process.execPath, ['tools/gen-fuzz-corpus.mjs'], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
  });
  if (gen.status !== 0) {
    console.error(red('Corpus generation failed; aborting.'));
    process.exit(1);
  }
  console.log();
}

/* ------------------------------------------------------------------ */
/* Runner                                                              */
/* ------------------------------------------------------------------ */
mkdirSync(LOG_DIR, { recursive: true });

/**
 * @typedef {Object} TargetResult
 * @property {string} target
 * @property {boolean} ok
 * @property {number|null} code
 * @property {string|null} reason
 * @property {number} elapsedMs
 * @property {string[]} tailLines
 */

/**
 * Run one target's smoke to completion, capturing output to fuzz/logs/<t>.log.
 *
 * @param {string} target
 * @param {boolean} streamLive  if true, mirror each line to the console prefixed
 * @returns {Promise<TargetResult>}
 */
function runOne(target, streamLive) {
  return new Promise((resolve) => {
    const start = Date.now();
    const log = createWriteStream(path.join(LOG_DIR, `${target}.log`));
    /** @type {string[]} */ const tailLines = [];
    const TAIL_MAX = 60;
    let pending = '';

    const onChunk = (/** @type {Buffer | string} */ chunk) => {
      log.write(chunk);
      pending += chunk.toString();
      let nl;
      while ((nl = pending.indexOf('\n')) >= 0) {
        const line = pending.slice(0, nl);
        pending = pending.slice(nl + 1);
        if (tailLines.length >= TAIL_MAX) tailLines.shift();
        tailLines.push(line);
        if (streamLive) process.stdout.write(`${dim(`[${target}]`)} ${line}\n`);
      }
    };

    // libFuzzer requires the -artifact_prefix dir to exist (it does not create
    // it), so make the per-target crash dir before launching.
    mkdirSync(path.join(REPO_ROOT, 'fuzz', 'crashes', target), { recursive: true });

    const child = spawn(process.execPath, ['tools/fuzz.mjs', target, '--smoke'], {
      cwd: REPO_ROOT,
      env: { ...process.env, FUZZ_ARTIFACT_PREFIX: `fuzz/crashes/${target}/` },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', onChunk);
    child.stderr.on('data', onChunk);

    let settled = false;
    /** @param {boolean} ok @param {number|null} code @param {string|null} reason */
    const finish = (ok, code, reason) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (pending) {
        if (tailLines.length >= TAIL_MAX) tailLines.shift();
        tailLines.push(pending);
        pending = '';
      }
      log.end();
      resolve({ target, ok, code, reason, elapsedMs: Date.now() - start, tailLines });
    };

    // Safety net: jazzer self-terminates at max_total_time=60; kill a child that
    // somehow outlives 2x that + grace so one stuck target can't hang the run.
    const timer = setTimeout(
      () => {
        try {
          child.kill('SIGKILL');
        } catch {
          /* already gone */
        }
        finish(false, null, `outer timeout (>${SMOKE_TOTAL_TIME * 2 + 30}s)`);
      },
      (SMOKE_TOTAL_TIME * 2 + 30) * 1000,
    );

    child.on('error', (err) => finish(false, null, `spawn error: ${err.message}`));
    child.on('exit', (code, sig) => {
      if (sig) finish(false, null, `signal ${sig}`);
      else finish(code === 0, code, code === 0 ? null : `exit ${code}`);
    });
  });
}

/**
 * @param {TargetResult} r
 */
function printResult(r) {
  const sec = `${(r.elapsedMs / 1000).toFixed(1)}s`;
  const label = r.target.padEnd(Math.max(...targets.map((t) => t.length)));
  if (r.ok) {
    console.log(`  ${green('PASS')}  ${label}  ${dim(sec)}`);
  } else {
    console.log(`  ${red('FAIL')}  ${label}  ${dim(sec)}  ${red(r.reason || 'failed')}`);
    const shown = r.tailLines.slice(-25);
    if (shown.length) {
      console.log(dim(`       last ${shown.length} line(s) — fuzz/logs/${r.target}.log:`));
      for (const line of shown) console.log(dim(`       ${line}`));
    }
  }
}

/**
 * Concurrency-bounded worker pool.
 * @returns {Promise<TargetResult[]>}
 */
async function runPool() {
  const queue = [...targets];
  /** @type {TargetResult[]} */ const results = [];
  const workerCount = Math.min(concurrency, queue.length);
  const worker = async () => {
    while (queue.length) {
      const t = /** @type {string} */ (queue.shift());
      const r = await runOne(t, stream);
      printResult(r);
      results.push(r);
    }
  };
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */
console.log(
  `${bold('fuzz:smoke')} — ${targets.length} target(s), concurrency ${concurrency} (detected ${cores} core${cores === 1 ? '' : 's'})`,
);
console.log(dim(`  targets: ${targets.join(', ')}`));
console.log(dim(`  logs:    fuzz/logs/<target>.log`));
console.log();

const wallStart = Date.now();
const results = await runPool();
const wall = Date.now() - wallStart;

const passed = results.filter((r) => r.ok).length;
const failedCount = results.length - passed;
const summary = failedCount
  ? red(`${passed}/${results.length} targets passed`)
  : green(`${passed}/${results.length} targets passed`);
console.log();
console.log(`${bold('Summary:')} ${summary} ${dim(`(wall ${(wall / 1000).toFixed(1)}s)`)}`);
if (failedCount) {
  for (const r of results.filter((x) => !x.ok)) {
    console.log(red(`  - ${r.target}: ${r.reason || 'failed'}`));
  }
}
process.exit(failedCount ? 1 : 0);
