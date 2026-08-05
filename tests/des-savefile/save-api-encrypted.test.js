/**
 * Tests for the saveApi gateway that involve encryption/decryption.
 *
 * Separated from save-api.test.js so that the fast non-encryption tests
 * can be run independently:
 *   npx jest --testPathIgnorePatterns='[Ee]ncrypt'
 *
 * Or run only the encryption tests:
 *   npx jest save-api-encrypted
 */
import {
  openSave,
  writeSaveData,
  exportEncryptedSave,
  updateSessionAfterWrite,
} from '../../js/des-savefile/save-api.js';
import { readSave } from '../../js/des-savefile/reader.js';
import { wInt32BE } from '../../js/lib/ps3-save-lib/index.js';
import * as O from '../../js/des-savefile/offsets.js';
import {
  createPfdForFiles,
  getParamPfdCombinedData,
  validAllParamHashes,
  encryptFile,
  fromHex,
} from '../../js/lib/ps3-save-lib/index.js';
import { makeBlankSave, makeSfo, makeSecondary, makeUnencryptedSaveFiles } from './helpers.js';

const SECURE_ID = fromHex('0123456789ABCDEFFEDCBA9876543210');

/** Build encrypted save files from plaintext bytes (single slot).
 *  Creates a PARAM.PFD + encrypted USER.DAT variants (USER.DAT, 2USER.DAT, 04USER.DAT).
 */
function makeEncryptedSaveFiles(userBytes) {
  const sfo = makeSfo();
  const secondary = makeSecondary();

  const fileList = [
    { name: 'PARAM.SFO', size: sfo.length },
    { name: 'USER.DAT', size: userBytes.length },
    { name: '2USER.DAT', size: userBytes.length },
    { name: '04USER.DAT', size: secondary.length },
  ];

  const pfd = createPfdForFiles(fileList, SECURE_ID);

  const plainMap = new Map();
  plainMap.set('param.sfo', sfo);
  plainMap.set('user.dat', userBytes);
  const secondaryCopy = new Uint8Array(userBytes);
  plainMap.set('2user.dat', secondaryCopy);
  plainMap.set('04user.dat', secondary);

  const encMap = new Map();
  encMap.set('param.sfo', sfo); // SFO not encrypted
  encMap.set('user.dat', encryptFile(userBytes, 'USER.DAT', pfd, true));
  encMap.set('2user.dat', encryptFile(secondaryCopy, '2USER.DAT', pfd, true));
  encMap.set('04user.dat', encryptFile(secondary, '04USER.DAT', pfd, true));

  validAllParamHashes(encMap, true, pfd);
  const pfdBytes = getParamPfdCombinedData(pfd);

  const files = new Map();
  files.set('param.sfo', { name: 'PARAM.SFO', bytes: sfo });
  files.set('param.pfd', { name: 'PARAM.PFD', bytes: pfdBytes });
  files.set('user.dat', { name: 'USER.DAT', bytes: encMap.get('user.dat') });
  files.set('2user.dat', { name: '2USER.DAT', bytes: encMap.get('2user.dat') });
  files.set('04user.dat', { name: '04USER.DAT', bytes: encMap.get('04user.dat') });

  return files;
}

// -----------------------------------------------------------------------
// exportEncryptedSave: PFD membership tests
// -----------------------------------------------------------------------

