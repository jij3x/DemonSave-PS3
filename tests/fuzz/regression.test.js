/**
 * Fuzzing regression guard for readSave().
 *
 * This is the Jest half of the fuzzing story; the Jazzer half lives in
 * fuzz/readsave.fuzz.js. Both share fuzz/oracle.js so the clean-failure
 * contract under test is identical.
 *
 * Why this exists: Jazzer found (within ~190 runs) that readSave() returned a
 * model with a NaN `rot` for certain byte patterns — a save that could be
 * opened but never saved back (writer.js's val() rejects NaN). readSave() now
 * rejects non-finite floats; these tests lock that in.
 *
 * Inputs are built in-memory (no disk dependency) so `npm test` is fully
 * deterministic and never coupled to machine-local fuzzing state. (The live
 * fuzzer corpus under fuzz/corpus/ is operational and gitignored; new findings
 * are folded back here as explicit cases once fixed.)
 */
import { assertReadSaveClean } from '../../fuzz/oracle.js';
import { readSave } from '../../js/des-savefile/reader.js';
import { CHAR_TENDENCY, POS_TABLE_BASE } from '../../js/des-savefile/offsets.js';
import { createPopulatedUserDat } from '../../test-fixtures/save-factory.js';

// IEEE-754 quiet NaN (big-endian), the bit pattern that triggered the original
// finding: writing it into any readSave() float field must now be rejected.
const NAN_BE = [0x7f, 0xc0, 0x00, 0x00];

/** A realistic, cleanly-parsing seed (POS_OFFSET_SELECTOR is 0, so rot lives at POS_TABLE_BASE + 0x14). */
function validSeed() {
  return createPopulatedUserDat(1);
}

describe('readSave() fuzz regression — clean-failure contract', () => {
  test('a valid seed parses into a well-formed model (oracle passes)', () => {
    expect(() => assertReadSaveClean(validSeed())).not.toThrow();
  });

  test('non-finite position float (rot=NaN) is rejected, not silently returned', () => {
    const bytes = validSeed();
    bytes.set(NAN_BE, POS_TABLE_BASE + 0x14); // rot
    expect(() => readSave(bytes)).toThrow(/encrypted or corrupt/i);
    // The oracle must treat this as a clean rejection (no finding).
    expect(() => assertReadSaveClean(bytes)).not.toThrow();
  });

  test('non-finite tendency float (charTendency=NaN) is rejected', () => {
    const bytes = validSeed();
    bytes.set(NAN_BE, CHAR_TENDENCY);
    expect(() => readSave(bytes)).toThrow(/encrypted or corrupt/i);
    expect(() => assertReadSaveClean(bytes)).not.toThrow();
  });

  test('Infinity floats are rejected too (another IEEE-754 edge)', () => {
    const bytes = validSeed();
    // 0x7F800000 big-endian = +Infinity
    bytes.set([0x7f, 0x80, 0x00, 0x00], POS_TABLE_BASE + 0x14);
    expect(() => readSave(bytes)).toThrow(/encrypted or corrupt/i);
  });

  test('garbage / too-small input is rejected cleanly (no TypeError)', () => {
    expect(() => assertReadSaveClean(new Uint8Array(8))).not.toThrow();
    expect(() => assertReadSaveClean(new Uint8Array(0x40000))).not.toThrow();
  });
});
