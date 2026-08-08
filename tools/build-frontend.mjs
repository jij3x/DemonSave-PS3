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
 *      - 7 runtime @noble files (for import map)
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
import { dirname, join, relative } from 'node:path';
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

/** Recursively copy all files matching a predicate. */
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

// 4. @noble runtime files (7 files, traced from actual import chains)
//    Copied to dist/vendor/ (NOT node_modules/ — Tauri rejects that)
const nobleFiles = [
  ['@noble/ciphers', 'aes.js'],
  ['@noble/ciphers', '_polyval.js'],
  ['@noble/ciphers', 'utils.js'],
  ['@noble/hashes', 'hmac.js'],
  ['@noble/hashes', 'legacy.js'],
  ['@noble/hashes', '_md.js'],
  ['@noble/hashes', 'utils.js'],
];
for (const [pkg, file] of nobleFiles) {
  const src = join(ROOT, 'node_modules', pkg, file);
  if (existsSync(src)) {
    copyFile(src, join('vendor', pkg, file));
  }
}

// 5. fflate browser ESM build
const fflateSrc = join(ROOT, 'node_modules', 'fflate', 'esm', 'browser.js');
if (existsSync(fflateSrc)) {
  copyFile(fflateSrc, 'vendor/fflate/esm/browser.js');
}

// ── Summary ───────────────────────────────────────────────────────────────

const fileCount = readdirSync(DIST, { recursive: true }).filter((p) =>
  statSync(join(DIST, String(p)), { throwIfNoEntry: false })?.isFile(),
).length;

console.log(`\n✅ Built ${fileCount} files into dist/`);
console.log(`   Ready for: npm run tauri:build`);
