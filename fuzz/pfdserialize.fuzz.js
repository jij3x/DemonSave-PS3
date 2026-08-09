/**
 * Jazzer.js fuzz target for the PFD serializer (parse → clone → serialize →
 * re-parse).
 *
 * Run via `npm run fuzz:pfdserialize` (open-ended) or `fuzz:pfdserialize:smoke` (60s bounded).
 * Per-target tuning (--sync, -max_len, -timeout) lives in tools/fuzz.mjs; run
 * `node tools/fuzz.mjs pfdserialize --dry-run` to print the resolved jazzer argv.
 *
 * Exercises `getParamPfdCombinedData` and `cloneParamPfd` on arbitrary
 * parse-accepted PFD structures (collision chains, variable entry counts),
 * asserting the serializer is a fixed point on structurally-plausible inputs.
 * Thin wrapper: all logic lives in fuzz/oracle.js.
 */

import { assertPfdSerializeStable } from './oracle.js';

/**
 * @param {Buffer} data  raw PFD bytes generated/mutated by libFuzzer
 * @returns {void}
 */
export function fuzz(data) {
  assertPfdSerializeStable(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
}
