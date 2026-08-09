/**
 * Integration test: Realistic save folder with full rotational variants.
 *
 * Mimics the real BLUS30443DEMONSS005 folder structure with 9 USER.DAT
 * files (2 of 3 rotational variants per slot), PARAM.PFD, PARAM.SFO, and
 * asset files.  Tests that the full save-api pipeline handles real-world
 * folder complexity correctly.
 *
 * Also tests edge cases:
 *   - Stale zeroed-out files alongside active files (resolveRotational)
 *   - Backup variants correctly decrypted/re-encrypted during export
 *   - Full encrypted chain with realistic multi-slot folder
 */
import { openSave, writeSaveData, exportEncryptedSave } from '../js/des-savefile/save-api.js';
import {
  createRealisticSaveFolder,
  createPopulatedUserDat,
  createStaleUserDat,
  createMinimalSfo,
  createSecondaryFile,
  getExpectedModel,
  BUF_SIZE,
} from '../test-fixtures/save-factory.js';
import { createTmpSandbox } from './tmp-sandbox.js';
import { assertModelsMatch } from '../test-fixtures/model-diff.js';

describe('round-trip: realistic folder (full rotational variants)', () => {
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

  /** Write filesToWrite to disk, optionally deleting stale files first. */
  function writeOutputToDisk(sandbox, filesToWrite, filesToDelete) {
    if (filesToDelete) {
      for (const name of filesToDelete) sandbox.deleteFile(name);
    }
    sandbox.writeFiles(filesToWrite);
    return sandbox.readFiles();
  }

  // -------------------------------------------------------------------
  // Full rotational folder (mimics BLUS30443DEMONSS005)
  // -------------------------------------------------------------------

  test('realistic unencrypted folder: 4 slots, 9 USER.DAT files, assets', async () => {
    const sb = newSandbox('realistic-unenc');
    const rawFiles = createRealisticSaveFolder([1, 2, 3, 4], {
      assets: true,
      realisticSfo: true,
    });

    // Verify the folder has the expected file count
    // 4 slots × 2 variants (8) + PARAM.SFO + 04USER.DAT + ICON0.PNG + PIC1.PNG = 12
    expect(rawFiles.size).toBe(12);

    // Write to disk
    writeToDisk(sb, rawFiles);
    const { slots } = await openSave(sb.readFiles());

    // All 4 slots should be loaded
    expect(slots).toHaveLength(4);

    // Verify each slot's data matches the factory model
    for (const slotNum of [1, 2, 3, 4]) {
      const slot = slots.find((s) => s.slot === slotNum);
      expect(slot).toBeDefined();
      assertModelsMatch(slot.model, getExpectedModel(slotNum));
    }

    // Verify files on disk are exactly 256 KB each
    const userDatBytes = sb.readFile('USER.DAT');
    expect(userDatBytes.length).toBe(BUF_SIZE);
  });

  test('realistic encrypted folder: 4 slots, PFD, all files encrypted', async () => {
    const sb = newSandbox('realistic-enc');
    const rawFiles = createRealisticSaveFolder([1, 2, 3, 4], {
      encrypted: true,
      assets: true,
      realisticSfo: true,
    });

    // 4 slots × 2 variants (8) + PARAM.SFO + PARAM.PFD + 04USER.DAT + ICON0.PNG + PIC1.PNG = 13
    expect(rawFiles.size).toBe(13);

    writeToDisk(sb, rawFiles);
    const { slots, encrypted } = await openSave(sb.readFiles());

    expect(encrypted).toBe(true);
    expect(slots).toHaveLength(4);

    for (const slotNum of [1, 2, 3, 4]) {
      assertModelsMatch(slots.find((s) => s.slot === slotNum).model, getExpectedModel(slotNum));
    }
  });

  // -------------------------------------------------------------------
  // Stale zeroed-out file + active file (resolveRotational)
  // -------------------------------------------------------------------

  test('stale 03USER.DAT + active 103USER.DAT: resolver picks active file', async () => {
    const sb = newSandbox('stale-resolve');

    // Build a folder that mimics the real BLUS30443DEMONSS005 bug:
    // Slot 4 has a stale 03USER.DAT (all zeros, deleted char) alongside
    // an active 103USER.DAT.  The resolver must pick 103USER.DAT.
    const files = new Map();
    files.set('param.sfo', { name: 'PARAM.SFO', bytes: createMinimalSfo() });
    files.set('04user.dat', { name: '04USER.DAT', bytes: createSecondaryFile() });

    // Slot 1: USER.DAT + 2USER.DAT (1USER.DAT absent → USER.DAT active)
    const slot1Dat = createPopulatedUserDat(1);
    files.set('user.dat', { name: 'USER.DAT', bytes: slot1Dat });
    files.set('2user.dat', { name: '2USER.DAT', bytes: new Uint8Array(slot1Dat) });

    // Slot 4: stale 03USER.DAT + active 103USER.DAT
    // (203USER.DAT absent → 103USER.DAT is the rotation winner)
    const staleDat = createStaleUserDat(); // all zeros
    const slot4Dat = createPopulatedUserDat(4);
    files.set('03user.dat', { name: '03USER.DAT', bytes: staleDat });
    files.set('103user.dat', { name: '103USER.DAT', bytes: slot4Dat });

    writeToDisk(sb, files);
    const { slots } = await openSave(sb.readFiles());

    // Slot 1 should load fine
    expect(slots.find((s) => s.slot === 1)).toBeDefined();

    // Slot 4 should ALSO load fine — resolver picked 103USER.DAT, not the stale 03USER.DAT
    const slot4 = slots.find((s) => s.slot === 4);
    expect(slot4).toBeDefined();
    expect(slot4.session.primaryFile).toBe('103USER.DAT');
    assertModelsMatch(slot4.model, getExpectedModel(4));
  });

  test('stale file does not corrupt slot 4 data through full chain', async () => {
    const sb = newSandbox('stale-chain');

    // Same setup: stale 03USER.DAT + active 103USER.DAT for slot 4
    const files = new Map();
    files.set('param.sfo', { name: 'PARAM.SFO', bytes: createMinimalSfo() });
    files.set('04user.dat', { name: '04USER.DAT', bytes: createSecondaryFile() });

    const slot1Dat = createPopulatedUserDat(1);
    files.set('user.dat', { name: 'USER.DAT', bytes: slot1Dat });
    files.set('2user.dat', { name: '2USER.DAT', bytes: new Uint8Array(slot1Dat) });

    const staleDat = createStaleUserDat();
    const slot4Dat = createPopulatedUserDat(4);
    files.set('03user.dat', { name: '03USER.DAT', bytes: staleDat });
    files.set('103user.dat', { name: '103USER.DAT', bytes: slot4Dat });

    writeToDisk(sb, files);
    const { slots, profileNumber, accountId } = await openSave(sb.readFiles());

    // Modify slot 4
    const slot4 = slots.find((s) => s.slot === 4);
    slot4.model.vit = 77;
    slot4.model.name = 'StaleTest';

    // Export encrypted
    const { filesToWrite } = await exportEncryptedSave(slots, [], profileNumber, accountId);

    // Re-open
    const sb2 = newSandbox('stale-chain-out');
    const reopened = writeOutputToDisk(sb2, filesToWrite);
    const { slots: readSlots } = await openSave(reopened);

    const readSlot4 = readSlots.find((s) => s.slot === 4);
    expect(readSlot4).toBeDefined();
    expect(readSlot4.model.vit).toBe(77);
    expect(readSlot4.model.name).toBe('StaleTest');
  });

  // -------------------------------------------------------------------
  // Backup variants correctly handled through encrypted export
  // -------------------------------------------------------------------

  test('encrypted export decrypts and re-encrypts all backup variants', async () => {
    const sb = newSandbox('backup-variants');

    // Create an encrypted folder with 2 slots, each with 2 variants
    const rawFiles = createRealisticSaveFolder([1, 2], { encrypted: true });
    writeToDisk(sb, rawFiles);

    const { slots, profileNumber, accountId } = await openSave(sb.readFiles());

    // Export encrypted — this should decrypt all backup USER.DAT files
    // (including 2USER.DAT, 201USER.DAT) and re-encrypt them with the new PFD
    const { filesToWrite } = await exportEncryptedSave(slots, [], profileNumber, accountId);

    // All USER.DAT variants must be in the output
    const expectedFiles = [
      'USER.DAT',
      '2USER.DAT', // slot 1
      '01USER.DAT',
      '201USER.DAT', // slot 2
      '04USER.DAT', // secondary
    ];
    for (const name of expectedFiles) {
      expect(filesToWrite.has(name)).toBe(true);
    }

    // Backup files must be encrypted (different from plaintext)
    const backupEnc = filesToWrite.get('2USER.DAT');
    const backupOrig = rawFiles.get('2user.dat').bytes;
    // The re-encrypted output should differ from the original encrypted input
    // (different PFD → different encryption)
    let differs = false;
    const minLen = Math.min(backupEnc.length, backupOrig.length);
    for (let i = 0; i < minLen; i++) {
      if (backupEnc[i] !== backupOrig[i]) {
        differs = true;
        break;
      }
    }
    expect(differs).toBe(true);

    // Re-open the exported folder — backup data should be intact
    const sb2 = newSandbox('backup-variants-out');
    const reopened = writeOutputToDisk(sb2, filesToWrite);
    const { slots: readSlots, encrypted } = await openSave(reopened);

    expect(encrypted).toBe(true);
    expect(readSlots).toHaveLength(2);
    assertModelsMatch(readSlots.find((s) => s.slot === 1).model, getExpectedModel(1));
    assertModelsMatch(readSlots.find((s) => s.slot === 2).model, getExpectedModel(2));
  });

  // -------------------------------------------------------------------
  // Full encrypted chain with realistic 4-slot folder
  // -------------------------------------------------------------------

  test('full chain: realistic encrypted 4-slot → modify → export → re-open', async () => {
    const sb1 = newSandbox('full-chain-1');

    // Create realistic encrypted folder with all 4 slots + assets
    const rawFiles = createRealisticSaveFolder([1, 2, 3, 4], {
      encrypted: true,
      assets: true,
      realisticSfo: true,
    });
    writeToDisk(sb1, rawFiles);

    // Step 1: Open encrypted
    const {
      slots: s1,
      profileNumber: p1,
      encrypted: e1,
      accountId: a1,
    } = await openSave(sb1.readFiles());
    expect(e1).toBe(true);
    expect(s1).toHaveLength(4);

    // Modify all slots
    for (const slot of s1) {
      slot.model.vit = slot.slot * 100;
      slot.model.souls = slot.slot * 10000;
      slot.model.name = `Slot${slot.slot}Mod`;
    }

    // Step 2: Export encrypted
    const { filesToWrite: encOut } = await exportEncryptedSave(s1, [], p1, a1);

    // Step 3: Write to disk and re-open
    const sb2 = newSandbox('full-chain-2');
    const reopened = writeOutputToDisk(sb2, encOut);
    const { slots: s2, encrypted: e2 } = await openSave(reopened);

    expect(e2).toBe(true);
    expect(s2).toHaveLength(4);

    // Verify all modifications survived across all slots
    for (const slotNum of [1, 2, 3, 4]) {
      const slot = s2.find((s) => s.slot === slotNum);
      expect(slot.model.vit).toBe(slotNum * 100);
      expect(slot.model.souls).toBe(slotNum * 10000);
      expect(slot.model.name).toBe(`Slot${slotNum}Mod`);
    }

    // Verify assets survived
    const iconBytes = sb2.readFile('ICON0.PNG');
    expect(iconBytes[0]).toBe(0x89);
  });

  // -------------------------------------------------------------------
  // Unencrypted realistic folder → write decrypted → re-open
  // -------------------------------------------------------------------

  test('realistic unencrypted → writeSaveData → re-open (all slots preserved)', async () => {
    const sb = newSandbox('real-unenc-write');
    const rawFiles = createRealisticSaveFolder([1, 2, 3]);
    writeToDisk(sb, rawFiles);

    const { slots, profileNumber, accountId } = await openSave(sb.readFiles());

    // Modify
    slots.find((s) => s.slot === 1).model.name = 'Alpha';
    slots.find((s) => s.slot === 2).model.name = 'Beta';
    slots.find((s) => s.slot === 3).model.name = 'Gamma';

    const { filesToWrite } = await writeSaveData(slots, [], profileNumber, accountId);
    const reopened = writeOutputToDisk(sb, filesToWrite);
    const { slots: readSlots } = await openSave(reopened);

    expect(readSlots).toHaveLength(3);
    expect(readSlots.find((s) => s.slot === 1).model.name).toBe('Alpha');
    expect(readSlots.find((s) => s.slot === 2).model.name).toBe('Beta');
    expect(readSlots.find((s) => s.slot === 3).model.name).toBe('Gamma');
  });

  // -------------------------------------------------------------------
  // File size verification (256 KB per USER.DAT)
  // -------------------------------------------------------------------

  test('USER.DAT files are exactly 256 KB (0x40000 bytes)', async () => {
    const sb = newSandbox('file-size');
    const rawFiles = createRealisticSaveFolder([1], { encrypted: true });
    writeToDisk(sb, rawFiles);

    // Check file sizes on disk
    const userDat = sb.readFile('USER.DAT');
    expect(userDat.length).toBe(0x40000);

    const backupDat = sb.readFile('2USER.DAT');
    expect(backupDat.length).toBe(0x40000);

    const secondaryDat = sb.readFile('04USER.DAT');
    expect(secondaryDat.length).toBe(0x800);
  });
});