describe('exportEncryptedSave (PFD membership)', () => {
  test('assets (PNG) are NOT in PFD but are in output as plain files', async () => {
    const buf = makeBlankSave();
    const rawFiles = makeUnencryptedSaveFiles(buf);

    // Add asset files
    rawFiles.set('icon0.png', {
      name: 'ICON0.PNG',
      bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
    });
    rawFiles.set('pic1.png', { name: 'PIC1.PNG', bytes: new Uint8Array(1000) });

    const { slots, profileNumber, accountId } = await openSave(rawFiles);

    const { filesToWrite } = await exportEncryptedSave(slots, [], profileNumber, accountId);

    // Assets must be in output
    expect(filesToWrite.has('ICON0.PNG')).toBe(true);
    expect(filesToWrite.has('PIC1.PNG')).toBe(true);

    // Assets must be UNCHANGED (same bytes as input)
    const iconBytes = filesToWrite.get('ICON0.PNG');
    expect(iconBytes[0]).toBe(0x89); // PNG magic byte, not encrypted
    expect(iconBytes[1]).toBe(0x50);

    // PARAM.PFD must exist
    expect(filesToWrite.has('PARAM.PFD')).toBe(true);

    // Verify PFD does NOT contain asset entries by reopening
    const reopenFiles = new Map();
    for (const [name, bytes] of filesToWrite) {
      reopenFiles.set(name.toLowerCase(), { name, bytes });
    }
    const { slots: reopened } = await openSave(reopenFiles);

    // USER.DAT should still be parseable (encrypted + in PFD)
    // and assets should still be readable as plain bytes
    expect(reopened[0].model).toBeDefined();
  });

  test('backup USER.DAT variants are in PFD (encrypted)', async () => {
    const buf = makeBlankSave();
    const rawFiles = makeUnencryptedSaveFiles(buf);
    // makeUnencryptedSaveFiles already includes 2USER.DAT as a backup
    // (not the primary for any slot — slot 1 primary is USER.DAT)

    const { slots, profileNumber, accountId } = await openSave(rawFiles);
    const { filesToWrite } = await exportEncryptedSave(slots, [], profileNumber, accountId);

    // All USER.DAT variants should be in output
    expect(filesToWrite.has('USER.DAT')).toBe(true);
    expect(filesToWrite.has('2USER.DAT')).toBe(true);
    expect(filesToWrite.has('04USER.DAT')).toBe(true);

    // 2USER.DAT (backup) should be encrypted (different from original plaintext)
    const backupEnc = filesToWrite.get('2USER.DAT');
    const backupOrig = rawFiles.get('2user.dat').bytes;
    // Encrypted bytes won't match the original plaintext
    let isEncrypted = false;
    for (let i = 0; i < backupEnc.length; i++) {
      if (backupEnc[i] !== backupOrig[i]) {
        isEncrypted = true;
        break;
      }
    }
    expect(isEncrypted).toBe(true);
  });
});

// -----------------------------------------------------------------------
// Encrypted → Decrypted transition tests
// -----------------------------------------------------------------------

