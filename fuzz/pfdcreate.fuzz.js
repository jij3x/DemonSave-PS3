/**
 * Jazzer.js fuzz target for createPfdForFiles + the full PFD hash chain.
 *
 * Run via `npm run fuzz:pfdcreate` (open-ended) or `fuzz:pfdcreate:smoke` (60s bounded).
 * Per-target tuning (--sync, -max_len, -timeout) lives in tools/fuzz.mjs; run
 * `node tools/fuzz.mjs pfdcreate --dry-run` to print the resolved jazzer argv.
 *
 * The fuzz input encodes a file list (decoded by `decodeFileList` in
 * oracle.js). The target builds a PFD from scratch, computes every hash,
 * serializes, and re-parses — exercising PFD creation (incl. hash-collision
 * chaining), the HMAC hash chain, and serialization. Thin wrapper: all logic
 * lives in fuzz/oracle.js.
 */

import { assertPfdCreateStable } from './oracle.js';

/**
 * @param {Buffer} data  encoded file-list bytes generated/mutated by libFuzzer
 * @returns {void}
 */
export function fuzz(data) {
  assertPfdCreateStable(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
}
