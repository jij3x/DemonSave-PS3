/**
 * Jazzer.js fuzz target for the save-folder.js API surface.
 *
 * Run via `npm run fuzz:savefolder` (open-ended) or `fuzz:savefolder:smoke` (60s bounded).
 * Per-target tuning (--sync, -max_len, -timeout) lives in tools/fuzz.mjs; run
 * `node tools/fuzz.mjs savefolder --dry-run` to print the resolved jazzer argv.
 *
 * The fuzz input is plaintext re-encrypted into USER.DAT. The target builds a
 * fixed encrypted folder and exercises createSaveFolder, decryptToBytes,
 * encryptBytes, isEncrypted, findEntry, and rebuildChanges (→ rebuildParamPfd)
 * in both encrypted and unencrypted modes, asserting a decrypt-after-encrypt
 * round-trip. Async target — Jazzer awaits it. Thin wrapper: all logic lives
 * in fuzz/oracle.js.
 */

import { assertSaveFolderApiStable } from './oracle.js';

/**
 * @param {Buffer} data  plaintext bytes generated/mutated by libFuzzer
 * @returns {Promise<void>}
 */
export async function fuzz(data) {
  await assertSaveFolderApiStable(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
}
