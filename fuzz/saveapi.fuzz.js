/**
 * Jazzer.js fuzz target for save-api.js folder-shape orchestration (async).
 *
 * Run via `npm run fuzz:saveapi` (open-ended) or `fuzz:saveapi:smoke` (60s bounded).
 * Per-target tuning (--sync, -max_len, -timeout) lives in tools/fuzz.mjs; run
 * `node tools/fuzz.mjs saveapi --dry-run` to print the resolved jazzer argv.
 *
 * Unlike pipeline/encexport (which wrap a *fixed single-slot unencrypted*
 * folder and only vary USER.DAT bytes), this target derives the folder SHAPE
 * from the fuzz input — slot count (1/2/4), rotational-variant presence,
 * encryption state, failed-slot injection, asset files — then runs the full
 * open → exportEncryptedSave → open → writeSaveData → open pipeline. This is
 * the only fuzz-reachable way to cover save-api.js' multi-slot iteration,
 * rotational fallback, missing-secondary, failed-slot preservation,
 * encrypted-source backup-decryption, and asset-inclusion branches.
 *
 * All logic lives in fuzz/oracle.js (decodeFolderBlueprint + assertEncExportStable).
 * The folder contents are fixed valid USER.DATs per slot (createPopulatedUserDat);
 * this target fuzzes folder *structure*, not save-file contents.
 */

import { decodeFolderBlueprint, assertEncExportStable } from './oracle.js';

/**
 * @param {Buffer} data  raw blueprint bytes (only byte0/byte1 are read)
 * @returns {Promise<void>}
 */
export async function fuzz(data) {
  const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  const folder = decodeFolderBlueprint(bytes);
  // bit6 of byte0 selects in-place write/export mode (covers the inPlace
  // branches in writeSaveData/exportEncryptedSave).
  const inPlace = bytes.length >= 1 && (bytes[0] & 0x40) !== 0;
  await assertEncExportStable(folder, inPlace);
}
