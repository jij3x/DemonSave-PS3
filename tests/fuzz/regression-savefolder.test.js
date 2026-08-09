/**
 * Fuzzing regression guard for the save-folder.js API surface.
 *
 * Jest half of the savefolder fuzzing story (Jazzer half:
 * fuzz/savefolder.fuzz.js). Both share fuzz/oracle.js. Inputs are built
 * in-memory so `npm test` stays deterministic.
 *
 * The oracle builds a fixed encrypted folder internally, exercises the full
 * save-folder API (decrypt/encrypt/isEncrypted/findEntry/rebuildChanges) in
 * both modes, and asserts a decrypt-after-encrypt round-trip. The fuzz input
 * is the plaintext re-encrypted into USER.DAT.
 */
import { assertSaveFolderApiStable } from '../../fuzz/oracle.js';
import { createPopulatedUserDat } from '../../test-fixtures/save-factory.js';

describe('save-folder API fuzz regression — clean-failure + round-trip', () => {
  test('a valid plaintext round-trips through the full API (oracle passes)', async () => {
    await expect(assertSaveFolderApiStable(createPopulatedUserDat(1))).resolves.toBeUndefined();
  });

  test('a zeroed plaintext round-trips', async () => {
    await expect(assertSaveFolderApiStable(new Uint8Array(0x40000))).resolves.toBeUndefined();
  });

  test('a non-block-aligned plaintext round-trips', async () => {
    await expect(
      assertSaveFolderApiStable(createPopulatedUserDat(1).subarray(0, 100)),
    ).resolves.toBeUndefined();
  });

  test('an empty input is handled cleanly (oracle falls back to its base)', async () => {
    await expect(assertSaveFolderApiStable(new Uint8Array(0))).resolves.toBeUndefined();
  });
});