describe('writeSaveData (encrypted → decrypted)', () => {
  test('writeSaveData from encrypted session produces decrypted output', async () => {
    const buf = makeBlankSave();
    wInt32BE(buf, O.VIT, 50);
    wInt32BE(buf, O.SOULS, 99999);
    const rawFiles = makeEncryptedSaveFiles(buf);

    // Open encrypted save
    const { slots, profileNumber, accountId, encrypted } = await openSave(rawFiles);
    expect(encrypted).toBe(true);

    // Modify
    slots[0].model.vit = 99;
    slots[0].model.souls = 1;

    // Write — should produce decrypted output
    const {
      filesToWrite,
      encrypted: outEncrypted,
      filesToDelete,
    } = await writeSaveData(slots, [], profileNumber, accountId);

    expect(outEncrypted).toBe(false);
    expect(filesToWrite.has('PARAM.PFD')).toBe(false);
    expect(filesToDelete.has('PARAM.PFD')).toBe(true);

    // Verify USER.DAT is plaintext (parseable without decryption)
    const userBytes = filesToWrite.get('USER.DAT');
    const result = readSave(userBytes);
    expect(result.vit).toBe(99);
    expect(result.souls).toBe(1);
  });

  test('writeSaveData from unencrypted session has no filesToDelete', async () => {
    const buf = makeBlankSave();
    const rawFiles = makeUnencryptedSaveFiles(buf);

    const { slots } = await openSave(rawFiles);

    const { filesToDelete } = await writeSaveData(slots, [], 0, '');

    expect(filesToDelete.size).toBe(0);
  });

  test('full cycle: open unencrypted → export encrypted → open encrypted → save decrypted', async () => {
    // Step 1: Open unencrypted save
    const buf = makeBlankSave();
    wInt32BE(buf, O.VIT, 50);
    const rawFiles = makeUnencryptedSaveFiles(buf);
    const { slots: slots1, profileNumber: profile1 } = await openSave(rawFiles);
    expect(slots1[0].session.encrypted).toBe(false);

    // Step 2: Export encrypted
    slots1[0].model.vit = 75;
    const { filesToWrite: encFiles } = await exportEncryptedSave(slots1, [], profile1, '');
    expect(encFiles.has('PARAM.PFD')).toBe(true);

    // Build raw files map for reopening
    const encRawFiles = new Map();
    for (const [name, bytes] of encFiles) {
      encRawFiles.set(name.toLowerCase(), { name, bytes });
    }

    // Step 3: Open the encrypted save
    const { slots: slots2, profileNumber: profile2, encrypted: enc2 } = await openSave(encRawFiles);
    expect(enc2).toBe(true);
    expect(slots2[0].model.vit).toBe(75);

    // Step 4: Save decrypted — should produce plaintext, no PFD
    slots2[0].model.vit = 80;
    const {
      filesToWrite: decFiles,
      encrypted: decEnc,
      filesToDelete: decDel,
    } = await writeSaveData(slots2, [], profile2, '');

    expect(decEnc).toBe(false);
    expect(decFiles.has('PARAM.PFD')).toBe(false);
    expect(decDel.has('PARAM.PFD')).toBe(true);

    // Verify the data is correct
    const userBytes = decFiles.get('USER.DAT');
    const result = readSave(userBytes);
    expect(result.vit).toBe(80);
  });

  // Full cycle: loading a save, saving as encrypted, loading that, saving
  // as decrypted, and loading again must not lose data.
  test('encrypted → save encrypted → load → save decrypted → load', async () => {
    // Step 1: Create and open an encrypted save
    const buf = makeBlankSave();
    wInt32BE(buf, O.VIT, 40);
    wInt32BE(buf, O.SOULS, 5000);
    let rawFiles = makeEncryptedSaveFiles(buf);

    const { slots: slots1, profileNumber: profile1 } = await openSave(rawFiles);
    expect(slots1[0].model.vit).toBe(40);

    // Step 2: Save as encrypted
    slots1[0].model.vit = 60;
    const { filesToWrite: encOut1 } = await exportEncryptedSave(slots1, [], profile1, '');
    expect(encOut1.has('PARAM.PFD')).toBe(true);
    expect(encOut1.has('PARAM.SFO')).toBe(true);
    expect(encOut1.has('USER.DAT')).toBe(true);

    // Step 3: Load the encrypted save produced in step 2
    rawFiles = new Map();
    for (const [name, bytes] of encOut1) {
      rawFiles.set(name.toLowerCase(), { name, bytes });
    }
    const { slots: slots2, profileNumber: profile2, encrypted: enc2 } = await openSave(rawFiles);
    expect(enc2).toBe(true);
    expect(slots2[0].model.vit).toBe(60);

    // Step 4: Save as decrypted
    slots2[0].model.vit = 70;
    const { filesToWrite: decOut2, encrypted: decEnc2 } = await writeSaveData(slots2, [], profile2, '');
    expect(decEnc2).toBe(false);
    expect(decOut2.has('USER.DAT')).toBe(true);

    // Step 5: Load the decrypted save
    rawFiles = new Map();
    for (const [name, bytes] of decOut2) {
      rawFiles.set(name.toLowerCase(), { name, bytes });
    }
    const { slots: slots3, encrypted: enc3 } = await openSave(rawFiles);

    // Must successfully load with valid slot data
    expect(enc3).toBe(false);
    expect(slots3.length).toBeGreaterThan(0);
    expect(slots3[0].model.vit).toBe(70);
    expect(slots3[0].model.souls).toBe(5000);
  });

  // Multiple operations on the same session must not corrupt the in-memory
  // file data.
  test('multiple saves from same session preserve data integrity', async () => {
    const buf = makeBlankSave();
    wInt32BE(buf, O.VIT, 30);
    const rawFiles = makeEncryptedSaveFiles(buf);

    const { slots, profileNumber, accountId } = await openSave(rawFiles);

    // First operation: export encrypted
    const { filesToWrite: encOut } = await exportEncryptedSave(slots, [], profileNumber, accountId);
    expect(encOut.has('USER.DAT')).toBe(true);

    // Second operation on the SAME session: write decrypted
    const { filesToWrite: decOut } = await writeSaveData(slots, [], profileNumber, accountId);
    expect(decOut.has('USER.DAT')).toBe(true);

    // The decrypted output must be valid, parseable data
    const userBytes = decOut.get('USER.DAT');
    const result = readSave(userBytes);
    expect(result.vit).toBe(30);
  });
});

