/**
 * Tmp directory sandbox for integration tests.
 *
 * Creates a temporary directory on disk, provides helpers to write/read
 * save files as raw bytes, and guarantees cleanup (even on test failure).
 *
 * Uses Node's fs/promises + fs + os + path — runs under the Jest Node
 * environment (testEnvironment: 'node').
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

/**
 * Create a temporary directory for an integration test.
 *
 * @param {string} label  human-readable label for the dir name
 * @returns {{dir: string, writeFiles: (files: Map<string, Uint8Array>) => void, writeFile: (name: string, bytes: Uint8Array) => void, readFile: (name: string) => Uint8Array, readFiles: () => Map<string, {name: string, bytes: Uint8Array}>, listFiles: () => string[], cleanup: () => Promise<void>}}
 */
export function createTmpSandbox(label) {
  const prefix = path.join(os.tmpdir(), `des-test-${label || 'sandbox'}-`);
  const dir = fs.mkdtempSync(prefix);
  let cleaned = false;

  return {
    /** Full path to the tmp directory. */
    dir,

    /**
     * Write a map of filename → Uint8Array to the tmp dir.
     * @param {Map<string, Uint8Array>} files
     */
    writeFiles(files) {
      for (const [name, bytes] of files) {
        const fullPath = path.join(dir, name);
        fs.writeFileSync(fullPath, Buffer.from(bytes));
      }
    },

    /**
     * Write a single file to the tmp dir.
     * @param {string} name
     * @param {Uint8Array} bytes
     */
    writeFile(name, bytes) {
      const fullPath = path.join(dir, name);
      fs.writeFileSync(fullPath, Buffer.from(bytes));
    },

    /**
     * Read a single file from the tmp dir.
     * @param {string} name
     * @returns {Uint8Array}
     */
    readFile(name) {
      const fullPath = path.join(dir, name);
      const buf = fs.readFileSync(fullPath);
      return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    },

    /**
     * Read ALL files from the tmp dir into a Map keyed by lowercase name,
     * matching the format expected by openSave().
     * @returns {Map<string, {name: string, bytes: Uint8Array}>}
     */
    readFiles() {
      const entries = fs.readdirSync(dir);
      const map = new Map();
      for (const name of entries) {
        const fullPath = path.join(dir, name);
        const stat = fs.statSync(fullPath);
        if (!stat.isFile()) continue;
        const buf = fs.readFileSync(fullPath);
        const bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
        map.set(name.toLowerCase(), { name, bytes });
      }
      return map;
    },

    /**
     * List all files in the tmp dir.
     * @returns {string[]}
     */
    listFiles() {
      return fs.readdirSync(dir);
    },

    /**
     * Delete a file from the tmp dir.  Silently ignores missing files.
     * @param {string} name
     */
    deleteFile(name) {
      const fullPath = path.join(dir, name);
      try {
        fs.unlinkSync(fullPath);
      } catch {
        // ignore if file doesn't exist
      }
    },

    /**
     * Recursively remove the tmp directory.  Safe to call multiple times.
     */
    async cleanup() {
      if (cleaned) return;
      cleaned = true;
      try {
        await fsp.rm(dir, { recursive: true, force: true });
      } catch {
        // Best-effort — ignore errors if the dir was already removed.
      }
    },
  };
}
