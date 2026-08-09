#!/usr/bin/env node
/**
 * tools/fuzz-coverage.mjs
 *
 * Replays every fuzz corpus through its oracle so a coverage collector (c8)
 * can measure the union of code reachable by the fuzz targets. Intended to be
 * run via `npm run fuzz:cov`, which wraps this script with c8 and prints
 * per-file line/branch/function coverage for js/ (excluding js/ui).
 *
 * This replays the *seed* corpus (produced by `npm run fuzz:corpus`), not the
 * mutated corpus a long fuzzing session generates, so it stays fast and
 * deterministic. It mirrors what each fuzz/*.fuzz.js target does, so the
 * coverage reflects the same code surface.
 *
 * @ts-check
 */
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import * as oracle from '../fuzz/oracle.js';
import { createUnencryptedSaveFolder } from '../test-fixtures/save-factory.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CORPUS_ROOT = path.resolve(__dirname, '..', 'fuzz', 'corpus');

/** Fixed base folder used by the pipeline/encexport targets (slot 1 = USER.DAT). */
const BASE_FOLDER = createUnencryptedSaveFolder([1], {
  profileNumber: 42,
  realisticSfo: true,
  accountId: 'aabbccdd11223344aabbccdd11223344',
});

/**
 * List regular files in a directory.
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
async function listFiles(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.isFile()) out.push(path.join(dir, e.name));
  }
  return out;
}

/**
 * Wrap a Node Buffer as a standalone Uint8Array (copies the view's memory).
 * @param {Buffer} buf
 * @returns {Uint8Array}
 */
function toBytes(buf) {
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

/**
 * Replay a corpus dir through a synchronous oracle, swallowing per-input
 * clean domain errors / findings (expected on malformed seeds).
 * @param {string} name
 * @param {(bytes: Uint8Array) => void} fn
 * @returns {Promise<number>}
 */
async function replaySync(name, fn) {
  const dir = path.join(CORPUS_ROOT, name);
  let n = 0;
  for (const f of await listFiles(dir)) {
    try {
      fn(toBytes(await readFile(f)));
    } catch {
      /* clean domain errors / findings are expected on malformed corpus */
    }
    n++;
  }
  return n;
}

/**
 * Replay a corpus dir through an **async** byte-oracle (e.g. savefolder),
 * swallowing per-input clean domain errors / findings.
 * @param {string} name
 * @param {(bytes: Uint8Array) => Promise<void>} fn
 * @returns {Promise<number>}
 */
async function replayAsync(name, fn) {
  const dir = path.join(CORPUS_ROOT, name);
  let n = 0;
  for (const f of await listFiles(dir)) {
    try {
      await fn(toBytes(await readFile(f)));
    } catch {
      /* clean domain errors / findings are expected on malformed corpus */
    }
    n++;
  }
  return n;
}

/**
 * Replay a corpus dir through a folder-wrapping oracle (pipeline / encexport),
 * overriding the primary USER.DAT per input.
 * @param {string} name
 * @param {(folder: Map<string, {name: string, bytes: Uint8Array}>) => Promise<void>} fn
 * @returns {Promise<number>}
 */
async function replayFolder(name, fn) {
  const dir = path.join(CORPUS_ROOT, name);
  let n = 0;
  for (const f of await listFiles(dir)) {
    const folder = new Map(BASE_FOLDER);
    folder.set('user.dat', { name: 'USER.DAT', bytes: toBytes(await readFile(f)) });
    try {
      await fn(folder);
    } catch {
      /* expected on malformed primary */
    }
    n++;
  }
  return n;
}

console.log('Replaying fuzz corpora through oracles (for coverage)...');
const counts = {};
counts.readsave = await replaySync('readsave', oracle.assertReadSaveClean);
counts.pfd = await replaySync('pfd', oracle.assertParsePfdClean);
counts.sfo = await replaySync('sfo', oracle.assertParseSfoClean);
counts.roundtrip = await replaySync('roundtrip', oracle.assertRoundTripStable);
counts.crypto = await replaySync('crypto', oracle.assertCryptoRoundTrip);
counts.pfdcreate = await replaySync('pfdcreate', oracle.assertPfdCreateStable);
counts.pfdserialize = await replaySync('pfdserialize', oracle.assertPfdSerializeStable);
counts.sfofields = await replaySync('sfofields', oracle.assertSfoFieldsClean);
counts.pipeline = await replayFolder('pipeline', oracle.assertOpenSaveClean);
counts.encexport = await replayFolder('encexport', oracle.assertEncExportStable);
counts.savefolder = await replayAsync('savefolder', oracle.assertSaveFolderApiStable);
// saveapi: each seed is a folder-shape blueprint (not a USER.DAT), so decode
// it into a folder before running the export/write-back pipeline. The inPlace
// bit (byte0 & 0x40) is forwarded to exercise in-place write/export branches.
counts.saveapi = await replayAsync('saveapi', async (bytes) => {
  const inPlace = bytes.length >= 1 && (bytes[0] & 0x40) !== 0;
  await oracle.assertEncExportStable(oracle.decodeFolderBlueprint(bytes), inPlace);
});
console.log('REPLAYED', JSON.stringify(counts));