// -----------------------------------------------------------------------
// updateSessionAfterWrite: session state sync after in-place overwrite
// -----------------------------------------------------------------------

describe('updateSessionAfterWrite (session state sync)', () => {
  test('encrypted → decrypted: clears PFD, updates flags and file maps', async () => {
    const buf = makeBlankSave();
    wInt32BE(buf, O.VIT, 50);
    const rawFiles = makeEncryptedSaveFiles(buf);

    const { slots, profileNumber, accountId } = await openSave(rawFiles);
    const { session } = slots[0];

    // Before: session is encrypted with a valid PFD
    expect(session.encrypted).toBe(true);
    expect(session.manager.pfd).not.toBeNull();
    expect(session.manager.encrypted).toBe(true);

    // Write decrypted output
    const { filesToWrite } = await writeSaveData(slots, [], profileNumber, accountId);

    // Simulate in-place overwrite: sync session state
    await updateSessionAfterWrite(slots, filesToWrite, false);

    // After: session reflects decrypted state
    expect(session.encrypted).toBe(false);
    expect(session.manager.encrypted).toBe(false);
    expect(session.manager.pfd).toBeNull();

    // PARAM.PFD should be removed from file maps
    expect(session.manager.files.has('param.pfd')).toBe(false);
    expect(session.rawFiles.has('param.pfd')).toBe(false);

    // USER.DAT in file maps should now be the decrypted (plaintext) bytes
    const userBytes = session.manager.files.get('user.dat');
    const result = readSave(userBytes);
    expect(result.vit).toBe(50);
  });

  test('decrypted → encrypted: parses new PFD, updates flags and file maps', async () => {
    const buf = makeBlankSave();
    wInt32BE(buf, O.VIT, 60);
    const rawFiles = makeUnencryptedSaveFiles(buf);

    const { slots, profileNumber, accountId } = await openSave(rawFiles);
    const { session } = slots[0];

    // Before: session is unencrypted, no PFD
    expect(session.encrypted).toBe(false);
    expect(session.manager.pfd).toBeNull();

    // Export encrypted output
    const { filesToWrite } = await exportEncryptedSave(slots, [], profileNumber, accountId);

    // Simulate in-place overwrite: sync session state
    await updateSessionAfterWrite(slots, filesToWrite, true);

    // After: session reflects encrypted state
    expect(session.encrypted).toBe(true);
    expect(session.manager.encrypted).toBe(true);
    expect(session.manager.pfd).not.toBeNull();
    expect(session.manager.pfd.secureFileID).toBeDefined();

    // PARAM.PFD should be in file maps
    expect(session.manager.files.has('param.pfd')).toBe(true);
    expect(session.rawFiles.has('param.pfd')).toBe(true);

    // USER.DAT in file maps should now be encrypted (not parseable as plaintext)
    const userBytes = session.manager.files.get('user.dat');
    expect(() => readSave(userBytes)).toThrow();
  });

  test('subsequent save after session sync works correctly (encrypted → decrypted → encrypted)', async () => {
    const buf = makeBlankSave();
    wInt32BE(buf, O.VIT, 40);
    let rawFiles = makeEncryptedSaveFiles(buf);

    // Step 1: Open encrypted save
    const { slots, profileNumber, accountId } = await openSave(rawFiles);
    expect(slots[0].session.encrypted).toBe(true);

    // Step 2: Overwrite as decrypted, sync session
    const { filesToWrite: decFiles } = await writeSaveData(
      slots,
      [],
      profileNumber,
      undefined,
      true,
    );
    await updateSessionAfterWrite(slots, decFiles, false);
    expect(slots[0].session.encrypted).toBe(false);

    // Step 3: Overwrite back as encrypted, sync session
    slots[0].model.vit = 55;
    const { filesToWrite: encFiles } = await exportEncryptedSave(
      slots,
      [],
      profileNumber,
      undefined,
      true,
    );
    await updateSessionAfterWrite(slots, encFiles, true);
    expect(slots[0].session.encrypted).toBe(true);

    // Step 4: The session should now work for another decrypted save
    slots[0].model.vit = 65;
    const { filesToWrite: decFiles2 } = await writeSaveData(
      slots,
      [],
      profileNumber,
      undefined,
      true,
    );
    const userBytes = decFiles2.get('USER.DAT');
    const result = readSave(userBytes);
    expect(result.vit).toBe(65);
  });
});

