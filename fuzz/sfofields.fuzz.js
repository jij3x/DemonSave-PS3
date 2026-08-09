/**
 * Jazzer.js fuzz target for the PARAM.SFO field accessors + mutators.
 *
 * Run via `npm run fuzz:sfofields` (open-ended) or `fuzz:sfofields:smoke` (60s bounded).
 * Per-target tuning (--sync, -max_len, -timeout) lives in tools/fuzz.mjs; run
 * `node tools/fuzz.mjs sfofields --dry-run` to print the resolved jazzer argv.
 *
 * The fuzz input is a PARAM.SFO buffer. The target parses it (when possible)
 * and runs every getter (getTitle…getAccountId) plus the raw-byte mutators
 * (getSfoAttribute, removeCopyProtection, getSfoAccountId, writeSfoAccountId)
 * — exercising findParamDataOffset's validation branches. Thin wrapper: all
 * logic lives in fuzz/oracle.js.
 */

import { assertSfoFieldsClean } from './oracle.js';

/**
 * @param {Buffer} data  raw SFO bytes generated/mutated by libFuzzer
 * @returns {void}
 */
export function fuzz(data) {
  assertSfoFieldsClean(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
}
