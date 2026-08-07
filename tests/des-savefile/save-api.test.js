/**
 * Tests for the saveApi gateway — resolveSaveFiles, slotExists, open/write flows
 * with unencrypted saves, and multi-slot loading/saving.
 *
 * Encryption-related tests are in save-api-encrypted.test.js.
 */
import {
  resolveSaveFiles,
  slotExists,
  openSave,
  writeSaveData,
  getLimits,
  reloadSlotModels,
} from '../../js/des-savefile/save-api.js';
import { readSave } from '../../js/des-savefile/reader.js';
import { writeSave } from '../../js/des-savefile/writer.js';
import { wInt32BE } from '../../js/lib/ps3-save-lib/index.js';
import * as O from '../../js/des-savefile/offsets.js';
import {
  makeBlankSave,
  makeSfo,
  makeSecondary,
  makeUnencryptedSaveFiles,
  makeMultiSlotFiles,
} from './helpers.js';

describe('resolveSaveFiles', () => {
  // Stale zeroed-out file from a deleted character must NOT be selected when
  // the real active file also exists. The rotation logic picks the active
  // file by absence-of-successor, not by first-existing.
  // Real-world case: BLUS30443DEMONSS005 had 03USER.DAT (all zeros) +
  // 103USER.DAT (active) on disk; first-match logic would pick the zeroed
  // file and fail to load slot 4.
  test('slot 4: stale 03USER.DAT + active 103USER.DAT → picks 103USER.DAT', () => {
    const files = new Map([
      ['03user.dat', { name: '03USER.DAT' }], // stale (deleted char)
      ['103user.dat', { name: '103USER.DAT' }], // active
      // 203USER.DAT absent → 103USER.DAT is the rotation winner
      ['104user.dat', { name: '104USER.DAT' }],
    ]);
    const { primary } = resolveSaveFiles(files, 4);
    expect(primary).toBe('103USER.DAT');
  });

  test('slot 1: stale USER.DAT + active 1USER.DAT → picks 1USER.DAT', () => {
    const files = new Map([
      ['user.dat', { name: 'USER.DAT' }], // stale (deleted char)
      ['1user.dat', { name: '1USER.DAT' }], // active
      // 2USER.DAT absent → 1USER.DAT is the rotation winner
      ['04user.dat', { name: '04USER.DAT' }],
    ]);
    const { primary } = resolveSaveFiles(files, 1);
    expect(primary).toBe('1USER.DAT');
  });

  test('all three variants present → falls back to first (USER.DAT)', () => {
    const files = new Map([
      ['user.dat', { name: 'USER.DAT' }],
      ['1user.dat', { name: '1USER.DAT' }],
      ['2user.dat', { name: '2USER.DAT' }],
      ['04user.dat', { name: '04USER.DAT' }],
    ]);
    // When all three variants exist, pick the first (USER.DAT) deterministically.
    const { primary } = resolveSaveFiles(files, 1);
    expect(primary).toBe('USER.DAT');
  });

  test('slot 1: only USER.DAT present (2 missing) → fallback to existing', () => {
    const files = new Map([
      ['user.dat', { name: 'USER.DAT' }],
      ['04user.dat', { name: '04USER.DAT' }], // secondary also present
    ]);
    const { primary } = resolveSaveFiles(files, 1);
    // When 2 of 3 variants are missing, fallback picks the first existing
    expect(primary).toBe('USER.DAT');
  });

  test('slot 2: only 01USER.DAT present (2 missing) → fallback to existing', () => {
    const files = new Map([
      ['01user.dat', { name: '01USER.DAT' }],
      ['04user.dat', { name: '04USER.DAT' }], // secondary also present
    ]);
    const { primary } = resolveSaveFiles(files, 2);
    expect(primary).toBe('01USER.DAT');
  });

  test('secondary: only 04USER.DAT present (2 missing) → fallback to existing', () => {
    const files = new Map([
      ['04user.dat', { name: '04USER.DAT' }],
      ['user.dat', { name: 'USER.DAT' }], // primary also present
    ]);
    const { secondary } = resolveSaveFiles(files, 1);
    expect(secondary).toBe('04USER.DAT');
  });
});

