#!/usr/bin/env node
/**
 * build-frontend.mjs — Build the production frontend into dist/ for Tauri.
 *
 * Steps:
 *   1. Ensure runtime deps exist (@noble/*, fflate)
 *   2. Copy files to dist/ preserving the project structure:
 *      - index.html (with import map rewritten: ./node_modules/ → ./vendor/)
 *      - css/styles.css
 *      - All .js files under js/
 *      - @noble ESM files reachable from the import-map entries (traced)
 *      - 1 fflate file (esm/browser.js)
 *
 * NOTE: Tauri rejects dist/ folders containing a node_modules/ subdirectory,
 * so runtime dependency files are copied to dist/vendor/ instead, and the
 * import map in the copied index.html is rewritten to match.
 *
 * Output: dist/ directory ready for Tauri to embed.
 *
 * Usage:  node tools/build-frontend.mjs
 */

import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, posix, relative } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');

// Sync the app version (single source of truth: package.json) before copying js/.
execSync('node tools/gen-version.mjs', { cwd: ROOT, stdio: 'inherit' });

// ── Pre-flight: ensure runtime deps exist ─────────────────────────────────

const REQUIRED_PACKAGES = [
  { name: '@noble/ciphers', dir: 'node_modules/@noble/ciphers' },
  { name: '@noble/hashes', dir: 'node_modules/@noble/hashes' },
  { name: 'fflate', dir: 'node_modules/fflate' },
];

const missing = REQUIRED_PACKAGES.filter((p) => !existsSync(join(ROOT, p.dir)));
if (missing.length > 0) {
  const names = missing.map((m) => m.name).join(' ');
  console.log(`\n📦 Installing missing package(s): ${names}`);
  execSync(`npm install ${names} --omit=dev`, {
    stdio: 'inherit',
    cwd: ROOT,
  });
}

// ── Clean and recreate dist/ ──────────────────────────────────────────────

console.log('\n🧹 Cleaning dist/…');
rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

// ── Copy helpers ──────────────────────────────────────────────────────────

/**
 * Copy a file, creating parent directories as needed.
 * @param {string} src  absolute source path
 * @param {string} relDest  destination relative to DIST
 */
function copyFile(src, relDest) {
  const dest = join(DIST, relDest);
  const destDir = dirname(dest);
  mkdirSync(destDir, { recursive: true });
  cpSync(src, dest);
  const size = statSync(src).size;
  console.log(`   ${relDest}  (${(size / 1024).toFixed(1)} KB)`);
}

/**
 * Recursively copy all files matching a predicate.
 * @param {string} srcDir
 * @param {string} destDir
 * @param {(name: string) => boolean} predicate
 */
function copyDir(srcDir, destDir, predicate) {
  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = join(srcDir, entry.name);
    const destPath = join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath, predicate);
    } else if (predicate(entry.name)) {
      mkdirSync(destDir, { recursive: true });
      cpSync(srcPath, destPath);
      const size = statSync(srcPath).size;
      console.log(`   ${relative(DIST, destPath)}  (${(size / 1024).toFixed(1)} KB)`);
    }
  }
}

// ── Copy files ────────────────────────────────────────────────────────────

console.log('\n📁 Copying files to dist/…');

