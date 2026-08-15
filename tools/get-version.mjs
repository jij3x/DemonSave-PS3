#!/usr/bin/env node
/**
 * tools/get-version.mjs
 *
 * Prints the app version from package.json (the single source of truth that
 * tools/gen-version.mjs syncs into tauri.conf.json / Cargo.toml). Used by
 * release.yml jobs so every job derives APP_VERSION the same way.
 *
 * Usage:
 *   node tools/get-version.mjs   # e.g. prints "1.1.0"
 *
 * @ts-check
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const version = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;

if (!version) {
  console.error('tools/get-version.mjs: no version found in package.json');
  process.exit(1);
}

process.stdout.write(`${version}\n`);