describe('slotExists', () => {
  test('returns true when slot 1 primary exists', () => {
    const files = new Map([['user.dat', { name: 'USER.DAT' }]]);
    expect(slotExists(files, 1)).toBe(true);
  });

  test('returns false when slot 1 primary is absent', () => {
    const files = new Map([['01user.dat', { name: '01USER.DAT' }]]);
    expect(slotExists(files, 1)).toBe(false);
  });

  test('returns true for slot 2 primary', () => {
    const files = new Map([['01user.dat', { name: '01USER.DAT' }]]);
    expect(slotExists(files, 2)).toBe(true);
  });

  test('returns false for slot 3 when not present', () => {
    const files = new Map([['user.dat', { name: 'USER.DAT' }]]);
    expect(slotExists(files, 3)).toBe(false);
  });
});

describe('openSave (unencrypted, single slot)', () => {
  test('opens and returns sanitized model', async () => {
    const buf = makeBlankSave();
    wInt32BE(buf, O.VIT, 50);
    wInt32BE(buf, O.SOULS, 99999);
    const rawFiles = makeUnencryptedSaveFiles(buf);

    const result = await openSave(rawFiles);

    expect(result.encrypted).toBe(false);
    expect(result.profileNumber).toBe(42);
    expect(result.slots).toHaveLength(1);
    expect(result.slots[0].slot).toBe(1);

    const model = result.slots[0].model;
    expect(model.vit).toBe(50);
    expect(model.souls).toBe(99999);

    // Verify model is sanitized — _slot (binary internal) is stripped.
    // (idx1/misc1/idx2/misc2 are editable UI fields and ARE present.)
    for (const w of model.weapons) {
      expect(w).not.toHaveProperty('_slot');
      expect(w).not.toHaveProperty('unknown1');
    }
    // Deposit items carry unknown1/sortOrder/flags as hidden data (not _ref)
    for (const d of model.deposit) {
      expect(d).not.toHaveProperty('_ref');
    }

    // Session should contain the full model with binary internals
    expect(result.slots[0].session.fullModel).toBeDefined();
    expect(result.slots[0].session.primaryFile).toBeDefined();
  });

  test('throws on missing PARAM.SFO', async () => {
    const rawFiles = new Map();
    await expect(openSave(rawFiles)).rejects.toThrow('PARAM.SFO');
  });

  test('throws when no valid slots exist', async () => {
    const rawFiles = new Map();
    rawFiles.set('param.sfo', { name: 'PARAM.SFO', bytes: makeSfo() });
    rawFiles.set('04user.dat', { name: '04USER.DAT', bytes: makeSecondary() });
    await expect(openSave(rawFiles)).rejects.toThrow('No valid save slots');
  });
});

