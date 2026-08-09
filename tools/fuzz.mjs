#!/usr/bin/env node
/**
 * tools/fuzz.mjs
 *
 * Thin wrapper that builds the Jazzer.js (libFuzzer) command line for each fuzz
 * target, so the per-target tuning (sync mode, max_len, timeout) and the
 * shared flags (artifact_prefix, smoke time budget) live in one place instead
 * of being copy-pasted across 24 `fuzz:<t>` / `fuzz:<t>:smoke` npm scripts.
 *
 * Usage (via npm scripts):
 *   node tools/fuzz.mjs <target>            # open-ended run (local)
 *   node tools/fuzz.mjs <target> --smoke    # 60s bounded run (CI mode)
 *   node tools/fuzz.mjs <target> --dry-run  # print the jazzer argv, don't run
 *
 * The wrapper spawns `jazzer`, prepending `node_modules/.bin` to the child PATH
 * so the bin resolves whether the wrapper is launched via `npm run` (which
 * already adds it) or invoked directly (`node tools/fuzz.mjs ...`).
 *
 * @ts-check
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

/**
 * Per-target Jazzer/libFuzzer tuning.
 *
 * `timeout` is libFuzzer's per-input hang limit, NOT the session length
 * (that's `-max_total_time`, added only by `--smoke`). Values are sized from
 * the measured per-input ceiling: every target's slowest single input is
 * <1s even at `max_len` (verified against the seed corpora, which for the
 * folder-wrapping targets already contain 256KB inputs). The fast parse/cipher
 * targets and `pipeline` keep a 10-15s hang-detector floor; the heavy
 * crypto-write trio (savefolder/encexport/saveapi, ~12-63ms per input) gets
 * 15-20s — roughly 5x their measured worst case, with headroom for CI machines
 * being slower than a dev box.
 * @typedef {Object} FuzzTarget
 * @property {boolean} sync    pass `--sync` (only for synchronous oracles)
 * @property {number} maxLen   libFuzzer `-max_len`
 * @property {number} timeout  libFuzzer `-timeout` (seconds)
 */

/** @type {Record<string, FuzzTarget>} */
const TARGETS = {
  readsave: { sync: true, maxLen: 262144, timeout: 10 },
  pfd: { sync: true, maxLen: 65536, timeout: 10 },
  sfo: { sync: true, maxLen: 8192, timeout: 10 },
  roundtrip: { sync: true, maxLen: 262144, timeout: 10 },
  pipeline: { sync: false, maxLen: 262144, timeout: 15 },
  encexport: { sync: false, maxLen: 262144, timeout: 20 },
  saveapi: { sync: false, maxLen: 16, timeout: 20 },
  crypto: { sync: true, maxLen: 65536, timeout: 10 },
  pfdcreate: { sync: true, maxLen: 4096, timeout: 10 },
  pfdserialize: { sync: true, maxLen: 65536, timeout: 10 },
  savefolder: { sync: false, maxLen: 262144, timeout: 15 },
  sfofields: { sync: true, maxLen: 8192, timeout: 10 },
};

/** Smoke runs are bounded to 60s (CI mode). */
const SMOKE_TOTAL_TIME = 60;

const argv = process.argv.slice(2);
const target = argv.find((a) => !a.startsWith('-'));
const smoke = argv.includes('--smoke');
const dryRun = argv.includes('--dry-run');

if (!target) {
  console.error('Usage: node tools/fuzz.mjs <target> [--smoke] [--dry-run]');
  console.error(`Targets: ${Object.keys(TARGETS).join(', ')}`);
  process.exit(2);
}

/** @type {FuzzTarget | undefined} */
const cfg = TARGETS[target];
if (!cfg) {
  console.error(`Unknown fuzz target: ${target}`);
  console.error(`Available: ${Object.keys(TARGETS).join(', ')}`);
  process.exit(2);
}

/**
 * Build the jazzer argv. libFuzzer is order-insensitive, so flag grouping only
 * needs to read clearly; artifact_prefix is emitted last to mirror the former
 * scripts.
 * @returns {string[]}
 */
function buildArgs() {
  const args = [`fuzz/${target}.fuzz.js`, `fuzz/corpus/${target}`];
  if (cfg.sync) args.push('--sync');
  args.push('--', `-max_len=${cfg.maxLen}`, `-timeout=${cfg.timeout}`);
  if (smoke) args.push(`-max_total_time=${SMOKE_TOTAL_TIME}`);
  args.push('-artifact_prefix=fuzz/crashes/');
  return args;
}

const args = buildArgs();

if (dryRun) {
  process.stdout.write(`jazzer ${args.join(' ')}\n`);
  process.exit(0);
}

// Resolve `jazzer` from node_modules/.bin (prepended to PATH) so the wrapper
// works under `npm run` and when invoked directly. `shell:true` on Windows lets
// the `jazzer.cmd` shim resolve. Set both `PATH` and `Path` so the augmented
// value is authoritative on Windows (whose env var is cased `Path`).
const binDir = path.join(REPO_ROOT, 'node_modules', '.bin');
const augmentedPath = `${binDir}${path.delimiter}${process.env.PATH || ''}`;
const child = spawn('jazzer', args, {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, PATH: augmentedPath, Path: augmentedPath },
});
child.on('error', (err) => {
  console.error('Failed to spawn jazzer:', err.message);
  process.exit(1);
});
child.on('exit', (code) => process.exit(code ?? 1));
