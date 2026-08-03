#!/usr/bin/env node
/**
 * pack-html-dist.mjs — Build a browser-ready ZIP distribution that works
 * on file:// (no web server required).
 *
 * Browsers block ES module imports on file:// URLs, so we can't use the
 * original source files with import/export. Instead, we use esbuild to
 * bundle all JS into a single IIFE file, then generate a modified
 * index.html that references it via a classic <script> tag.
 *
 * Output structure (preserves directory layout):
 *
 *   demonsave_ps3_html/
 *     index.html          ← modified: classic <script>, no import map
 *     css/styles.css      ← unchanged original
 *     js/app.bundle.js    ← all JS bundled (IIFE, works on file://)
 *
 * Output (in dist/):
 *   - demonsave_ps3_html.zip
 *   - demonsave_ps3_html.zip.sha256
 *
 * With --raw-only (alias --no-zip), no ZIP or .sha256 is produced;
 * instead the three files are written raw to:
 *   dist/demonsave_ps3_html/index.html
 *   dist/demonsave_ps3_html/css/styles.css
 *   dist/demonsave_ps3_html/js/app.bundle.js
 *
 * Usage:
 *   node tools/pack-html-dist.mjs               # builds .zip + .sha256
 *   node tools/pack-html-dist.mjs --raw-only    # raw files only (no zip)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

// ── Pre-flight: ensure runtime deps exist (install only missing ones) ────

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

// ── CLI flags ───────────────────────────────────────────────────────────

const RAW_ONLY = process.argv.slice(2).some((a) => a === '--raw-only' || a === '--no-zip');

// ── Step 1: Bundle main app into single IIFE script ──────────────────────

console.log('\n🔨 Bundling app into single-file IIFE (esbuild)…');
const DIST_DIR = join(ROOT, 'dist');
mkdirSync(DIST_DIR, { recursive: true });

const appOut = join(DIST_DIR, 'app.bundle.js');
const appEntry = join(ROOT, 'js', 'ui', 'app.js');

try {
  execSync(
    [
      'npx',
      'esbuild',
      `"${appEntry}"`,
      '--bundle',
      '--format=iife',
      `--outfile="${appOut}"`,
      '--target=es2020',
    ].join(' '),
    { stdio: 'inherit', cwd: ROOT },
  );
} catch {
  console.error('❌ App bundle build failed.');
  process.exit(1);
}

// ── Step 2: Generate modified index.html for file:// use ─────────────────

const indexHtml = readFileSync(join(ROOT, 'index.html'), 'utf-8');
const jsBundle = readFileSync(appOut, 'utf-8');

// Start with the original index.html and modify it:
// 1. Remove the <script type="importmap">...</script> block
let distHtml = indexHtml.replace(/<script\s+type="importmap">[\s\S]*?<\/script>\s*/g, '');

// 2. Replace <script type="module" src="js/ui/app.js"> with classic <script src="js/app.bundle.js">
distHtml = distHtml.replace(
  /<script\s+type="module"\s+src="js\/ui\/app\.js">\s*<\/script>/,
  '<script src="js/app.bundle.js"></script>',
);

// ── Step 3: Read CSS (unchanged) ─────────────────────────────────────────

const cssContent = readFileSync(join(ROOT, 'css', 'styles.css'), 'utf-8');

// ── Step 4: Emit output (raw files or ZIP) ───────────────────────────────

const htmlSize = Buffer.byteLength(distHtml, 'utf-8');
const cssSize = Buffer.byteLength(cssContent, 'utf-8');
const jsSize = Buffer.byteLength(jsBundle, 'utf-8');
const totalUncompressed = htmlSize + cssSize + jsSize;

console.log(`\n📁 3 files collected:`);
console.log(`   index.html:        ${(htmlSize / 1024).toFixed(1)} KB`);
console.log(`   css/styles.css:    ${(cssSize / 1024).toFixed(1)} KB`);
console.log(`   js/app.bundle.js:  ${(jsSize / 1024).toFixed(1)} KB`);
console.log(`   Uncompressed total: ${(totalUncompressed / 1024).toFixed(1)} KB`);

if (RAW_ONLY) {
  // Raw mode: write the three files to dist/demonsave_ps3_html/ preserving
  // the directory layout. No ZIP or .sha256 is generated.
  const RAW_DIR = join(DIST_DIR, 'demonsave_ps3_html');
  const rawIndex = join(RAW_DIR, 'index.html');
  const rawCss = join(RAW_DIR, 'css', 'styles.css');
  const rawJs = join(RAW_DIR, 'js', 'app.bundle.js');

  mkdirSync(dirname(rawIndex), { recursive: true });
  mkdirSync(dirname(rawCss), { recursive: true });
  mkdirSync(dirname(rawJs), { recursive: true });

  writeFileSync(rawIndex, distHtml);
  writeFileSync(rawCss, cssContent);
  writeFileSync(rawJs, jsBundle);

  console.log(`\n✅ Raw output (--raw-only):`);
  console.log(`   ${relative(ROOT, rawIndex)}`);
  console.log(`   ${relative(ROOT, rawCss)}`);
  console.log(`   ${relative(ROOT, rawJs)}`);
  console.log(`\n💡 No ZIP or .sha256 generated.`);
  console.log(`   Open index.html directly — works on file://!`);
} else {
  // Default mode: build a ZIP with the 3-file structure + SHA-256 signature.
  const { zipSync } = await import('fflate');
  const { sha256 } = await import('@noble/hashes/sha2.js');

  const TOP = 'demonsave_ps3_html';
  /** @type {{ [path: string]: Uint8Array }} */
  const zipEntries = {};

  // 1. index.html (modified for file://)
  zipEntries[`${TOP}/index.html`] = new Uint8Array(Buffer.from(distHtml, 'utf-8'));

  // 2. css/styles.css (unchanged)
  zipEntries[`${TOP}/css/styles.css`] = new Uint8Array(Buffer.from(cssContent, 'utf-8'));

  // 3. js/app.bundle.js (all JS bundled into IIFE)
  zipEntries[`${TOP}/js/app.bundle.js`] = new Uint8Array(Buffer.from(jsBundle, 'utf-8'));

  const zipBytes = zipSync(zipEntries, { level: 9 });
  console.log(`   Compressed:        ${(zipBytes.length / 1024).toFixed(1)} KB`);

  // ── SHA-256 hash ────────────────────────────────────────────────────────

  const hashHex = Array.from(sha256(zipBytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // ── Write output files ─────────────────────────────────────────────────

  const zipPath = join(DIST_DIR, 'demonsave_ps3_html.zip');
  const shaPath = join(DIST_DIR, 'demonsave_ps3_html.zip.sha256');

  writeFileSync(zipPath, zipBytes);
  writeFileSync(shaPath, `${hashHex}  demonsave_ps3_html.zip\n`);

  console.log(`\n✅ Output:`);
  console.log(`   ${relative(ROOT, zipPath)}  (${(zipBytes.length / 1024).toFixed(1)} KB)`);
  console.log(`   ${relative(ROOT, shaPath)}`);
  console.log(`\n🔑 SHA-256: ${hashHex}`);
  console.log(`\n💡 ZIP contains 3 files preserving directory structure.`);
  console.log(`   Extract and double-click index.html — works on file://!`);
}