describe('openSave (multi-slot)', () => {
  test('loads multiple slots (1, 2, 3)', async () => {
    const rawFiles = makeMultiSlotFiles([1, 2, 3], (slot) => {
      const buf = makeBlankSave();
      wInt32BE(buf, O.VIT, slot * 10);
      wInt32BE(buf, O.SOULS, slot * 1000);
      return buf;
    });

    const { slots } = await openSave(rawFiles);

    expect(slots).toHaveLength(3);

    const slot1 = slots.find((s) => s.slot === 1);
    const slot2 = slots.find((s) => s.slot === 2);
    const slot3 = slots.find((s) => s.slot === 3);

    expect(slot1.model.vit).toBe(10);
    expect(slot1.model.souls).toBe(1000);
    expect(slot2.model.vit).toBe(20);
    expect(slot2.model.souls).toBe(2000);
    expect(slot3.model.vit).toBe(30);
    expect(slot3.model.souls).toBe(3000);
  });

  test('loads slot 4 only', async () => {
    const rawFiles = makeMultiSlotFiles([4], () => {
      const buf = makeBlankSave();
      wInt32BE(buf, O.VIT, 99);
      return buf;
    });

    const { slots } = await openSave(rawFiles);
    expect(slots).toHaveLength(1);
    expect(slots[0].slot).toBe(4);
    expect(slots[0].model.vit).toBe(99);
  });

  test('skips corrupt slot but loads others, and reports failure', async () => {
    const rawFiles = makeMultiSlotFiles([1, 2], (slot) => {
      const buf = makeBlankSave();
      wInt32BE(buf, O.VIT, slot * 10);
      return buf;
    });

    // Corrupt slot 2 by zeroing the sanity check
    const slot2Buf = rawFiles.get('01user.dat').bytes;
    wInt32BE(slot2Buf, O.SANITY_CHECK, 0);

    const { slots, failedSlots } = await openSave(rawFiles);

    // Slot 2 should be skipped, only slot 1 loaded
    expect(slots).toHaveLength(1);
    expect(slots[0].slot).toBe(1);

    // Failed slot should be reported with reason
    expect(failedSlots).toHaveLength(1);
    expect(failedSlots[0].slot).toBe(2);
    expect(failedSlots[0].error).toMatch(/Unexpected zeroes/);
  });

  test('failed slot primaryFile is recorded for preservation', async () => {
    const rawFiles = makeMultiSlotFiles([1, 2], (slot) => {
      const buf = makeBlankSave();
      wInt32BE(buf, O.VIT, slot * 10);
      return buf;
    });

    // Corrupt slot 2
    const slot2Buf = rawFiles.get('01user.dat').bytes;
    wInt32BE(slot2Buf, O.SANITY_CHECK, 0);
    // Put a marker so we can verify preservation
    slot2Buf[0x04] = 0xcd;

    const { slots, failedSlots } = await openSave(rawFiles);

    // Failed slot should have primaryFile info
    expect(failedSlots[0].primaryFile).toBeTruthy();

    // Write with failedSlots — failed slot should be preserved
    const { filesToWrite } = await writeSaveData(slots, failedSlots, 0, '');
    const slot2Out = filesToWrite.get('01USER.DAT');
    expect(slot2Out).toBeDefined();
    expect(slot2Out[0x04]).toBe(0xcd); // marker preserved
  });
});

describe('writeSaveData (unencrypted, single slot)', () => {
  test('write round-trip: open → modify → write → verify bytes', async () => {
    const buf = makeBlankSave();
    wInt32BE(buf, O.VIT, 10);
    wInt32BE(buf, O.SOULS, 100);
    const rawFiles = makeUnencryptedSaveFiles(buf);

    // Open
    const { slots, profileNumber, accountId } = await openSave(rawFiles);

    // Modify slot 1
    slots[0].model.vit = 99;
    slots[0].model.souls = 500000;

    // Write
    const { filesToWrite, encrypted } = await writeSaveData(slots, [], profileNumber, accountId);

    expect(encrypted).toBe(false);
    expect(filesToWrite.has('PARAM.SFO')).toBe(true);
    expect(filesToWrite.has('USER.DAT')).toBe(true);

    // Verify the USER.DAT bytes reflect the changes
    const userBytes = filesToWrite.get('USER.DAT');
    const result = readSave(userBytes);
    expect(result.vit).toBe(99);
    expect(result.souls).toBe(500000);
  });

  test('write changes profile number in PARAM.SFO', async () => {
    const buf = makeBlankSave();
    const rawFiles = makeUnencryptedSaveFiles(buf);

    const { slots } = await openSave(rawFiles);

    const { filesToWrite } = await writeSaveData(slots, [], 200, '');

    const sfoBytes = filesToWrite.get('PARAM.SFO');
    expect(sfoBytes[0x570]).toBe(200);
  });

  test('write round-trips without errors on blank save', async () => {
    const buf = makeBlankSave();
    const rawFiles = makeUnencryptedSaveFiles(buf);

    const { slots } = await openSave(rawFiles);

    // No modifications — just write back
    const { filesToWrite } = await writeSaveData(slots, [], 0, '');

    expect(filesToWrite.has('PARAM.SFO')).toBe(true);
    expect(filesToWrite.has('USER.DAT')).toBe(true);

    // Verify the USER.DAT is parseable
    const userBytes = filesToWrite.get('USER.DAT');
    const result = readSave(userBytes);
    expect(result).toBeDefined();
    expect(result.weapons.length).toBe(0);
  });
});

