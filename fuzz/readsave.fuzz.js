/**
 * Jazzer.js fuzz target for readSave().
 *
 * Run via `npm run fuzz:readsave` (open-ended) or `fuzz:readsave:smoke` (60s bounded).
 * Per-target tuning (--sync, -max_len, -timeout) lives in tools/fuzz.mjs; run
 * `node tools/fuzz.mjs readsave --dry-run` to print the resolved jazzer argv.
 *
 * The target is intentionally a thin wrapper: all logic (and the clean-failure
 * contract under test) lives in fuzz/oracle.js, which is shared with the Jest
 * regression test so the two can never disagree.
 *
 * Jazzer invokes the exported `fuzz` function once per generated input,
 * passing a Node Buffer. We view it as a Uint8Array (zero-copy) and hand it to
 * the oracle. Do NOT short-circuit on size here — readSave()'s own size guard
 * is a real branch we want coverage to keep exercising.
 */

import { assertReadSaveClean } from './oracle.js';

/**
 * @param {Buffer} data  raw bytes generated/mutated by libFuzzer
 * @returns {void}
 */
export function fuzz(data) {
  assertReadSaveClean(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
}
