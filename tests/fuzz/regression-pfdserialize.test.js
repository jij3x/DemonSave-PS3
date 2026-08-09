/**
 * Fuzzing regression guard for the PFD serializer (parse → clone → serialize
 * → re-parse).
 *
 * Jest half of the pfdserialize fuzzing story (Jazzer half:
 * fuzz/pfdserialize.fuzz.js). Both share fuzz/oracle.js. Inputs are built
 * in-memory so `npm test` stays deterministic.
 *
 * The oracle parses a PFD, deep-clones it, serializes the clone, and re-parses
 * — asserting the clone matches and the re-parsed counts equal the original.
 */
import { assertPfdSerializeStable } from '../../fuzz/oracle.js';
import {
  createPfdForFiles,
  fromHex,
  getParamPfdCombinedData,
} from '../../js/lib/ps3-save-lib/index.js';

/** DeS SecureFileID (matches save-api.js / save-factory.js). */
const SECURE_ID = fromHex('0123456789ABCDEFFEDCBA9876543210');

describe('pfdserialize fuzz regression — serializer is a fixed point', () => {
  test('a single-entry PFD serializes and re-parses stably', () => {
    const pfdBytes = getParamPfdCombinedData(
      createPfdForFiles([{ name: 'USER.DAT', size: 32 }], SECURE_ID),
    );
    expect(() => assertPfdSerializeStable(pfdBytes)).not.toThrow();
  });

  test('a multi-entry (real-save-shaped) PFD serializes and re-parses stably', () => {
    const pfdBytes = getParamPfdCombinedData(
      createPfdForFiles(
        [
          { name: 'PARAM.SFO', size: 0x600 },
          { name: 'USER.DAT', size: 0x40000 },
          { name: '04USER.DAT', size: 0x800 },
        ],
        SECURE_ID,
      ),
    );
    expect(() => assertPfdSerializeStable(pfdBytes)).not.toThrow();
  });

  test('garbage / too-short bytes are handled cleanly', () => {
    expect(() => assertPfdSerializeStable(new Uint8Array(0))).not.toThrow();
    expect(() => assertPfdSerializeStable(new Uint8Array(64))).not.toThrow();
  });
});