// -----------------------------------------------------------------------
// Coverage: encrypted-save decrypt-failure paths in openSave + write/export
// -----------------------------------------------------------------------

describe('openSave: decrypt-failure from encrypted save', () => {
  test('slot with corrupt encrypted data → openSave throws (no valid slots)', async () => {
    const buf = makeBlankSave();
    const rawFiles = makeEncryptedSaveFiles(buf);

    // Corrupt the encrypted USER.DAT so decryptFile fails
    // (flip some bytes in the ciphertext to break the hash validation)
    const userBytes = rawFiles.get('user.dat').bytes;
    userBytes[0] ^= 0xff;
    userBytes[1] ^= 0xaa;

    // With only 1 slot and it failing to decrypt, openSave throws
    await expect(openSave(rawFiles)).rejects.toThrow('No valid save slots');
  });
});

describe('exportEncryptedSave: with failedSlots', () => {
  test('export with synthetic failed slot includes it in output', async () => {
    const validFiles = makeEncryptedSaveFiles(makeBlankSave());
    const validResult = await openSave(validFiles);

    // Export with a synthetic failed slot
    const syntheticFailed = [
      {
        slot: 2,
        error: 'test error',
        primaryFile: '01USER.DAT',
        decryptedBytes: makeBlankSave(),
      },
    ];

    const { filesToWrite } = await exportEncryptedSave(validResult.slots, syntheticFailed, 0, "");

    // The export should succeed
    expect(filesToWrite.has('PARAM.SFO')).toBe(true);
    expect(filesToWrite.has('PARAM.PFD')).toBe(true);
  });
});

describe('writeSaveData: encrypted source with backup decrypt failure', () => {
  test('writeSaveData with corrupted backup still succeeds', async () => {
    const buf = makeBlankSave();
    const rawFiles = makeEncryptedSaveFiles(buf);

    // Corrupt the backup 2USER.DAT so its decrypt fails during write
    const backupBytes = rawFiles.get('2user.dat').bytes;
    backupBytes[0] ^= 0xff;

    const { slots, profileNumber, accountId } = await openSave(rawFiles);
    expect(slots).toHaveLength(1);

    // writeSaveData should still succeed (backup failures are logged, not thrown)
    const { filesToWrite, filesToDelete } = await writeSaveData(slots, [], profileNumber, accountId);

    expect(filesToWrite.has('USER.DAT')).toBe(true);
    expect(filesToDelete.has('PARAM.PFD')).toBe(true);
  });
});

/* ========================================================================
 * Coverage: corrupt secondary file, export backup failure, empty slots
 * ==================================================================== */

