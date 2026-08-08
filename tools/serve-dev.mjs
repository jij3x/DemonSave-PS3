#!/usr/bin/env node
/**
 * serve-dev.mjs — Zero-dependency static file server for Tauri dev mode.
 *
 * Serves the project root on http://localhost:1420 so that the import map
 * in index.html can resolve bare module specifiers (e.g. "@noble/ciphers")
 * from node_modules/ during development.
 *
 * Must be started before `tauri dev`.  Tauri's beforeDevCommand handles this
 * automatically (configured in tauri.conf.json).
 *
 * Usage:  node tools/serve-dev.mjs
 */

import { createReadStream, statSync } from 'node:fs';
import { dirname, extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const PORT = 1420;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const server = createServer((req, res) => {
  // Parse URL, default to index.html
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';

  // Prevent path traversal outside ROOT
  const filePath = normalize(join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT + sep) && filePath !== ROOT) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  try {
    const stat = statSync(filePath);
    if (stat.isDirectory()) {
      // Serve index.html for directories
      const indexPath = join(filePath, 'index.html');
      try {
        statSync(indexPath);
        serveFile(indexPath, res);
      } catch {
        res.writeHead(404);
        res.end('Not Found');
      }
      return;
    }
    serveFile(filePath, res);
  } catch {
    res.writeHead(404);
    res.end('Not Found');
  }
});

/**
 * @param {string} filePath
 * @param {import('http').ServerResponse} res
 */
function serveFile(filePath, res) {
  const ext = extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  try {
    const stat = statSync(filePath);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stat.size,
      'Cache-Control': 'no-cache',
    });
    createReadStream(filePath).pipe(res);
  } catch {
    res.writeHead(404);
    res.end('Not Found');
  }
}

// Sync the app version (single source of truth: package.json) before serving.
try {
  execSync('node tools/gen-version.mjs', { cwd: ROOT, stdio: 'inherit' });
} catch {
  /* dev tolerates a stale committed js/version.js */
}

server.listen(PORT, () => {
  console.log(`\n🌐 Dev server running at http://localhost:${PORT}`);
  console.log(`   Serving: ${ROOT}`);
  console.log(`   Press Ctrl+C to stop.\n`);
});