describe('writeSaveData (multi-slot)', () => {
  test('writes all slots and modifies each independently', async () => {
    const rawFiles = makeMultiSlotFiles([1, 2], (slot) => {
      const buf = makeBlankSave();
      wInt32BE(buf, O.VIT, slot * 10);
      return buf;
    });

    const { slots, profileNumber, accountId } = await openSave(rawFiles);

    // Modify both slots
    const slot1 = slots.find((s) => s.slot === 1);
    const slot2 = slots.find((s) => s.slot === 2);
    slot1.model.vit = 111;
    slot2.model.vit = 222;

    const { filesToWrite } = await writeSaveData(slots, [], profileNumber, accountId);

    // Both primary files should be present
    expect(filesToWrite.has('USER.DAT')).toBe(true);
    expect(filesToWrite.has('01USER.DAT')).toBe(true);

    // Verify each file reflects its own changes
    const result1 = readSave(filesToWrite.get('USER.DAT'));
    const result2 = readSave(filesToWrite.get('01USER.DAT'));
    expect(result1.vit).toBe(111);
    expect(result2.vit).toBe(222);
  });

  test('secondary file is written once with all slots data', async () => {
    const rawFiles = makeMultiSlotFiles([1, 2], (slot) => {
      const buf = makeBlankSave();
      wInt32BE(buf, O.VIT, slot * 10);
      return buf;
    });

    const { slots, profileNumber, accountId } = await openSave(rawFiles);

    // Set character names for each slot
    const slot1 = slots.find((s) => s.slot === 1);
    const slot2 = slots.find((s) => s.slot === 2);
    slot1.model.name = 'Alice';
    slot2.model.name = 'Bob';

    const { filesToWrite } = await writeSaveData(slots, [], profileNumber, accountId);

    // Secondary file should be present
    expect(filesToWrite.has('04USER.DAT')).toBe(true);
  });

  // Each slot's world must be written to its own per-slot offset in the
  // secondary file (SEC_WORLD + slot * SEC_NAME_STRIDE), not all to the
  // same fixed offset.
  test('secondary file writes per-slot world at correct offsets', async () => {
    const rawFiles = makeMultiSlotFiles([1, 2], () => {
      const buf = makeBlankSave();
      return buf;
    });

    const { slots, profileNumber, accountId } = await openSave(rawFiles);

    // Set distinct worlds for each slot
    const slot1 = slots.find((s) => s.slot === 1);
    const slot2 = slots.find((s) => s.slot === 2);
    slot1.model.world = 5; // slot 0 in secondary (0-based)
    slot2.model.world = 7; // slot 1 in secondary (0-based)

    const { filesToWrite } = await writeSaveData(slots, [], profileNumber, accountId);

    const secBytes = filesToWrite.get('04USER.DAT');
    expect(secBytes).toBeDefined();

    // Verify each slot's world landed at its per-slot offset
    const world0 = secBytes[O.SEC_WORLD + 0 * O.SEC_NAME_STRIDE];
    const world1 = secBytes[O.SEC_WORLD + 1 * O.SEC_NAME_STRIDE];
    expect(world0).toBe(5); // slot 1 → idx 0
    expect(world1).toBe(7); // slot 2 → idx 1
  });
});

/* ========================================================================
 * writeSaveData inPlace mode and edge cases
 * ==================================================================== */

