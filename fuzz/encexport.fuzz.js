/**
 * Jazzer.js fuzz target for the encrypted export + decrypted write-back
 * pipeline.
 *
 * Run via `npm run fuzz:encexport` (open-ended) or `fuzz:encexport:smoke` (60s bounded).
 * Per-target tuning (--sync, -max_len, -timeout) lives in tools/fuzz.mjs; run
 * `node tools/fuzz.mjs encexport --dry-run` to print the resolved jazzer argv.
 *
 * Fuzzes the save-api write/encrypt path (exportEncryptedSave + writeSaveData
 * + updateSessionAfterWrite) by wrapping a fuzzed primary USER.DAT in a fixed
 * valid unencrypted folder, exporting it to a fully encrypted folder (new PFD
 * + encrypted files + full hash chain), re-opening that encrypted folder, then
 * writing it back decrypted and re-opening again. The two post-write reads
 * must be idempotent.
 *
 * Async target (returns a Promise) — Jazzer awaits it. Each input runs several
 * full crypto passes, so throughput is lower than the sync targets; that's
 * expected. Thin wrapper: all logic lives in fuzz/oracle.js.
 */

import { createUnencryptedSaveFolder } from '../test-fixtures/save-factory.js';
import { assertEncExportStable } from './oracle.js';

// Base folder loaded once at module init (Jazzer reuses the module across
// inputs). Slot 1 active = USER.DAT; we override its bytes per input.
const BASE_FOLDER = createUnencryptedSaveFolder([1], {
  profileNumber: 42,
  realisticSfo: true,
  accountId: 'aabbccdd11223344aabbccdd11223344',
});

/**
 * @param {Buffer} data  raw bytes for the primary USER.DAT
 * @returns {Promise<void>}
 */
export async function fuzz(data) {
  const folder = new Map(BASE_FOLDER);
  folder.set('user.dat', {
    name: 'USER.DAT',
    bytes: new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
  });
  await assertEncExportStable(folder);
}
