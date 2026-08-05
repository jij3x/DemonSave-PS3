/**
 * Integration test: Round-trip fields across multiple save slots.
 *
 * Verifies that fields in different slots are persisted correctly and
 * there is no cross-contamination between slots.  Also tests the shared
 * secondary file (04USER.DAT) per-slot name/world offsets.
 */
import { openSave, writeSaveData } from '../js/des-savefile/save-api.js';
import * as O from '../js/des-savefile/offsets.js';
import { createUnencryptedSaveFolder, getExpectedModel } from './helpers/save-factory.js';
import { createTmpSandbox } from './helpers/tmp-sandbox.js';
import { assertModelsMatch } from './helpers/model-diff.js';

describe('round-trip: multi-slot persistence', () => {
  /** @type {ReturnType<typeof createTmpSandbox>} */
  let sandbox;

  afterEach(async () => {
    if (sandbox) await sandbox.cleanup();
  });

  /**
   * Write files to a fresh sandbox, open, and return the result.
   */
  async function setupAndOpen(rawFiles) {
    sandbox = createTmpSandbox('multi-slot');
    for (const [, entry] of rawFiles) {
      sandbox.writeFile(entry.name, entry.bytes);
    }
    return await openSave(sandbox.readFiles());
  }

  /**
   * Write the current slots to disk and re-open from disk.
   */
  async function writeAndReopen(slots, profileNumber, accountId) {
    const { filesToWrite } = await writeSaveData(slots, [], profileNumber, accountId);
    sandbox.writeFiles(filesToWrite);
    return await openSave(sandbox.readFiles());
  }

  // -------------------------------------------------------------------
  // Multi-slot loading
  // -------------------------------------------------------------------

  test('loads slots 1, 2, 3 with distinct field values', async () => {
    const rawFiles = createUnencryptedSaveFolder([1, 2, 3]);
    const opened = await setupAndOpen(rawFiles);
    const { slots } = opened;

    expect(slots).toHaveLength(3);

    const slot1 = slots.find((s) => s.slot === 1);
    const slot2 = slots.find((s) => s.slot === 2);
    const slot3 = slots.find((s) => s.slot === 3);

    expect(slot1).toBeDefined();
    expect(slot2).toBeDefined();
    expect(slot3).toBeDefined();

    // Each slot's fields must match the factory model for that slot number
    assertModelsMatch(slot1.model, getExpectedModel(1));
    assertModelsMatch(slot2.model, getExpectedModel(2));
    assertModelsMatch(slot3.model, getExpectedModel(3));
  });

  test('loads slot 4 only', async () => {
    const rawFiles = createUnencryptedSaveFolder([4]);
    const opened = await setupAndOpen(rawFiles);
    const { slots } = opened;

    expect(slots).toHaveLength(1);
    expect(slots[0].slot).toBe(4);
    assertModelsMatch(slots[0].model, getExpectedModel(4));
  });

  test('loads non-contiguous slots (1 and 3)', async () => {
    const rawFiles = createUnencryptedSaveFolder([1, 3]);
    const opened = await setupAndOpen(rawFiles);
    const { slots } = opened;

    expect(slots).toHaveLength(2);
    assertModelsMatch(slots.find((s) => s.slot === 1).model, getExpectedModel(1));
    assertModelsMatch(slots.find((s) => s.slot === 3).model, getExpectedModel(3));
  });

  // -------------------------------------------------------------------
  // Cross-slot independence: modify one slot, others stay unchanged
  // -------------------------------------------------------------------

  test('modifying slot 1 does not affect slot 2', async () => {
    const rawFiles = createUnencryptedSaveFolder([1, 2]);
    const opened = await setupAndOpen(rawFiles);

    const slot1 = opened.slots.find((s) => s.slot === 1);

    // Modify slot 1 heavily
    slot1.model.vit = 99;
    slot1.model.souls = 777777;
    slot1.model.name = 'Modified';
    slot1.model.weapons[0].itemId = 0x0badf00d;
    slot1.model.spells[0].status = 0;

    // Leave slot 2 unchanged

    const { slots } = await writeAndReopen(opened.slots, opened.profileNumber, opened.accountId);

    const s1 = slots.find((s) => s.slot === 1);
    const s2 = slots.find((s) => s.slot === 2);

    // Slot 1: modified values
    expect(s1.model.vit).toBe(99);
    expect(s1.model.souls).toBe(777777);
    expect(s1.model.name).toBe('Modified');
    expect(s1.model.weapons[0].itemId).toBe(0x0badf00d);
    expect(s1.model.spells[0].status).toBe(0);

    // Slot 2: original factory values unchanged
    assertModelsMatch(s2.model, getExpectedModel(2));
  });

  test('modifying slot 2 does not affect slot 1', async () => {
    const rawFiles = createUnencryptedSaveFolder([1, 2]);
    const opened = await setupAndOpen(rawFiles);

    const slot2 = opened.slots.find((s) => s.slot === 2);
    slot2.model.vit = 42;
    slot2.model.name = 'Slot2Char';

    const { slots } = await writeAndReopen(opened.slots, opened.profileNumber, opened.accountId);

    const s1 = slots.find((s) => s.slot === 1);
    const s2 = slots.find((s) => s.slot === 2);

    expect(s2.model.vit).toBe(42);
    expect(s2.model.name).toBe('Slot2Char');

    // Slot 1 must be unchanged
    assertModelsMatch(s1.model, getExpectedModel(1));
  });

  test('modifying all slots independently preserves each one', async () => {
    const rawFiles = createUnencryptedSaveFolder([1, 2, 3]);
    const opened = await setupAndOpen(rawFiles);

    // Give each slot a distinct vit value
    opened.slots.find((s) => s.slot === 1).model.vit = 111;
    opened.slots.find((s) => s.slot === 2).model.vit = 222;
    opened.slots.find((s) => s.slot === 3).model.vit = 333;

    // Give each a distinct name
    opened.slots.find((s) => s.slot === 1).model.name = 'Alpha';
    opened.slots.find((s) => s.slot === 2).model.name = 'Beta';
    opened.slots.find((s) => s.slot === 3).model.name = 'Gamma';

    const { slots } = await writeAndReopen(opened.slots, opened.profileNumber, opened.accountId);

    expect(slots.find((s) => s.slot === 1).model.vit).toBe(111);
    expect(slots.find((s) => s.slot === 2).model.vit).toBe(222);
    expect(slots.find((s) => s.slot === 3).model.vit).toBe(333);

    expect(slots.find((s) => s.slot === 1).model.name).toBe('Alpha');
    expect(slots.find((s) => s.slot === 2).model.name).toBe('Beta');
    expect(slots.find((s) => s.slot === 3).model.name).toBe('Gamma');
  });

  // -------------------------------------------------------------------
  // Inventory/deposit/spell independence across slots
  // -------------------------------------------------------------------

  test('inventory items are independent per slot', async () => {
    const rawFiles = createUnencryptedSaveFolder([1, 2]);
    const opened = await setupAndOpen(rawFiles);

    // Modify slot 1's weapon count
    opened.slots.find((s) => s.slot === 1).model.weapons[0].count = 77;
    // Modify slot 2's weapon durability
    opened.slots.find((s) => s.slot === 2).model.weapons[0].durability = 1;

    const { slots } = await writeAndReopen(opened.slots, opened.profileNumber, opened.accountId);

    expect(slots.find((s) => s.slot === 1).model.weapons[0].count).toBe(77);
    expect(slots.find((s) => s.slot === 2).model.weapons[0].durability).toBe(1);

    // Slot 2's weapon count should be original factory value
    expect(slots.find((s) => s.slot === 2).model.weapons[0].count).toBe(
      getExpectedModel(2).weapons[0].count,
    );
  });

  test('deposit items are independent per slot', async () => {
    const rawFiles = createUnencryptedSaveFolder([1, 2]);
    const opened = await setupAndOpen(rawFiles);

    opened.slots.find((s) => s.slot === 1).model.deposit[0].count = 33;
    opened.slots.find((s) => s.slot === 2).model.deposit[0].count = 66;

    const { slots } = await writeAndReopen(opened.slots, opened.profileNumber, opened.accountId);

    expect(slots.find((s) => s.slot === 1).model.deposit[0].count).toBe(33);
    expect(slots.find((s) => s.slot === 2).model.deposit[0].count).toBe(66);
  });

  test('spells are independent per slot', async () => {
    const rawFiles = createUnencryptedSaveFolder([1, 2]);
    const opened = await setupAndOpen(rawFiles);

    opened.slots.find((s) => s.slot === 1).model.spells[0].status = 0;
    opened.slots.find((s) => s.slot === 2).model.spells[0].status = 3;

    const { slots } = await writeAndReopen(opened.slots, opened.profileNumber, opened.accountId);

    expect(slots.find((s) => s.slot === 1).model.spells[0].status).toBe(0);
    expect(slots.find((s) => s.slot === 2).model.spells[0].status).toBe(3);
  });

  // -------------------------------------------------------------------
  // Secondary file (04USER.DAT) per-slot name + world
  // -------------------------------------------------------------------

  test('secondary file has per-slot name at correct offsets', async () => {
    const rawFiles = createUnencryptedSaveFolder([1, 2]);
    const opened = await setupAndOpen(rawFiles);

    opened.slots.find((s) => s.slot === 1).model.name = 'Alice';
    opened.slots.find((s) => s.slot === 2).model.name = 'Bob';

    const { filesToWrite } = await writeSaveData(
      opened.slots,
      [],
      opened.profileNumber,
      opened.accountId,
    );
    sandbox.writeFiles(filesToWrite);

    const secBytes = sandbox.readFile('04USER.DAT');

    // Slot 1 (idx=0): name data (UTF-16LE pairs, no length prefix)
    const nameOff0 = O.SEC_NAME_BASE + 0 * O.SEC_NAME_STRIDE;
    expect(secBytes[nameOff0]).toBe('A'.charCodeAt(0));
    expect(secBytes[nameOff0 + 1]).toBe(0); // high byte of 'A'

    // Slot 2 (idx=1): name data
    const nameOff1 = O.SEC_NAME_BASE + 1 * O.SEC_NAME_STRIDE;
    expect(secBytes[nameOff1]).toBe('B'.charCodeAt(0));
    expect(secBytes[nameOff1 + 1]).toBe(0); // high byte of 'B'
  });

  test('secondary file has per-slot world at correct offsets', async () => {
    const rawFiles = createUnencryptedSaveFolder([1, 2, 3]);
    const opened = await setupAndOpen(rawFiles);

    opened.slots.find((s) => s.slot === 1).model.world = 5;
    opened.slots.find((s) => s.slot === 2).model.world = 7;
    opened.slots.find((s) => s.slot === 3).model.world = 9;

    const { filesToWrite } = await writeSaveData(
      opened.slots,
      [],
      opened.profileNumber,
      opened.accountId,
    );
    sandbox.writeFiles(filesToWrite);

    const secBytes = sandbox.readFile('04USER.DAT');

    expect(secBytes[O.SEC_WORLD + 0 * O.SEC_NAME_STRIDE]).toBe(5);
    expect(secBytes[O.SEC_WORLD + 1 * O.SEC_NAME_STRIDE]).toBe(7);
    expect(secBytes[O.SEC_WORLD + 2 * O.SEC_NAME_STRIDE]).toBe(9);
  });

  test('secondary file per-slot name does not overflow into next slot', async () => {
    const rawFiles = createUnencryptedSaveFolder([1, 2]);
    const opened = await setupAndOpen(rawFiles);

    // Slot 1: 16-char name (maximum)
    opened.slots.find((s) => s.slot === 1).model.name = 'ABCDEFGHIJKLMNOP';
    // Slot 2: short name
    opened.slots.find((s) => s.slot === 2).model.name = 'Z';

    const { filesToWrite } = await writeSaveData(
      opened.slots,
      [],
      opened.profileNumber,
      opened.accountId,
    );
    sandbox.writeFiles(filesToWrite);

    const secBytes = sandbox.readFile('04USER.DAT');

    // Slot 2's name data must be intact (no overflow from slot 1's 16-char name)
    const nameOff1 = O.SEC_NAME_BASE + 1 * O.SEC_NAME_STRIDE;
    expect(secBytes[nameOff1]).toBe('Z'.charCodeAt(0));
    expect(secBytes[nameOff1 + 1]).toBe(0); // high byte of 'Z'
  });

  // -------------------------------------------------------------------
  // Full multi-slot model round-trip (all fields, all slots)
  // -------------------------------------------------------------------

  test('no-op re-save of 3 slots preserves all fields', async () => {
    const rawFiles = createUnencryptedSaveFolder([1, 2, 3]);
    const opened = await setupAndOpen(rawFiles);

    // Modify nothing — just write back
    const { slots } = await writeAndReopen(opened.slots, opened.profileNumber, opened.accountId);

    // All three slots must match factory values
    assertModelsMatch(slots.find((s) => s.slot === 1).model, getExpectedModel(1));
    assertModelsMatch(slots.find((s) => s.slot === 2).model, getExpectedModel(2));
    assertModelsMatch(slots.find((s) => s.slot === 3).model, getExpectedModel(3));
  });

  // -------------------------------------------------------------------
  // Multi-slot with assets
  // -------------------------------------------------------------------

  test('multi-slot save with assets preserves asset bytes on disk', async () => {
    const rawFiles = createUnencryptedSaveFolder([1, 2], { assets: true });
    const opened = await setupAndOpen(rawFiles);

    const { filesToWrite } = await writeSaveData(
      opened.slots,
      [],
      opened.profileNumber,
      opened.accountId,
    );
    sandbox.writeFiles(filesToWrite);

    // Assets must be on disk and unchanged
    const iconBytes = sandbox.readFile('ICON0.PNG');
    expect(iconBytes[0]).toBe(0x89); // PNG magic byte preserved

    const picBytes = sandbox.readFile('PIC1.PNG');
    expect(picBytes.length).toBeGreaterThan(100);
  });
});
