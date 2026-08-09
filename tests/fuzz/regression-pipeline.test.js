/**
 * Fuzzing regression guard for the openSave() pipeline.
 *
 * Jest half of the pipeline fuzzing story (Jazzer half: fuzz/pipeline.fuzz.js).
 * Both share fuzz/oracle.js. Inputs are built in-memory so `npm test` stays
 * deterministic.
 *
 * The oracle wraps a fuzzed primary USER.DAT in a fixed valid unencrypted
 * folder and runs the full openSave path (file resolution → readSave →
 * sanitizeModel → slot packaging). openSave must not crash/hang/OOM, and every
 * slot that parses must carry a well-formed sanitized model.
 */
import { assertOpenSaveClean } from '../../fuzz/oracle.js';
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

describe('openSave pipeline fuzz regression — clean-failure contract', () => {
  test('a valid primary parses through the full pipeline (oracle passes)', async () => {
    await expect(
      assertOpenSaveClean(buildFolderWithPrimary(createPopulatedUserDat(1))),
    ).resolves.toBeUndefined();
  });

  test('a garbage primary is handled cleanly (failedSlots or clean error, no TypeError)', async () => {
    await expect(
      assertOpenSaveClean(buildFolderWithPrimary(new Uint8Array(0x40000))),
    ).resolves.toBeUndefined();
    await expect(
      assertOpenSaveClean(buildFolderWithPrimary(new Uint8Array(8))),
    ).resolves.toBeUndefined();
  });
});
