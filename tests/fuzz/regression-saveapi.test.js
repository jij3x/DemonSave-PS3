/**
 * Fuzzing regression guard for save-api.js folder-shape orchestration.
 *
 * Jest half of the saveapi fuzzing story (Jazzer half: fuzz/saveapi.fuzz.js).
 * Both share fuzz/oracle.js. Inputs are the same 1-byte blueprint selectors
 * the corpus generator writes, decoded in-memory so `npm test` stays
 * deterministic.
 *
 * The oracle derives a folder shape (slot count, rotation, encryption, failed
 * slot, assets, inPlace) from the selector, then runs the full open → export →
 * open → write-back → open pipeline. Every shape must obey the clean-failure
 * contract (no TypeError/RangeError); shapes that cannot produce a valid slot
 * return cleanly via the swallowed domain error.
 */
import { decodeFolderBlueprint, assertEncExportStable } from '../../fuzz/oracle.js';

// Mirror of the blueprint seeds in tools/gen-fuzz-corpus.mjs (byte0 values).
/** @type {[string, number][]} */
const SEEDS = [
  ['1slot-unenc', 0x00],
  ['2slot-unenc', 0x01],
  ['4slot-unenc', 0x02],
  ['2slot-enc', 0x81],
  ['4slot-enc', 0x82],
  ['all3-rotation', 0x03],
  ['no-secondary', 0x04],
  ['failed-slot', 0x05],
  ['enc-failed-slot', 0x85],
  ['2slot-assets', 0x06],
  ['1slot-enc', 0x80],
  ['no-param-sfo', 0x07],
  ['1slot-inplace', 0x40],
  ['2slot-enc-inplace', 0xc1],
];

describe('save-api folder-shape fuzz regression — clean-failure contract', () => {
  test.each(SEEDS)('%s blueprint obeys the clean-failure contract', async (_name, byte0) => {
    const inPlace = (byte0 & 0x40) !== 0;
    await expect(
      assertEncExportStable(decodeFolderBlueprint(Uint8Array.of(byte0)), inPlace),
    ).resolves.toBeUndefined();
  });
});