// 1. index.html — copy then rewrite import map paths
//    ./node_modules/ → ./vendor/ (Tauri rejects dist/ containing node_modules/)
const htmlSrc = readFileSync(join(ROOT, 'index.html'), 'utf-8');
const htmlDist = htmlSrc.replace(/\.\/node_modules\//g, './vendor/');
writeFileSync(join(DIST, 'index.html'), htmlDist);
console.log('   index.html  (import map rewritten: ./node_modules/ → ./vendor/)');

// 2. css/styles.css
copyFile(join(ROOT, 'css', 'styles.css'), 'css/styles.css');

// 3. All .js files under js/
copyDir(join(ROOT, 'js'), join(DIST, 'js'), (name) => name.endsWith('.js'));

// 4. Runtime ESM deps → dist/vendor/ (NOT node_modules/ — Tauri rejects that).
//    The @noble files are copied by TRACING the import graph from the entry
//    points the app actually imports (per the index.html import map), not from
//    a hand-maintained list. A @noble minor/patch bump that adds a new internal
//    module is picked up automatically — a missing transitive dep previously
//    shipped a release that showed a blank window (e.g. @noble/hashes 2.3 added
//    _u64.js, imported by _md.js, which the old hardcoded list missed).

/** @type {Set<string>} vendor-relative paths copied, POSIX ("@noble/hashes/_u64.js") */
const vendorFiles = new Set();

/**
 * Collect every file reachable from `entry` via relative import/export
 * specifiers ("./", "../"). @noble keeps its internals as sibling files, so
 * this captures the full subgraph. JSDoc example imports are skipped (they live
 * on "*" / "//" lines, not real import/export statements).
 * @param {string} entry  node_modules-relative path, e.g. "@noble/hashes/legacy.js"
 * @returns {Set<string>}
 */
function traceGraph(entry) {
  const seen = new Set();
  const queue = [entry];
  while (queue.length > 0) {
    const rel = /** @type {string} */ (queue.shift());
    if (seen.has(rel)) continue;
    seen.add(rel);
    const abs = join(ROOT, 'node_modules', rel);
    if (!existsSync(abs)) {
      throw new Error(`vendor trace: node_modules/${rel} is imported by the graph but not found`);
    }
    const dir = rel.slice(0, rel.lastIndexOf('/') + 1);
    const content = readFileSync(abs, 'utf-8');
    for (const line of content.split(/\r?\n/)) {
      if (!/^\s*(?:import|export)\b/.test(line)) continue; // skip comments/other lines
      for (const m of line.matchAll(/["'](\.{1,2}\/[^"']+)["']/g)) {
        const target = posix.normalize(posix.join(dir, m[1]));
        if (!seen.has(target)) queue.push(target);
      }
    }
  }
  return seen;
}

const NOBLE_ENTRIES = [
  '@noble/ciphers/aes.js', // import map entry
  '@noble/hashes/hmac.js', // import map entry
  '@noble/hashes/legacy.js', // import map entry
];
for (const entry of NOBLE_ENTRIES) {
  for (const rel of traceGraph(entry)) {
    copyFile(join(ROOT, 'node_modules', rel), join('vendor', rel));
    vendorFiles.add(rel);
  }
}

// 5. fflate browser ESM build (self-contained bundle — no sub-imports)
const fflateRel = 'fflate/esm/browser.js';
if (existsSync(join(ROOT, 'node_modules', fflateRel))) {
  copyFile(join(ROOT, 'node_modules', fflateRel), join('vendor', fflateRel));
  vendorFiles.add(fflateRel);
}

// 6. Verify the vendor import graph is complete: every relative import in a
//    copied vendor file must resolve to another copied vendor file. A gap here
//    would 404 at runtime and blank the window, so fail the build loudly.
{
  const broken = [];
  for (const rel of vendorFiles) {
    const dir = rel.slice(0, rel.lastIndexOf('/') + 1);
    const content = readFileSync(join(DIST, 'vendor', rel), 'utf-8');
    for (const line of content.split(/\r?\n/)) {
      if (!/^\s*(?:import|export)\b/.test(line)) continue;
      for (const m of line.matchAll(/["'](\.{1,2}\/[^"']+)["']/g)) {
        const target = posix.normalize(posix.join(dir, m[1]));
        if (!vendorFiles.has(target)) {
          broken.push(`${rel} imports "${m[1]}" -> ${target} (not in dist/vendor/)`);
        }
      }
    }
  }
  if (broken.length > 0) {
    throw new Error(
      'dist/vendor/ import graph is incomplete — these imports have no copied target:\n  - ' +
        broken.join('\n  - '),
    );
  }
  console.log(`   ✓ vendor import graph complete (${vendorFiles.size} files)`);
}

// ── Summary ───────────────────────────────────────────────────────────────

const fileCount = readdirSync(DIST, { recursive: true }).filter((p) =>
  statSync(join(DIST, String(p)), { throwIfNoEntry: false })?.isFile(),
).length;

console.log(`\n✅ Built ${fileCount} files into dist/`);
console.log(`   Ready for: npm run tauri:build`);