describe('writeSaveData (inPlace mode)', () => {
  test('inPlace=true omits PARAM.SFO from output', async () => {
    const buf = makeBlankSave();
    const rawFiles = makeUnencryptedSaveFiles(buf);
    const { slots, profileNumber, accountId } = await openSave(rawFiles);

    const { filesToWrite } = await writeSaveData(slots, [], profileNumber, accountId, null, true);

    // PARAM.SFO must NOT be in filesToWrite in inPlace mode
    expect(filesToWrite.has('PARAM.SFO')).toBe(false);
    // But USER.DAT should still be there
    expect(filesToWrite.has('USER.DAT')).toBe(true);
  });

  test('inPlace=false includes PARAM.SFO in output', async () => {
    const buf = makeBlankSave();
    const rawFiles = makeUnencryptedSaveFiles(buf);
    const { slots, profileNumber, accountId } = await openSave(rawFiles);

    const { filesToWrite } = await writeSaveData(slots, [], profileNumber, accountId, null, false);

    expect(filesToWrite.has('PARAM.SFO')).toBe(true);
  });

  test('writeSaveData throws on empty slots array', async () => {
    await expect(writeSaveData([], [], 0, '')).rejects.toThrow('No save slots provided.');
  });

  test('writeSaveData includes assets in non-inPlace mode', async () => {
    const buf = makeBlankSave();
    const rawFiles = makeUnencryptedSaveFiles(buf);
    // Add a fake asset file
    rawFiles.set('icon0.png', { name: 'ICON0.PNG', bytes: new Uint8Array([0x89, 0x50]) });

    const { slots, profileNumber, accountId } = await openSave(rawFiles);
    const { filesToWrite } = await writeSaveData(slots, [], profileNumber, accountId);

    // Asset should be included as-is
    expect(filesToWrite.has('ICON0.PNG')).toBe(true);
  });

  test('writeSaveData with accountId writes to SFO', async () => {
    const buf = makeBlankSave();
    const rawFiles = makeUnencryptedSaveFiles(buf);
    const { slots, profileNumber } = await openSave(rawFiles);

    // Pass a new accountId
    const newAccountId = 'aabbccdd11223344aabbccdd11223344';
    const { filesToWrite } = await writeSaveData(slots, [], profileNumber, newAccountId);
    expect(filesToWrite.has('PARAM.SFO')).toBe(true);
  });

  test('writeSaveData with failedSlots preserves them unchanged', async () => {
    const rawFiles = makeMultiSlotFiles([1, 2], (slot) => {
      const buf = makeBlankSave();
      wInt32BE(buf, O.VIT, slot * 10);
      return buf;
    });

    // Corrupt slot 2
    const slot2Buf = rawFiles.get('01user.dat').bytes;
    wInt32BE(slot2Buf, O.SANITY_CHECK, 0);

    const { slots, failedSlots } = await openSave(rawFiles);
    const { filesToWrite } = await writeSaveData(slots, failedSlots, 0, '');

    // Failed slot's primary file should be included
    expect(filesToWrite.has('01USER.DAT')).toBe(true);
  });
});

/* ========================================================================
 * getLimits
 * ==================================================================== */

describe('getLimits', () => {
  test('returns depositMaxEntries', () => {
    const limits = getLimits();
    expect(limits.depositMaxEntries).toBe(2048);
  });
});

/* ========================================================================
 * resolveSaveFiles error paths
 * ==================================================================== */

describe('resolveSaveFiles error paths', () => {
  test('throws when no primary variants exist', () => {
    const files = new Map([['04user.dat', { name: '04USER.DAT' }]]);
    expect(() => resolveSaveFiles(files, 1)).toThrow(/Could not resolve primary/);
  });

  test('throws when no secondary variants exist', () => {
    const files = new Map([['user.dat', { name: 'USER.DAT' }]]);
    expect(() => resolveSaveFiles(files, 1)).toThrow(/Could not resolve secondary/);
  });
});

/* ========================================================================
 * openSave: resolve-failure → failedSlot with primaryFile: null
 * ==================================================================== */

describe('openSave: slot resolve-failure', () => {
  test('slot with primary but no secondary → recorded as failedSlot', async () => {
    // The secondary file (04USER.DAT) is shared across all slots, so
    // removing it makes resolveSaveFiles throw for every slot. openSave
    // then throws because no slot can succeed.
    const buf = makeBlankSave();
    const files = makeUnencryptedSaveFiles(buf);
    files.delete('04user.dat');

    await expect(openSave(files)).rejects.toThrow('No valid save slots');
  });
});

