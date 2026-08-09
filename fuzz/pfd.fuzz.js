/**
 * Jazzer.js fuzz target for parseParamPfd().
 *
 * Run via `npm run fuzz:pfd` (open-ended) or `fuzz:pfd:smoke` (60s bounded).
 * Per-target tuning (--sync, -max_len, -timeout) lives in tools/fuzz.mjs; run
 * `node tools/fuzz.mjs pfd --dry-run` to print the resolved jazzer argv.
 *
 * Thin wrapper: all logic lives in fuzz/oracle.js (shared with the Jest guard).
 */

import { assertParsePfdClean } from './oracle.js';

/**
 * @param {Buffer} data  raw bytes generated/mutated by libFuzzer
 * @returns {void}
 */
export function fuzz(data) {
  assertParsePfdClean(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
}
