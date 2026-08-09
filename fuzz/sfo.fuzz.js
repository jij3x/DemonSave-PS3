/**
 * Jazzer.js fuzz target for parseParamSfo().
 *
 * Run via `npm run fuzz:sfo` (open-ended) or `fuzz:sfo:smoke` (60s bounded).
 * Per-target tuning (--sync, -max_len, -timeout) lives in tools/fuzz.mjs; run
 * `node tools/fuzz.mjs sfo --dry-run` to print the resolved jazzer argv.
 *
 * Thin wrapper: all logic lives in fuzz/oracle.js (shared with the Jest guard).
 */

import { assertParseSfoClean } from './oracle.js';

/**
 * @param {Buffer} data  raw bytes generated/mutated by libFuzzer
 * @returns {void}
 */
export function fuzz(data) {
  assertParseSfoClean(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
}