/* ========================================================================
 * exportEncryptedSave: empty slots throw
 * ==================================================================== */

describe('exportEncryptedSave validation', () => {
  test('throws on empty slots array', async () => {
    const { exportEncryptedSave } = await import('../../js/des-savefile/save-api.js');
    await expect(exportEncryptedSave([], [], 0, '')).rejects.toThrow('No save slots provided.');
  });
});

/* ========================================================================
 * save-api: additional branch coverage tests
 * ==================================================================== */

describe('save-api: writeSaveData inPlace + encrypted source branches', () => {
  test('writeSaveData inPlace=true with assets on unencrypted source', async () => {
    const buf = makeBlankSave();
    const rawFiles = makeUnencryptedSaveFiles(buf);
    // Add an asset file to exercise the inPlace asset skip branch
    rawFiles.set('icon0.png', { name: 'ICON0.PNG', bytes: new Uint8Array([0x89, 0x50]) });
    rawFiles.set('pic1.png', { name: 'PIC1.PNG', bytes: new Uint8Array([0x42]) });
    const { slots, profileNumber, accountId } = await openSave(rawFiles);

    // inPlace=true on unencrypted source — assets are skipped
    const { filesToWrite } = await writeSaveData(slots, [], profileNumber, accountId, null, true);
    // In inPlace mode, assets are NOT written (already on disk)
    expect(filesToWrite.has('ICON0.PNG')).toBe(false);
    expect(filesToWrite.has('PIC1.PNG')).toBe(false);
    // But USER.DAT is still written
    expect(filesToWrite.has('USER.DAT')).toBe(true);
  });

  test('writeSaveData non-inPlace with both USER.DAT backup and assets', async () => {
    const buf = makeBlankSave();
    const rawFiles = makeUnencryptedSaveFiles(buf);
    // Add an asset file
    rawFiles.set('icon0.png', { name: 'ICON0.PNG', bytes: new Uint8Array([0x42]) });
    const { slots, profileNumber, accountId } = await openSave(rawFiles);

    // non-inPlace — assets ARE included
    const { filesToWrite } = await writeSaveData(slots, [], profileNumber, accountId, null, false);
    expect(filesToWrite.has('ICON0.PNG')).toBe(true);
  });
});

describe('save-api: decryptAndMergeSlots cached bytes branch', () => {
  test('writeSaveData reuses cached decryptedBytes (no re-decrypt)', async () => {
    const buf = makeBlankSave();
    wInt32BE(buf, O.VIT, 30);
    const rawFiles = makeUnencryptedSaveFiles(buf);
    const { slots, profileNumber, accountId } = await openSave(rawFiles);

    // Modify and write — should use cached bytes for unencrypted saves
    slots[0].model.vit = 99;
    const { filesToWrite } = await writeSaveData(slots, [], profileNumber, accountId);
    expect(filesToWrite.has('USER.DAT')).toBe(true);
    const result = readSave(filesToWrite.get('USER.DAT'));
    expect(result.vit).toBe(99);
  });
});

// updateSessionAfterWrite encrypted→decrypted and decrypted→encrypted
// transition tests are in save-api-encrypted.test.js (more thorough).

/* ========================================================================
 * reloadSlotModels: re-sanitize models after save
 * ==================================================================== */

