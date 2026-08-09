#!/usr/bin/env node
/**
 * tools/fuzz-branches.mjs
 *
 * Reads the per-branch detail emitted by `npm run fuzz:cov` (the c8 `json`
 * reporter → coverage/fuzz/coverage-final.json) and prints, for every js/
 * logic file, the source lines whose branch arcs were never taken during the
 * seed-corpus replay. Use this to triage fuzz branch-coverage gaps:
 *
 *   - lines that stay uncovered after adding a seed are likely unreachable
 *     API-validation guards (Jest-owned) or c8/V8 short-circuit artifacts;
 *   - lines that flip to covered confirm a new seed/oracle reached them.
 *
 * Run after `npm run fuzz:cov`:
 *   npm run fuzz:branches
 *
 * @ts-check
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPORT = path.resolve(__dirname, '..', 'coverage', 'fuzz', 'coverage-final.json');

let cov;
try {
  cov = JSON.parse(readFileSync(REPORT, 'utf8'));
} catch {
  console.error(`No coverage found at ${REPORT}.`);
  console.error('Run `npm run fuzz:cov` first (it emits the json reporter).');
  process.exit(1);
}

const cwd = process.cwd() + '/';
const rows = [];
let totalArcs = 0;
let coveredArcs = 0;

for (const [abs, d] of Object.entries(cov)) {
  if (!d.b || !d.branchMap) continue;
  const f = abs.replace(cwd, '');
  // Map: line → Set of "type(arc/total)" labels for uncovered arcs on it.
  const byLine = new Map();
  for (const [id, counts] of Object.entries(d.b)) {
    const bm = d.branchMap[id];
    if (!bm) continue;
    counts.forEach((c, i) => {
      totalArcs++;
      if (c > 0) coveredArcs++;
      if (c === 0) {
        const loc = (bm.locations && bm.locations[i]) || bm.loc;
        const line = loc.start.line;
        if (!byLine.has(line)) byLine.set(line, new Set());
        byLine.get(line).add(`${bm.type}(${i}/${counts.length})`);
      }
    });
  }
  if (byLine.size) rows.push({ f, byLine });
}

rows.sort((a, b) => b.byLine.size - a.byLine.size);

const pct = totalArcs ? ((coveredArcs / totalArcs) * 100).toFixed(2) : '0.00';
console.log(`Branch coverage: ${coveredArcs}/${totalArcs} arcs (${pct}%) — uncovered by file:\n`);
for (const r of rows) {
  console.log(`=== ${r.f}  (${r.byLine.size} uncov branch lines)`);
  const lines = [...r.byLine.keys()].sort((a, b) => a - b);
  for (const l of lines)
    console.log(`  L${String(l).padStart(4)}  ${[...r.byLine.get(l)].join(' ')}`);
  console.log();
}