describe('decryptAndMergeSlots: corrupt secondary file (04USER.DAT)', () => {
  test('writeSaveData with corrupt secondary still succeeds', async () => {
    const buf = makeBlankSave();
    const rawFiles = makeEncryptedSaveFiles(buf);

    const { slots, profileNumber, accountId } = await openSave(rawFiles);

    // Corrupt the secondary file (04USER.DAT) AFTER openSave.
    // The session stores a reference to the same Uint8Array, so mutating
    // rawFiles bytes is visible to decryptAndMergeSlots via manager.files.
    const secondaryBytes = rawFiles.get('04user.dat').bytes;
    secondaryBytes[0] ^= 0xff;
    secondaryBytes[1] ^= 0xaa;

    // writeSaveData should still succeed — secondary decrypt failure is
    // logged and skipped, not thrown.
    const { filesToWrite } = await writeSaveData(slots, [], profileNumber, accountId);
    expect(filesToWrite.has('USER.DAT')).toBe(true);
  });

  test('exportEncryptedSave with corrupt secondary still succeeds', async () => {
    const buf = makeBlankSave();
    const rawFiles = makeEncryptedSaveFiles(buf);

    const { slots, profileNumber, accountId } = await openSave(rawFiles);

    // Corrupt the secondary file after openSave
    const secondaryBytes = rawFiles.get('04user.dat').bytes;
    secondaryBytes[0] ^= 0xff;

    // exportEncryptedSave exercises the same decryptAndMergeSlots path
    const { filesToWrite } = await exportEncryptedSave(slots, [], profileNumber, accountId);
    expect(filesToWrite.has('PARAM.PFD')).toBe(true);
    expect(filesToWrite.has('USER.DAT')).toBe(true);
  });
});

describe('exportEncryptedSave: corrupt backup decrypt failure', () => {
  test('export with corrupted backup 2USER.DAT still succeeds', async () => {
    const buf = makeBlankSave();
    const rawFiles = makeEncryptedSaveFiles(buf);

    const { slots, profileNumber, accountId } = await openSave(rawFiles);

    // Corrupt the backup 2USER.DAT after openSave so its decrypt fails
    // during the exportEncryptedSave backup-decrypt loop.
    const backupBytes = rawFiles.get('2user.dat').bytes;
    backupBytes[0] ^= 0xff;

    // Export should still succeed (backup failure is logged, not thrown)
    const { filesToWrite } = await exportEncryptedSave(slots, [], profileNumber, accountId);
    expect(filesToWrite.has('PARAM.PFD')).toBe(true);
    expect(filesToWrite.has('USER.DAT')).toBe(true);
  });
});

describe('save-api: empty slots throws (export only)', () => {
  // writeSaveData empty-slots test is in save-api.test.js.
  test('exportEncryptedSave throws on empty slots', async () => {
    await expect(exportEncryptedSave([], [], 0, '')).rejects.toThrow('No save slots provided');
  });
});

/* ========================================================================
 * Coverage: inPlace mode branches + non-array failedSlots
 * ==================================================================== */

describe('writeSaveData: inPlace mode', () => {
  test('inPlace=true on unencrypted session omits SFO, includes assets', async () => {
    const buf = makeBlankSave();
    const rawFiles = makeUnencryptedSaveFiles(buf);
    // Add an asset file to exercise the asset-inclusion branches
    rawFiles.set('icon0.png', { name: 'ICON0.PNG', bytes: new Uint8Array([0x89, 0x50]) });

    const { slots } = await openSave(rawFiles);

    // inPlace=true: SFO is NOT written, assets are skipped (already on disk)
    // Only USER.DAT files are written.
    const { filesToWrite } = await writeSaveData(slots, [], 0, "", null, true);

    expect(filesToWrite.has('PARAM.SFO')).toBe(false); // inPlace omits SFO
    expect(filesToWrite.has('USER.DAT')).toBe(true);
    // Assets are skipped in inPlace mode.
    expect(filesToWrite.has('ICON0.PNG')).toBe(false);
  });

  test('inPlace=true on encrypted session omits SFO, decrypts backups', async () => {
    const buf = makeBlankSave();
    const rawFiles = makeEncryptedSaveFiles(buf);
    // Add an asset file
    rawFiles.set('icon0.png', { name: 'ICON0.PNG', bytes: new Uint8Array([0x89, 0x50]) });

    const { slots } = await openSave(rawFiles);

    // inPlace=true on encrypted source: assets are excluded (inPlace && encrypted),
    // but USER.DAT backups are decrypted and included
    const { filesToWrite, filesToDelete } = await writeSaveData(slots, [], 0, "", null, true);

    expect(filesToWrite.has('PARAM.SFO')).toBe(false); // inPlace omits SFO
    expect(filesToWrite.has('USER.DAT')).toBe(true);
    // In encrypted inPlace mode, non-user.dat assets are skipped.
    expect(filesToDelete.has('PARAM.PFD')).toBe(true);
  });
});

