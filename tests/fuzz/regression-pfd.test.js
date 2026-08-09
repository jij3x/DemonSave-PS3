/**
 * Fuzzing regression guard for parseParamPfd().
 *
 * Jest half of the PFD fuzzing story (Jazzer half: fuzz/pfd.fuzz.js). Both
 * share fuzz/oracle.js. Inputs are built in-memory so `npm test` stays
 * deterministic and decoupled from the operational corpus.
 *
 * Locks in the finding Jazzer surfaced within ~2k runs: a 96–119 byte buffer
 * with a valid magic/version passed the old `< 96` size guard, then made
 * readU64BE throw a RangeError reading numTotal@104 (a missed guard, not a
 * clean rejection). parseParamPfd now requires 120 bytes (header + signature +
 * the three count fields).
 */
import { assertParsePfdClean } from '../../fuzz/oracle.js';
import {
  createPfdForFiles,
  fromHex,
  getParamPfdCombinedData,
  parseParamPfd,
} from '../../js/lib/ps3-save-lib/index.js';

const SECURE_ID = fromHex('0123456789ABCDEFFEDCBA9876543210');

describe('parseParamPfd() fuzz regression — clean-failure contract', () => {
  test('a valid PFD parses into a well-formed object (oracle passes)', () => {
    const pfd = createPfdForFiles([{ name: 'USER.DAT', size: 32 }], SECURE_ID);
    const bytes = getParamPfdCombinedData(pfd);
    expect(() => assertParsePfdClean(bytes)).not.toThrow();
  });

  test('a buffer under 120 bytes is rejected cleanly (no RangeError)', () => {
    const pfd = createPfdForFiles([{ name: 'USER.DAT', size: 32 }], SECURE_ID);
    // 105 bytes: ≥ old 96 threshold, has valid magic+version, but < the 120
    // needed to read numReserved/numTotal/numUsed. Before the fix this reached
    // readU64BE(offset 104) and threw a RangeError.
    const truncated = getParamPfdCombinedData(pfd).subarray(0, 105);
    expect(() => parseParamPfd(truncated)).toThrow(/too short/i);
    expect(() => parseParamPfd(truncated)).not.toThrow(/out of bounds/i);
    expect(() => assertParsePfdClean(truncated)).not.toThrow();
  });

  test('garbage / too-small input is rejected cleanly', () => {
    expect(() => assertParsePfdClean(new Uint8Array(8))).not.toThrow();
    expect(() => assertParsePfdClean(new Uint8Array(200))).not.toThrow();
  });
});
