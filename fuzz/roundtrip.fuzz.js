/**
 * Jazzer.js fuzz target for the readSave → writeSave → readSave round-trip.
 *
 * Run via `npm run fuzz:roundtrip` (open-ended) or `fuzz:roundtrip:smoke` (60s bounded).
 * Per-target tuning (--sync, -max_len, -timeout) lives in tools/fuzz.mjs; run
 * `node tools/fuzz.mjs roundtrip --dry-run` to print the resolved jazzer argv.
 *
 * Catches read/write asymmetries (writeSave throwing on, or drifting values
 * from, a readSave-accepted model) — the class of bug the readSave NaN fix
 * addressed. Thin wrapper: all logic lives in fuzz/oracle.js.
 */

import { assertRoundTripStable } from './oracle.js';

/**
 * @param {Buffer} data  raw bytes generated/mutated by libFuzzer
 * @returns {void}
 */
export function fuzz(data) {
  assertRoundTripStable(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
}