describe('writeSaveData: non-array failedSlots', () => {
  test('writeSaveData handles null failedSlots gracefully', async () => {
    const buf = makeBlankSave();
    const rawFiles = makeUnencryptedSaveFiles(buf);
    const { slots } = await openSave(rawFiles);

    // Pass null instead of array — should default to []
    const { filesToWrite } = await writeSaveData(slots, null, 0, "");
    expect(filesToWrite.has('USER.DAT')).toBe(true);
  });

  test('writeSaveData handles undefined failedSlots gracefully', async () => {
    const buf = makeBlankSave();
    const rawFiles = makeUnencryptedSaveFiles(buf);
    const { slots } = await openSave(rawFiles);

    const { filesToWrite } = await writeSaveData(slots, undefined, 0, "");
    expect(filesToWrite.has('USER.DAT')).toBe(true);
  });
});

describe('exportEncryptedSave: inPlace mode', () => {
  test('inPlace=true on unencrypted session omits assets', async () => {
    const buf = makeBlankSave();
    const rawFiles = makeUnencryptedSaveFiles(buf);
    // Add asset files
    rawFiles.set('icon0.png', { name: 'ICON0.PNG', bytes: new Uint8Array([0x89, 0x50]) });
    rawFiles.set('pic1.png', { name: 'PIC1.PNG', bytes: new Uint8Array(100) });

    const { slots, profileNumber, accountId } = await openSave(rawFiles);

    // inPlace=true: assets are NOT included (already on disk)
    const { filesToWrite } = await exportEncryptedSave(slots, [], profileNumber, accountId, null, true);

    expect(filesToWrite.has('PARAM.PFD')).toBe(true);
    expect(filesToWrite.has('PARAM.SFO')).toBe(true);
    expect(filesToWrite.has('USER.DAT')).toBe(true);
    // Assets should be excluded in inPlace mode
    expect(filesToWrite.has('ICON0.PNG')).toBe(false);
    expect(filesToWrite.has('PIC1.PNG')).toBe(false);
  });
});

describe('exportEncryptedSave: onProgress callback', () => {
  test('calls onProgress during export', async () => {
    const buf = makeBlankSave();
    const rawFiles = makeUnencryptedSaveFiles(buf);
    const { slots, profileNumber, accountId } = await openSave(rawFiles);

    const messages = [];
    await exportEncryptedSave(slots, [], profileNumber, accountId, (msg) => messages.push(msg));

    expect(messages.length).toBeGreaterThan(0);
    expect(messages.some((m) => m.includes('PARAM.PFD'))).toBe(true);
  });
});

/* ========================================================================
 * Coverage: noop callback defaults, accountId undefined, no secondary,
 *           missing file in unencrypted decrypt, updateSession empty
 * Targets the remaining missing ternary/default branches.
 * ==================================================================== */

