/**
 * Jazzer.js fuzz target for the openSave() pipeline (async).
 *
 * Run via `npm run fuzz:pipeline` (open-ended) or `fuzz:pipeline:smoke` (60s bounded).
 * Per-target tuning (--sync, -max_len, -timeout) lives in tools/fuzz.mjs; run
 * `node tools/fuzz.mjs pipeline --dry-run` to print the resolved jazzer argv.
 *
 * Fuzzes the full save-api open path (file resolution → readSave → sanitizeModel
 * → slot packaging) by wrapping a fuzzed primary USER.DAT in a fixed valid
 * unencrypted folder. Unencrypted mode is used deliberately: the encrypted
 * path's PFD hash chain would reject mutated ciphertext before it ever reached
 * the parser, so it would fizzle.
 *
 * Async target (returns a Promise) — Jazzer awaits it. Throughput is lower than
 * the sync targets; that's expected for a pipeline that yields to the event
 * loop. Thin wrapper: all logic lives in fuzz/oracle.js.
 */

import { createUnencryptedSaveFolder } from '../test-fixtures/save-factory.js';
import { assertOpenSaveClean } from './oracle.js';

// Base folder loaded once at module init (Jazzer reuses the module across
// inputs). Slot 1 active = USER.DAT (1USER.DAT absent); we override its bytes
// per input. The fixed SFO/secondary are read-only here (openSave slices the
// SFO; the secondary is only touched at write time).
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
  await assertOpenSaveClean(folder);
}