describe('reloadSlotModels', () => {
  test('re-sanitizes models after write, preserving edited values + fresh display', async () => {
    const buf = makeBlankSave();
    wInt32BE(buf, O.VIT, 30);
    const rawFiles = makeUnencryptedSaveFiles(buf);
    const { slots, profileNumber, accountId } = await openSave(rawFiles);

    // Modify several editable values
    slots[0].model.vit = 99;
    slots[0].model.name = 'Hero';
    slots[0].model.souls = 77777;

    // Write — this merges the model and updates session.fullModel
    await writeSaveData(slots, [], profileNumber, accountId);

    // Reload — re-sanitizes from the updated fullModel
    reloadSlotModels(slots);

    // After reload: edited values are preserved and display is freshly produced
    expect(slots[0].model.vit).toBe(99);
    expect(slots[0].model.name).toBe('Hero');
    expect(slots[0].model.souls).toBe(77777);
    expect(slots[0].display).toBeDefined();
    expect(slots[0].display.equipmentPointers).toBeDefined();
    expect(slots[0].display.invIdxByRef).toBeDefined();
  });

  test('reloadSlotModels with onProgress callback', async () => {
    const buf = makeBlankSave();
    const rawFiles = makeUnencryptedSaveFiles(buf);
    const { slots } = await openSave(rawFiles);

    const messages = [];
    reloadSlotModels(slots, (msg) => messages.push(msg));

    expect(messages.length).toBeGreaterThan(0);
    expect(messages.some((m) => m.includes('Refresh'))).toBe(true);
  });
});

/* ========================================================================
 * Repeated saves without reload (new items must not duplicate)
 * ==================================================================== */

/**
 * Helper: create a properly-initialized blank save with empty inventory
 * slots (all 0xFF).  makeBlankSave alone leaves inventory slots as zeros
 * (type=0), which prevents new-item placement when deletedSlots is an
 * empty array (the mergeModel path).
 */
function makeInitializedBlankSave() {
  const buf = makeBlankSave();
  // Write once to properly initialize inventory slots to 0xFFFFFFFF.
  // writeSave's full-scan fallback clears all unoccupied slots.
  const m = readSave(buf);
  return writeSave(buf, m);
}

describe('repeated saves without reload (new items)', () => {
  test('add item → save → reload → save again: no duplication', async () => {
    const buf = makeInitializedBlankSave();
    const rawFiles = makeUnencryptedSaveFiles(buf);
    const { slots, profileNumber, accountId } = await openSave(rawFiles);

    // Add a new weapon to the model (as the UI "Add" button would)
    slots[0].model.weapons.push({
      _ref: '',
      itemId: 0x10000001,
      count: 1,
      misc1: 0,
      misc2: 0x01000000,
      durability: 300,
    });

    // Save #1
    const result1 = await writeSaveData(slots, [], profileNumber, accountId);
    const userBytes1 = result1.filesToWrite.get('USER.DAT');
    const model1 = readSave(userBytes1);
    expect(model1.weapons).toHaveLength(1);

    // reloadSlotModels (as the UI calls after every save)
    reloadSlotModels(slots);

    // The reloaded model should have a valid _ref for the formerly-new item
    expect(slots[0].model.weapons).toHaveLength(1);
    expect(slots[0].model.weapons[0]._ref).toMatch(/^inv:\d+$/);

    // Save #2 — without reloading from disk
    const result2 = await writeSaveData(slots, [], profileNumber, accountId);
    const userBytes2 = result2.filesToWrite.get('USER.DAT');
    const model2 = readSave(userBytes2);

    // The weapon must NOT be duplicated — still exactly 1
    expect(model2.weapons).toHaveLength(1);
  });
});

/* ========================================================================
 * sfoBytes return value + accountId assertions
 * ==================================================================== */

describe('writeSaveData: sfoBytes return value', () => {
  // sfoBytes is always returned (with the patched profile number) regardless
  // of inPlace mode. One test.each covers both; the inPlace row also asserts
  // PARAM.SFO is omitted from filesToWrite. (The accountId param is exercised
  // by `writeSaveData with accountId writes to SFO` above; the real ACCOUNT_ID
  // write lives in param-sfo.test.js.)
  test.each([
    { label: 'non-inPlace', inPlace: false, expectSfoInFiles: true },
    { label: 'inPlace', inPlace: true, expectSfoInFiles: false },
  ])(
    'returns sfoBytes with patched profile number ($label)',
    async ({ inPlace, expectSfoInFiles }) => {
      const buf = makeBlankSave();
      const rawFiles = makeUnencryptedSaveFiles(buf);
      const { slots, profileNumber, accountId } = await openSave(rawFiles);

      const { filesToWrite, sfoBytes } = await writeSaveData(
        slots,
        [],
        profileNumber,
        accountId,
        null,
        inPlace,
      );

      expect(filesToWrite.has('PARAM.SFO')).toBe(expectSfoInFiles);
      expect(sfoBytes).toBeInstanceOf(Uint8Array);
      expect(sfoBytes[0x570]).toBe(profileNumber);
    },
  );
});

