/**
 * Integration test: Round-trip across all save format combinations.
 *
 * Tests that save data survives transitions between encrypted, decrypted,
 * zipped, and unzipped states — including multi-step chains.
 *
 * Every test writes files to a real tmp directory on disk, reads them
 * back, and passes through the full save-api pipeline.
 */
import {
  openSave,
  writeSaveData,
  exportEncryptedSave,
  updateSessionAfterWrite,
} from '../js/des-savefile/save-api.js';
import { readSave } from '../js/des-savefile/reader.js';
import { zipSync, unzipSync } from 'fflate';
import {
  createUnencryptedSaveFolder,
  createEncryptedSaveFolder,
  getExpectedModel,
  toRawFilesFormat,
} from './helpers/save-factory.js';
import { createTmpSandbox } from './helpers/tmp-sandbox.js';
import { assertModelsMatch } from './helpers/model-diff.js';

describe('round-trip: format combinations (encrypted/decrypted/zip)', () => {
  /** @type {ReturnType<typeof createTmpSandbox>[]} */
  const sandboxes = [];

  afterEach(async () => {
    await Promise.all(sandboxes.map((s) => s.cleanup()));
    sandboxes.length = 0;
  });

  /** Create a tmp sandbox and track it for cleanup. */
  function newSandbox(label) {
    const sb = createTmpSandbox(label);
    sandboxes.push(sb);
    return sb;
  }

  /** Write rawFiles to disk and return the on-disk rawFiles map. */
  function writeToDisk(sandbox, rawFiles) {
    for (const [, entry] of rawFiles) {
      sandbox.writeFile(entry.name, entry.bytes);
    }
    return sandbox.readFiles();
  }

  /**
   * Write filesToWrite (Map<string, Uint8Array>) to disk and read back.
   * If filesToDelete is provided, removes those files from disk first
   * (simulating what the UI layer does when switching encrypted → decrypted).
   */
  function writeOutputToDisk(sandbox, filesToWrite, filesToDelete) {
    if (filesToDelete) {
      for (const name of filesToDelete) {
        sandbox.deleteFile(name);
      }
    }
    sandbox.writeFiles(filesToWrite);
    return sandbox.readFiles();
  }

  // -------------------------------------------------------------------
  // Unencrypted → writeSaveData → decrypted on disk
  // -------------------------------------------------------------------

  test('unencrypted → writeSaveData → decrypted (fields preserved)', async () => {
    const sb = newSandbox('unenc-write');
    const rawFiles = createUnencryptedSaveFolder([1]);
    const onDisk = writeToDisk(sb, rawFiles);

    const { slots, profileNumber } = await openSave(onDisk);

    slots[0].model.vit = 75;
    slots[0].model.souls = 50000;
    slots[0].model.name = 'Written';

    const { filesToWrite, encrypted } = await writeSaveData(slots, [], profileNumber);
    expect(encrypted).toBe(false);

    const reopened = writeOutputToDisk(sb, filesToWrite);
    const { slots: readSlots } = await openSave(reopened);

    const expected = {
      ...getExpectedModel(1),
      vit: 75,
      souls: 50000,
      name: 'Written',
    };
    assertModelsMatch(readSlots[0].model, expected);
  });

  // -------------------------------------------------------------------
  // Unencrypted → exportEncryptedSave → encrypted on disk → re-open
  // -------------------------------------------------------------------

  test('unencrypted → exportEncrypted → re-open encrypted (fields preserved)', async () => {
    const sb = newSandbox('unenc-to-enc');
    const rawFiles = createUnencryptedSaveFolder([1]);
    const onDisk = writeToDisk(sb, rawFiles);

    const { slots, profileNumber } = await openSave(onDisk);
    expect(slots[0].session.encrypted).toBe(false);

    slots[0].model.vit = 88;
    slots[0].model.name = 'Encrypted';

    const { filesToWrite, encrypted } = await exportEncryptedSave(slots, [], profileNumber);
    expect(encrypted).toBe(true);
    expect(filesToWrite.has('PARAM.PFD')).toBe(true);

    const reopened = writeOutputToDisk(sb, filesToWrite);
    const { slots: readSlots, encrypted: readEnc } = await openSave(reopened);

    expect(readEnc).toBe(true);
    const expected = {
      ...getExpectedModel(1),
      vit: 88,
      name: 'Encrypted',
    };
    assertModelsMatch(readSlots[0].model, expected);
  });

  // -------------------------------------------------------------------
  // Encrypted source → writeSaveData → decrypted on disk
  // -------------------------------------------------------------------

  test('encrypted → writeSaveData → decrypted (fields preserved)', async () => {
    const sb = newSandbox('enc-write');
    const rawFiles = createEncryptedSaveFolder([1]);
    const onDisk = writeToDisk(sb, rawFiles);

    const { slots, profileNumber, encrypted } = await openSave(onDisk);
    expect(encrypted).toBe(true);

    slots[0].model.vit = 65;
    slots[0].model.souls = 30000;

    const {
      filesToWrite,
      encrypted: outEnc,
      filesToDelete,
    } = await writeSaveData(slots, [], profileNumber);
    expect(outEnc).toBe(false);
    expect(filesToDelete.has('PARAM.PFD')).toBe(true);

    // Delete stale PFD then write decrypted output to disk
    const reopened = writeOutputToDisk(sb, filesToWrite, filesToDelete);
    const { slots: readSlots, encrypted: readEnc } = await openSave(reopened);

    expect(readEnc).toBe(false);
    const expected = {
      ...getExpectedModel(1),
      vit: 65,
      souls: 30000,
    };
    assertModelsMatch(readSlots[0].model, expected);
  });

  // -------------------------------------------------------------------
  // Encrypted source → exportEncryptedSave → encrypted on disk → re-open
  // -------------------------------------------------------------------

  test('encrypted → exportEncrypted → re-open encrypted (fields preserved)', async () => {
    const sb = newSandbox('enc-to-enc');
    const rawFiles = createEncryptedSaveFolder([1]);
    const onDisk = writeToDisk(sb, rawFiles);

    const { slots, profileNumber } = await openSave(onDisk);

    slots[0].model.vit = 91;
    slots[0].model.name = 'ReEnc';

    const { filesToWrite, encrypted } = await exportEncryptedSave(slots, [], profileNumber);
    expect(encrypted).toBe(true);

    const reopened = writeOutputToDisk(sb, filesToWrite);
    const { slots: readSlots } = await openSave(reopened);

    const expected = {
      ...getExpectedModel(1),
      vit: 91,
      name: 'ReEnc',
    };
    assertModelsMatch(readSlots[0].model, expected);
  });

  // -------------------------------------------------------------------
  // ZIP round-trip: build zip → unzip → open
  // -------------------------------------------------------------------

  test('unencrypted → zip → unzip → open (fields preserved)', async () => {
    const sb = newSandbox('zip-unenc');
    const rawFiles = createUnencryptedSaveFolder([1]);
    writeToDisk(sb, rawFiles);

    const diskFiles = sb.readFiles();
    const zipObj = {};
    for (const [, { name, bytes }] of diskFiles) {
      zipObj[name] = bytes;
    }
    const zipBytes = zipSync(zipObj, { level: 6 });

    sb.writeFile('save.zip', zipBytes);
    const zipOnDisk = sb.readFile('save.zip');
    const extracted = unzipSync(zipOnDisk);

    const reopenedFiles = new Map();
    for (const [name, bytes] of Object.entries(extracted)) {
      reopenedFiles.set(name.toLowerCase(), { name, bytes: new Uint8Array(bytes) });
    }

    const { slots } = await openSave(reopenedFiles);
    assertModelsMatch(slots[0].model, getExpectedModel(1));
  });

  test('encrypted → zip → unzip → open (fields preserved)', async () => {
    const sb = newSandbox('zip-enc');
    const rawFiles = createEncryptedSaveFolder([1]);
    writeToDisk(sb, rawFiles);

    const diskFiles = sb.readFiles();
    const zipObj = {};
    for (const [, { name, bytes }] of diskFiles) {
      zipObj[name] = bytes;
    }
    const zipBytes = zipSync(zipObj, { level: 6 });

    sb.writeFile('save.zip', zipBytes);
    const zipOnDisk = sb.readFile('save.zip');
    const extracted = unzipSync(zipOnDisk);

    const reopenedFiles = new Map();
    for (const [name, bytes] of Object.entries(extracted)) {
      reopenedFiles.set(name.toLowerCase(), { name, bytes: new Uint8Array(bytes) });
    }

    const { slots, encrypted } = await openSave(reopenedFiles);
    expect(encrypted).toBe(true);
    assertModelsMatch(slots[0].model, getExpectedModel(1));
  });

  // -------------------------------------------------------------------
  // Full chain: unencrypted → encrypted → decrypted
  // -------------------------------------------------------------------

  test('chain: unencrypted → export encrypted → open → write decrypted', async () => {
    const sb1 = newSandbox('chain-ue-1');
    const sb2 = newSandbox('chain-ue-2');

    const rawFiles1 = createUnencryptedSaveFolder([1]);
    writeToDisk(sb1, rawFiles1);
    const { slots: s1, profileNumber: p1 } = await openSave(sb1.readFiles());

    s1[0].model.vit = 70;

    const { filesToWrite: encOut } = await exportEncryptedSave(s1, [], p1);
    writeToDisk(sb2, toRawFilesFormat(encOut));

    const { slots: s2, profileNumber: p2, encrypted: e2 } = await openSave(sb2.readFiles());
    expect(e2).toBe(true);
    expect(s2[0].model.vit).toBe(70);

    s2[0].model.vit = 80;

    const {
      filesToWrite: decOut,
      encrypted: decEnc,
      filesToDelete: decDel,
    } = await writeSaveData(s2, [], p2);

    expect(decEnc).toBe(false);
    expect(decDel.has('PARAM.PFD')).toBe(true);

    const sb3 = newSandbox('chain-ue-3');
    const reopened = writeOutputToDisk(sb3, decOut, decDel);
    const { slots: s3 } = await openSave(reopened);

    expect(s3[0].model.vit).toBe(80);
    expect(s3[0].model.souls).toBe(getExpectedModel(1).souls);
  });

  // -------------------------------------------------------------------
  // Full chain: encrypted → decrypted → encrypted
  // -------------------------------------------------------------------

  test('chain: encrypted → write decrypted → open → export encrypted', async () => {
    const sb1 = newSandbox('chain-eu-1');
    const sb2 = newSandbox('chain-eu-2');

    const rawFiles1 = createEncryptedSaveFolder([1]);
    writeToDisk(sb1, rawFiles1);
    const { slots: s1, profileNumber: p1, encrypted: e1 } = await openSave(sb1.readFiles());
    expect(e1).toBe(true);

    s1[0].model.vit = 55;

    const { filesToWrite: decOut, filesToDelete: decDel } = await writeSaveData(s1, [], p1);
    // Write decrypted output (delete PFD from the target sandbox)
    const decRaw = toRawFilesFormat(decOut);
    for (const [, entry] of decRaw) {
      sb2.writeFile(entry.name, entry.bytes);
    }
    if (decDel) {
      for (const name of decDel) sb2.deleteFile(name);
    }

    const { slots: s2, profileNumber: p2, encrypted: e2 } = await openSave(sb2.readFiles());
    expect(e2).toBe(false);
    expect(s2[0].model.vit).toBe(55);

    s2[0].model.vit = 65;

    const { filesToWrite: encOut, encrypted: encEnc } = await exportEncryptedSave(s2, [], p2);
    expect(encEnc).toBe(true);

    const sb3 = newSandbox('chain-eu-3');
    const reopened = writeOutputToDisk(sb3, encOut);
    const { slots: s3, encrypted: e3 } = await openSave(reopened);

    expect(e3).toBe(true);
    expect(s3[0].model.vit).toBe(65);
  });

  // -------------------------------------------------------------------
  // In-place write + session sync
  // -------------------------------------------------------------------

  test('in-place write: encrypted → decrypted + updateSession → subsequent save', async () => {
    const sb = newSandbox('inplace-ed');
    const rawFiles = createEncryptedSaveFolder([1]);
    writeToDisk(sb, rawFiles);

    const { slots, profileNumber } = await openSave(sb.readFiles());
    expect(slots[0].session.encrypted).toBe(true);

    slots[0].model.vit = 60;

    const { filesToWrite: decFiles } = await writeSaveData(slots, [], profileNumber, null, true);
    await updateSessionAfterWrite(slots, decFiles, false);

    expect(slots[0].session.encrypted).toBe(false);

    slots[0].model.vit = 70;
    const { filesToWrite: decFiles2 } = await writeSaveData(slots, [], profileNumber, null, true);
    const userBytes = decFiles2.get('USER.DAT');
    const result = readSave(userBytes);
    expect(result.vit).toBe(70);
  });

  test('in-place write: decrypted → encrypted + updateSession → subsequent save', async () => {
    const sb = newSandbox('inplace-de');
    const rawFiles = createUnencryptedSaveFolder([1]);
    writeToDisk(sb, rawFiles);

    const { slots, profileNumber } = await openSave(sb.readFiles());
    expect(slots[0].session.encrypted).toBe(false);

    slots[0].model.vit = 44;

    const { filesToWrite: encFiles } = await exportEncryptedSave(
      slots,
      [],
      profileNumber,
      null,
      true,
    );
    await updateSessionAfterWrite(slots, encFiles, true);

    expect(slots[0].session.encrypted).toBe(true);
    expect(slots[0].session.manager.pfd).not.toBeNull();

    slots[0].model.vit = 54;
    const { filesToWrite: encFiles2 } = await exportEncryptedSave(
      slots,
      [],
      profileNumber,
      null,
      true,
    );

    const sb2 = newSandbox('inplace-de-verify');
    const reopened = writeOutputToDisk(sb2, encFiles2);
    const { slots: readSlots } = await openSave(reopened);
    expect(readSlots[0].model.vit).toBe(54);
  });

  // -------------------------------------------------------------------
  // Multiple operations from same session
  // -------------------------------------------------------------------

  test('multiple saves from same session preserve data integrity', async () => {
    const sb = newSandbox('multi-save');
    const rawFiles = createEncryptedSaveFolder([1]);
    writeToDisk(sb, rawFiles);

    const { slots, profileNumber } = await openSave(sb.readFiles());

    const { filesToWrite: encOut } = await exportEncryptedSave(slots, [], profileNumber);
    expect(encOut.has('USER.DAT')).toBe(true);

    const { filesToWrite: decOut } = await writeSaveData(slots, [], profileNumber);
    expect(decOut.has('USER.DAT')).toBe(true);

    const userBytes = decOut.get('USER.DAT');
    const result = readSave(userBytes);
    expect(result.vit).toBe(getExpectedModel(1).vit);
  });

  // -------------------------------------------------------------------
  // Zipped encrypted export: full pipeline
  // -------------------------------------------------------------------

  test('exportEncryptedSave → zip → unzip → open (full pipeline)', async () => {
    const sb = newSandbox('zip-export');
    const rawFiles = createUnencryptedSaveFolder([1]);
    writeToDisk(sb, rawFiles);

    const { slots, profileNumber } = await openSave(sb.readFiles());

    slots[0].model.vit = 33;
    slots[0].model.name = 'ZipExport';

    const { filesToWrite } = await exportEncryptedSave(slots, [], profileNumber);

    const zipObj = {};
    for (const [name, bytes] of filesToWrite) {
      zipObj[name] = bytes;
    }
    const zipBytes = zipSync(zipObj, { level: 6 });

    sb.writeFile('export.zip', zipBytes);
    const zipOnDisk = sb.readFile('export.zip');
    const extracted = unzipSync(zipOnDisk);

    const reopenedFiles = new Map();
    for (const [name, bytes] of Object.entries(extracted)) {
      reopenedFiles.set(name.toLowerCase(), { name, bytes: new Uint8Array(bytes) });
    }

    const { slots: readSlots, encrypted } = await openSave(reopenedFiles);
    expect(encrypted).toBe(true);

    const expected = {
      ...getExpectedModel(1),
      vit: 33,
      name: 'ZipExport',
    };
    assertModelsMatch(readSlots[0].model, expected);
  });

  // -------------------------------------------------------------------
  // Assets preserved through format transitions
  // -------------------------------------------------------------------

  test('assets preserved through unencrypted → encrypted export', async () => {
    const sb = newSandbox('assets-enc');
    const rawFiles = createUnencryptedSaveFolder([1], { assets: true });
    writeToDisk(sb, rawFiles);

    const { slots, profileNumber } = await openSave(sb.readFiles());

    const { filesToWrite } = await exportEncryptedSave(slots, [], profileNumber);

    expect(filesToWrite.has('ICON0.PNG')).toBe(true);
    expect(filesToWrite.has('PIC1.PNG')).toBe(true);

    const iconBytes = filesToWrite.get('ICON0.PNG');
    expect(iconBytes[0]).toBe(0x89);
  });

  test('assets preserved through encrypted → decrypted write', async () => {
    const sb = newSandbox('assets-dec');
    const rawFiles = createEncryptedSaveFolder([1], { assets: true });
    writeToDisk(sb, rawFiles);

    const { slots, profileNumber } = await openSave(sb.readFiles());

    const { filesToWrite } = await writeSaveData(slots, [], profileNumber);

    expect(filesToWrite.has('ICON0.PNG')).toBe(true);
    expect(filesToWrite.has('PIC1.PNG')).toBe(true);
  });

  // -------------------------------------------------------------------
  // No-op round-trip preserves all fields (encrypted source)
  // -------------------------------------------------------------------

  test('encrypted no-op: export encrypted → re-open → all fields preserved', async () => {
    const sb = newSandbox('enc-noop');
    const rawFiles = createEncryptedSaveFolder([1]);
    writeToDisk(sb, rawFiles);

    const { slots, profileNumber } = await openSave(sb.readFiles());

    const { filesToWrite } = await exportEncryptedSave(slots, [], profileNumber);
    const sb2 = newSandbox('enc-noop-2');
    // Delete any stale PFD from the fresh sandbox before writing
    const reopened = writeOutputToDisk(sb2, filesToWrite);

    const { slots: readSlots } = await openSave(reopened);
    assertModelsMatch(readSlots[0].model, getExpectedModel(1));
  });

  // -------------------------------------------------------------------
  // Multi-slot encrypted round-trip
  // -------------------------------------------------------------------

  test('multi-slot encrypted → export encrypted → re-open (all slots preserved)', async () => {
    const sb = newSandbox('multi-enc');
    const rawFiles = createEncryptedSaveFolder([1, 2]);
    writeToDisk(sb, rawFiles);

    const { slots, profileNumber } = await openSave(sb.readFiles());
    expect(slots).toHaveLength(2);

    slots.find((s) => s.slot === 1).model.vit = 11;
    slots.find((s) => s.slot === 2).model.vit = 22;

    const { filesToWrite } = await exportEncryptedSave(slots, [], profileNumber);

    const sb2 = newSandbox('multi-enc-out');
    const reopened = writeOutputToDisk(sb2, filesToWrite);
    const { slots: readSlots } = await openSave(reopened);

    expect(readSlots).toHaveLength(2);
    expect(readSlots.find((s) => s.slot === 1).model.vit).toBe(11);
    expect(readSlots.find((s) => s.slot === 2).model.vit).toBe(22);
  });

  // -------------------------------------------------------------------
  // filesToDelete: encrypted → decrypted signals PFD deletion
  // -------------------------------------------------------------------

  test('encrypted → decrypted write returns PARAM.PFD in filesToDelete', async () => {
    const sb = newSandbox('del-pfd');
    const rawFiles = createEncryptedSaveFolder([1]);
    writeToDisk(sb, rawFiles);

    const { slots, profileNumber } = await openSave(sb.readFiles());

    const { filesToDelete, encrypted } = await writeSaveData(slots, [], profileNumber);

    expect(encrypted).toBe(false);
    expect(filesToDelete.has('PARAM.PFD')).toBe(true);
    expect(filesToDelete.size).toBe(1);
  });

  test('unencrypted → decrypted write has empty filesToDelete', async () => {
    const sb = newSandbox('no-del');
    const rawFiles = createUnencryptedSaveFolder([1]);
    writeToDisk(sb, rawFiles);

    const { slots, profileNumber } = await openSave(sb.readFiles());

    const { filesToDelete } = await writeSaveData(slots, [], profileNumber);
    expect(filesToDelete.size).toBe(0);
  });

  // -------------------------------------------------------------------
  // PFD presence/absence in output
  // -------------------------------------------------------------------

  test('decrypted output does not contain PARAM.PFD', async () => {
    const sb = newSandbox('no-pfd-out');
    const rawFiles = createEncryptedSaveFolder([1]);
    writeToDisk(sb, rawFiles);

    const { slots, profileNumber } = await openSave(sb.readFiles());

    const { filesToWrite } = await writeSaveData(slots, [], profileNumber);
    expect(filesToWrite.has('PARAM.PFD')).toBe(false);
  });

  test('encrypted output contains valid PARAM.PFD', async () => {
    const sb = newSandbox('has-pfd');
    const rawFiles = createUnencryptedSaveFolder([1]);
    writeToDisk(sb, rawFiles);

    const { slots, profileNumber } = await openSave(sb.readFiles());

    const { filesToWrite } = await exportEncryptedSave(slots, [], profileNumber);

    expect(filesToWrite.has('PARAM.PFD')).toBe(true);
    const pfdBytes = filesToWrite.get('PARAM.PFD');
    expect(pfdBytes.length).toBeGreaterThan(100);
    expect(pfdBytes[0]).toBe(0x00);
  });
});
