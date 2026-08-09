/**
 * Fuzzing regression guard for the encrypted export + write-back pipeline.
 *
 * Jest half of the encexport fuzzing story (Jazzer half:
 * fuzz/encexport.fuzz.js). Both share fuzz/oracle.js. Inputs are built
 * in-memory so `npm test` stays deterministic.
 *
 * The oracle wraps a fuzzed primary USER.DAT in a fixed valid unencrypted
 * folder and runs the full open → exportEncryptedSave → open → writeSaveData
 * → open pipeline. The two post-write reads must be idempotent, and every
 * stage must obey the clean-failure contract (no TypeError/RangeError).
 */
import { assertEncExportStable } from '../../fuzz/oracle.js';
import {
  createPopulatedUserDat,
  createUnencryptedSaveFolder,
} from '../../test-fixtures/save-factory.js';

/**
 * Build an unencrypted folder with a given primary USER.DAT.
 * @param {Uint8Array} primaryBytes
 * @returns {Map<string, {name: string, bytes: Uint8Array}>}
 */
function buildFolderWithPrimary(primaryBytes) {
  const folder = new Map(
    createUnencryptedSaveFolder([1], {
      profileNumber: 42,
      realisticSfo: true,
      accountId: 'aabbccdd11223344aabbccdd11223344',
    }),
  );
  folder.set('user.dat', { name: 'USER.DAT', bytes: primaryBytes });
  return folder;
}

describe('encrypted export pipeline fuzz regression — clean-failure contract', () => {
  test('a valid primary round-trips through export + write (oracle passes)', async () => {
    await expect(
      assertEncExportStable(buildFolderWithPrimary(createPopulatedUserDat(1))),
    ).resolves.toBeUndefined();
  });

  test('a garbage primary is handled cleanly (no TypeError/RangeError)', async () => {
    await expect(
      assertEncExportStable(buildFolderWithPrimary(new Uint8Array(0x40000))),
    ).resolves.toBeUndefined();
    await expect(
      assertEncExportStable(buildFolderWithPrimary(new Uint8Array(8))),
    ).resolves.toBeUndefined();
  });
});