describe('openSave: accountId return value', () => {
  test('openSave returns accountId from PARAM.SFO', async () => {
    const buf = makeBlankSave();
    const rawFiles = makeUnencryptedSaveFiles(buf);
    const { accountId } = await openSave(rawFiles);

    // makeSfo() creates a minimal SFO without ACCOUNT_ID — getSfoAccountId
    // returns '' when the field is absent.
    expect(accountId).toBe('');
  });
});

/* ========================================================================
 * onProgress callback branches (typeof === 'function' true arms)
 * ==================================================================== */

describe('save-api: onProgress callback branches', () => {
  test('openSave with onProgress callback invokes it', async () => {
    const buf = makeBlankSave();
    const rawFiles = makeUnencryptedSaveFiles(buf);
    const messages = [];
    await openSave(rawFiles, (msg) => messages.push(msg));
    expect(messages.length).toBeGreaterThan(0);
  });

  test('writeSaveData with onProgress callback invokes it', async () => {
    const buf = makeBlankSave();
    const rawFiles = makeUnencryptedSaveFiles(buf);
    const { slots } = await openSave(rawFiles);
    const messages = [];
    await writeSaveData(slots, [], 0, '', (msg) => messages.push(msg));
    expect(messages.length).toBeGreaterThan(0);
  });
});

/* ========================================================================
 * decryptAndMergeSlots: secondary file absent during write
 *
 * Forces the hasSecondary === false path (BRDA 429/453/458/542): the
 * shared 04USER.DAT is removed from the session's rawFiles after open,
 * so no secondary item is queued, toDecrypt stays empty, and the return
 * value's secondaryFile is null.
 * ==================================================================== */

describe('decryptAndMergeSlots: no secondary file during write', () => {
  test('writeSaveData skips secondary update when 04USER.DAT is absent', async () => {
    const buf = makeBlankSave();
    const rawFiles = makeUnencryptedSaveFiles(buf);
    const { slots, profileNumber, accountId } = await openSave(rawFiles);

    // Remove the secondary file from the session's shared rawFiles map.
    // The slot primary is still served from the cached decryptedBytes, so
    // the merge proceeds without the secondary.
    slots[0].session.rawFiles.delete('04user.dat');

    const { filesToWrite } = await writeSaveData(slots, [], profileNumber, accountId);

    // Secondary must be absent from the output; primary still present.
    expect(filesToWrite.has('04USER.DAT')).toBe(false);
    expect(filesToWrite.has('USER.DAT')).toBe(true);
  });
});

/* ========================================================================
 * decryptAndMergeSlots: primary file absent from rawFiles
 *
 * Covers the origName fallback in the primary branch (BRDA 518): when the
 * primary file is missing from rawFiles, the output name falls back to
 * session.primaryFile. The primary bytes are still available via the
 * cached session.decryptedBytes.
 * ==================================================================== */

describe('decryptAndMergeSlots: primary absent from rawFiles (origName fallback)', () => {
  test('writeSaveData falls back to session.primaryFile for output name', async () => {
    const buf = makeBlankSave();
    const rawFiles = makeUnencryptedSaveFiles(buf);
    const { slots, profileNumber, accountId } = await openSave(rawFiles);

    // Remove the primary file from the session's shared rawFiles map.
    // The merge still works because it uses the cached decryptedBytes.
    slots[0].session.rawFiles.delete('user.dat');

    const { filesToWrite } = await writeSaveData(slots, [], profileNumber, accountId);

    // Primary is written under its fallback name (session.primaryFile).
    expect(filesToWrite.has('USER.DAT')).toBe(true);
  });
});