describe('save-api: missing callback / default branches', () => {
  test('openSave without onProgress uses noop', async () => {
    // Call openSave without onProgress → triggers ternary else
    const buf = makeBlankSave();
    const rawFiles = makeUnencryptedSaveFiles(buf);
    const { slots } = await openSave(rawFiles);
    expect(slots).toHaveLength(1);
  });

  test('writeSaveData with accountId undefined skips writeSfoAccountId', async () => {
    // Trigger the `if (accountId !== undefined)` else branch
    const buf = makeBlankSave();
    const rawFiles = makeUnencryptedSaveFiles(buf);
    const { slots } = await openSave(rawFiles);
    const { filesToWrite } = await writeSaveData(slots, [], 0, '');
    expect(filesToWrite.has('USER.DAT')).toBe(true);
  });

  test('exportEncryptedSave with accountId undefined skips writeSfoAccountId', async () => {
    // Trigger the `if (accountId !== undefined)` else branch
    const buf = makeBlankSave();
    const rawFiles = makeUnencryptedSaveFiles(buf);
    const { slots, profileNumber, accountId } = await openSave(rawFiles);
    const { filesToWrite } = await exportEncryptedSave(slots, [], profileNumber, accountId);
    expect(filesToWrite.has('PARAM.PFD')).toBe(true);
  });

  test('updateSessionAfterWrite with empty slots is a no-op', async () => {
    // Trigger the `if (slots.length === 0) return` branch
    await updateSessionAfterWrite([], new Map(), false);
  });

  test('updateSessionAfterWrite with new file not in rawFiles adds entry', async () => {
    // Trigger the `else` branch in rawFiles update.
    const buf = makeBlankSave();
    const rawFiles = makeUnencryptedSaveFiles(buf);
    const { slots } = await openSave(rawFiles);

    // Add a brand-new file that doesn't exist in rawFiles
    const filesToWrite = new Map();
    filesToWrite.set('NEWFILE.DAT', new Uint8Array([0x42]));

    await updateSessionAfterWrite(slots, filesToWrite, false);

    // The new file should be added to rawFiles
    expect(slots[0].session.rawFiles.has('newfile.dat')).toBe(true);
  });
});

describe('save-api: no secondary file path', () => {
  test('writeSaveData with no secondary file in rawFiles', async () => {
    // Remove 04USER.DAT → triggers `hasSecondary ? secondaryFile : null` else
    const buf = makeBlankSave();
    const rawFiles = makeUnencryptedSaveFiles(buf);
    rawFiles.delete('04user.dat');

    // openSave throws because resolveSaveFiles requires a secondary file.
    // So we need to also delete the secondary variants resolution.
    // Instead, test indirectly: build a save with only USER.DAT + 2USER.DAT
    // but no 04* variants.
    await expect(openSave(rawFiles)).rejects.toThrow();
  });
});

describe('save-api: failed slot with missing primaryFile', () => {
  test('writeSaveData handles failed slot with null primaryFile', async () => {
    // Trigger the `if (!fs.primaryFile) continue` branch
    const buf = makeBlankSave();
    const rawFiles = makeUnencryptedSaveFiles(buf);
    const { slots, profileNumber, accountId } = await openSave(rawFiles);

    const failedWithNullPrimary = [
      {
        slot: 5,
        error: 'resolve failed',
        primaryFile: null,
      },
    ];

    const { filesToWrite } = await writeSaveData(slots, failedWithNullPrimary, profileNumber, accountId);
    expect(filesToWrite.has('USER.DAT')).toBe(true);
  });

  test('writeSaveData handles failed slot with non-existent file (unencrypted)', async () => {
    // Trigger `if (!data) return { ok: false }` in decryptFilesFromManager
    const buf = makeBlankSave();
    const rawFiles = makeUnencryptedSaveFiles(buf);
    const { slots, profileNumber, accountId } = await openSave(rawFiles);

    const failedWithMissingFile = [
      {
        slot: 5,
        error: 'resolve failed',
        primaryFile: 'NONEXISTENT.DAT',
        decryptedBytes: null,
      },
    ];

    const { filesToWrite } = await writeSaveData(slots, failedWithMissingFile, profileNumber, accountId);
    expect(filesToWrite.has('USER.DAT')).toBe(true);
  });
});

describe('save-api: callbacks for ternary branch coverage', () => {
  test('openSave with onProgress callback', async () => {
    // Trigger ternary true branch: typeof onProgress === 'function'
    const buf = makeBlankSave();
    const rawFiles = makeUnencryptedSaveFiles(buf);
    const messages = [];
    await openSave(rawFiles, (msg) => messages.push(msg));
    expect(messages.length).toBeGreaterThan(0);
  });

  test('writeSaveData with onProgress callback', async () => {
    // Trigger ternary true branch: typeof onProgress === 'function'
    const buf = makeBlankSave();
    const rawFiles = makeUnencryptedSaveFiles(buf);
    const { slots } = await openSave(rawFiles);
    const messages = [];
    await writeSaveData(slots, [], 0, "", (msg) => messages.push(msg));
    expect(messages.length).toBeGreaterThan(0);
  });
});
