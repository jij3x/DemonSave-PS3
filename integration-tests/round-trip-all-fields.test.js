/**
 * Integration test: Round-trip every single field through the save API.
 *
 * Creates a fully-populated save in a tmp directory, opens it, verifies
 * all initial values, modifies every field group, writes back, re-opens
 * from disk, and verifies the modified values survived the round-trip.
 *
 * Tests use unencrypted saves for speed. Encrypted/zip format coverage
 * is in round-trip-formats.test.js.
 */
import { openSave, writeSaveData } from '../js/des-savefile/save-api.js';
import { getSfoAccountId } from '../js/lib/ps3-save-lib/index.js';
import { createUnencryptedSaveFolder, getExpectedModel } from '../test-fixtures/save-factory.js';
import { createTmpSandbox } from './tmp-sandbox.js';
import { assertModelsMatch, extractComparableModel } from '../test-fixtures/model-diff.js';

describe('round-trip: all fields (unencrypted, single slot)', () => {
  /** @type {ReturnType<typeof createTmpSandbox>} */
  let sandbox;
  /** @type {Awaited<ReturnType<typeof openSave>>} */
  let opened;

  beforeEach(async () => {
    sandbox = createTmpSandbox('all-fields');
    const rawFiles = createUnencryptedSaveFolder([1], {
      profileNumber: 42,
      realisticSfo: true,
      accountId: 'aabbccdd11223344aabbccdd11223344',
    });
    // Write raw files to disk using original-case filenames
    for (const [, entry] of rawFiles) {
      sandbox.writeFile(entry.name, entry.bytes);
    }
    opened = await openSave(sandbox.readFiles());
  });

  afterEach(async () => {
    if (sandbox) await sandbox.cleanup();
  });

  /**
   * Write the current slots to disk and re-open from disk.
   */
  async function writeAndReopen(slots, profileNumber, accountId = opened.accountId) {
    const { filesToWrite } = await writeSaveData(slots, [], profileNumber, accountId);
    sandbox.writeFiles(filesToWrite);
    return await openSave(sandbox.readFiles());
  }

  // -------------------------------------------------------------------
  // Initial read verification: factory values must survive openSave
  // -------------------------------------------------------------------

  test('initial openSave reads all factory values correctly', () => {
    const expected = getExpectedModel(1);
    assertModelsMatch(extractComparableModel(opened.slots[0].session.fullModel), expected);

    // Verify equipment pointers are read into the full model
    const fm = opened.slots[0].session.fullModel;
    expect(fm.leftHand1Ptr).toBe(expected.leftHand1Ptr);
    expect(fm.rightHand1Ptr).toBe(expected.rightHand1Ptr);
    expect(fm.boltsPtr).toBe(0xffffffff); // empty slot
    expect(fm.ring2Ptr).toBe(0xffffffff); // empty slot
    expect(fm.quickSlot5Ptr).toBe(expected.quickSlot5Ptr);

    // Verify display data has equipment pointer fields (structurally separated)
    const display = opened.slots[0].display;
    expect(display.equipmentPointers.leftHand1).toBe(expected.leftHand1Ptr);
    expect(display.equipmentPointers.rightHand1).toBe(expected.rightHand1Ptr);
    expect(display.equipmentPointers.bolts).toBe(0xffffffff);
    expect(display.equipmentPointers.quickSlot5).toBe(expected.quickSlot5Ptr);

    // Verify display.invIdxByRef maps inventory refs to idx1
    const m = opened.slots[0].model;
    expect(display.invIdxByRef.get(m.weapons[0]._ref)).toBe(0);
    expect(display.invIdxByRef.get(m.weapons[1]._ref)).toBe(1);
    expect(display.invIdxByRef.get(m.armor[0]._ref)).toBe(2);
    expect(display.invIdxByRef.get(m.goods[2]._ref)).toBe(6);
  });

  test('initial openSave reads profileNumber and accountId from SFO', () => {
    expect(opened.profileNumber).toBe(42);
    expect(opened.accountId).toBe('aabbccdd11223344aabbccdd11223344');
  });

  // -------------------------------------------------------------------
  // Stats (11 fields — verifies dual base+effective writes)
  // -------------------------------------------------------------------

  test('stat at U32 boundary (0xFFFFFFFF) round-trips', async () => {
    const model = opened.slots[0].model;
    model.souls = 0xffffffff;
    model.soulMem = 0xffffffff;

    const { slots } = await writeAndReopen(opened.slots, opened.profileNumber);
    const expected = {
      ...getExpectedModel(1),
      souls: 0xffffffff,
      soulMem: 0xffffffff,
    };
    assertModelsMatch(extractComparableModel(slots[0].session.fullModel), expected);
  });

  // -------------------------------------------------------------------
  // Identity
  // -------------------------------------------------------------------

  test('character name round-trip (16-char maximum)', async () => {
    const model = opened.slots[0].model;
    model.name = 'ABCDEFGHIJKLMNOP';

    const { slots } = await writeAndReopen(opened.slots, opened.profileNumber);
    const expected = { ...getExpectedModel(1), name: 'ABCDEFGHIJKLMNOP' };
    assertModelsMatch(extractComparableModel(slots[0].session.fullModel), expected);
  });

  test('character name round-trip (CJK character)', async () => {
    const model = opened.slots[0].model;
    // U+3042 (Hiragana あ) — above Latin1 range, tests UTF-16 support
    model.name = 'あ';

    const { slots } = await writeAndReopen(opened.slots, opened.profileNumber);
    const expected = { ...getExpectedModel(1), name: 'あ' };
    assertModelsMatch(extractComparableModel(slots[0].session.fullModel), expected);
  });

  test('empty character name round-trip', async () => {
    const model = opened.slots[0].model;
    model.name = '';

    const { slots } = await writeAndReopen(opened.slots, opened.profileNumber);
    const expected = { ...getExpectedModel(1), name: '' };
    assertModelsMatch(extractComparableModel(slots[0].session.fullModel), expected);
  });

  // -------------------------------------------------------------------
  // Equipment (18 fields, including 0xFFFFFFFF empty slots)
  // -------------------------------------------------------------------

  test('all equipment IDs round-trip', async () => {
    const model = opened.slots[0].model;
    model.leftHand1 = 0xdead0001;
    model.rightHand1 = 0xdead0002;
    model.leftHand2 = 0xdead0003;
    model.rightHand2 = 0xdead0004;
    model.arrows = 0xdead0005;
    model.bolts = 0xdead0006; // was 0xFFFFFFFF, now has a value
    model.helmet = 0xdead0007;
    model.chest = 0xdead0008;
    model.gauntlets = 0xdead0009;
    model.leggings = 0xdead000a;
    model.hairstyle = 0xdead000b;
    model.ring1 = 0xdead000c;
    model.ring2 = 0xdead000d; // was 0xFFFFFFFF, now has a value
    model.quickSlot1 = 0xdead000e;
    model.quickSlot2 = 0xdead000f;
    model.quickSlot3 = 0xdead0010; // was 0xFFFFFFFF, now has a value
    model.quickSlot4 = 0xdead0011;
    model.quickSlot5 = 0xdead0012;

    const { slots } = await writeAndReopen(opened.slots, opened.profileNumber);
    const expected = {
      ...getExpectedModel(1),
      leftHand1: 0xdead0001,
      rightHand1: 0xdead0002,
      leftHand2: 0xdead0003,
      rightHand2: 0xdead0004,
      arrows: 0xdead0005,
      bolts: 0xdead0006,
      helmet: 0xdead0007,
      chest: 0xdead0008,
      gauntlets: 0xdead0009,
      leggings: 0xdead000a,
      hairstyle: 0xdead000b,
      ring1: 0xdead000c,
      ring2: 0xdead000d,
      quickSlot1: 0xdead000e,
      quickSlot2: 0xdead000f,
      quickSlot3: 0xdead0010,
      quickSlot4: 0xdead0011,
      quickSlot5: 0xdead0012,
    };
    assertModelsMatch(extractComparableModel(slots[0].session.fullModel), expected);
  });

  test('clearing equipment to 0xFFFFFFFF round-trips', async () => {
    const model = opened.slots[0].model;
    model.leftHand1 = 0xffffffff;
    model.rightHand1 = 0xffffffff;
    model.helmet = 0xffffffff;
    model.ring1 = 0xffffffff;

    const { slots } = await writeAndReopen(opened.slots, opened.profileNumber);
    const expected = {
      ...getExpectedModel(1),
      leftHand1: 0xffffffff,
      rightHand1: 0xffffffff,
      helmet: 0xffffffff,
      ring1: 0xffffffff,
    };
    assertModelsMatch(extractComparableModel(slots[0].session.fullModel), expected);
  });

  // -------------------------------------------------------------------
  // Inventory (all 4 categories × all sub-fields)
  // -------------------------------------------------------------------

  test('weapon inventory items round-trip (all sub-fields)', async () => {
    const model = opened.slots[0].model;
    // Modify existing weapon items
    model.weapons[0].itemId = 0x00099999;
    model.weapons[0].count = 99;
    model.weapons[0].misc1 = 0x10ff;
    model.weapons[0].misc2 = 0x02000000;
    model.weapons[0].durability = 1;
    model.weapons[1].durability = 0;

    const { slots } = await writeAndReopen(opened.slots, opened.profileNumber);
    const expected = { ...getExpectedModel(1) };
    expected.weapons[0] = {
      ...expected.weapons[0],
      itemId: 0x00099999,
      count: 99,
      misc1: 0x10ff,
      misc2: 0x02000000,
      durability: 1,
    };
    expected.weapons[1] = { ...expected.weapons[1], durability: 0 };
    assertModelsMatch(extractComparableModel(slots[0].session.fullModel), expected);
  });

  test('armor inventory items round-trip', async () => {
    const model = opened.slots[0].model;
    model.armor[0].itemId = 0x00aaaaaa;
    model.armor[0].count = 5;
    model.armor[0].durability = 42;

    const { slots } = await writeAndReopen(opened.slots, opened.profileNumber);
    const expected = { ...getExpectedModel(1) };
    expected.armor[0] = {
      ...expected.armor[0],
      itemId: 0x00aaaaaa,
      count: 5,
      durability: 42,
    };
    assertModelsMatch(extractComparableModel(slots[0].session.fullModel), expected);
  });

  test('ring inventory items round-trip', async () => {
    const model = opened.slots[0].model;
    model.rings[0].itemId = 0x00bbbbbb;
    model.rings[0].count = 3;

    const { slots } = await writeAndReopen(opened.slots, opened.profileNumber);
    const expected = { ...getExpectedModel(1) };
    expected.rings[0] = { ...expected.rings[0], itemId: 0x00bbbbbb, count: 3 };
    assertModelsMatch(extractComparableModel(slots[0].session.fullModel), expected);
  });

  test('goods inventory items round-trip', async () => {
    const model = opened.slots[0].model;
    model.goods[0].count = 1;
    model.goods[1].count = 99;
    model.goods[2].itemId = 0x00cccccc;

    const { slots } = await writeAndReopen(opened.slots, opened.profileNumber);
    const expected = { ...getExpectedModel(1) };
    expected.goods[0] = { ...expected.goods[0], count: 1 };
    expected.goods[1] = { ...expected.goods[1], count: 99 };
    expected.goods[2] = { ...expected.goods[2], itemId: 0x00cccccc };
    assertModelsMatch(extractComparableModel(slots[0].session.fullModel), expected);
  });

  test('adding a new inventory item round-trips', async () => {
    const model = opened.slots[0].model;
    // Add a new weapon (no _ref → treated as new by mergeModel).
    // idx1/idx2 are NOT provided — the writer assigns them (= first available
    // empty slot number, matching the game's idx1 == slot invariant).
    model.weapons.push({
      _ref: undefined,
      itemId: 0x00055555,
      count: 7,
      misc1: 0x0f00,
      misc2: 0x01000000,
      durability: 150,
    });

    const { slots } = await writeAndReopen(opened.slots, opened.profileNumber);
    // The new item should appear (at some position in the array)
    const newWeapon = slots[0].model.weapons.find((w) => w.itemId === 0x00055555);
    expect(newWeapon).toBeDefined();
    expect(newWeapon.count).toBe(7);
    expect(newWeapon.durability).toBe(150);
  });

  test('new inventory item gets idx1/idx2 assigned by writer (first empty slot)', async () => {
    const model = opened.slots[0].model;
    // Factory items occupy slots 0–6 (2 weapons + 1 armor + 1 ring + 3 goods).
    // New items go into the first available empty slots, so idx1 = 7 and 8
    // (= slot number, matching the game's idx1 == slot invariant).

    // Add two new weapons (no _ref → new items)
    model.weapons.push({
      _ref: '',
      itemId: 0x00077777,
      count: 1,
      misc1: 0,
      misc2: 0x01000000,
      durability: 300,
    });
    model.weapons.push({
      _ref: '',
      itemId: 0x00088888,
      count: 1,
      misc1: 0,
      misc2: 0x01000000,
      durability: 300,
    });

    const { slots } = await writeAndReopen(opened.slots, opened.profileNumber);

    // Find the two new items in the re-read full model.
    // The slot.session.fullModel has the full model with idx1/idx2.
    const fullModel = slots[0].session.fullModel;
    const w1 = fullModel.weapons.find((w) => w.itemId === 0x00077777);
    const w2 = fullModel.weapons.find((w) => w.itemId === 0x00088888);

    expect(w1).toBeDefined();
    expect(w2).toBeDefined();

    // idx1 should equal idx2 (game's invariant)
    expect(w1.idx1).toBe(w1.idx2);
    expect(w2.idx1).toBe(w2.idx2);

    // idx1 = slot number: first new item gets slot 7, second gets slot 8
    expect(w1.idx1).toBe(7);
    expect(w2.idx1).toBe(8);
  });

  test('existing items preserve idx1/idx2 through round-trip', async () => {
    // This test verifies idx1/idx2 at the full-model level (not sanitized).
    // Factory weapons have idx1=[0,1], idx2=[0,1].
    const { slots } = await writeAndReopen(opened.slots, opened.profileNumber);
    const fullModel = slots[0].session.fullModel;

    expect(fullModel.weapons[0].idx1).toBe(0);
    expect(fullModel.weapons[0].idx2).toBe(0);
    expect(fullModel.weapons[1].idx1).toBe(1);
    expect(fullModel.weapons[1].idx2).toBe(1);

    // Verify equipment pointers survived the round-trip on disk
    const expected = getExpectedModel(1);
    expect(fullModel.leftHand1Ptr).toBe(expected.leftHand1Ptr);
    expect(fullModel.rightHand1Ptr).toBe(expected.rightHand1Ptr);
    expect(fullModel.helmetPtr).toBe(expected.helmetPtr);
    expect(fullModel.boltsPtr).toBe(0xffffffff); // empty
  });

  test('idx1/idx2 preserved when modifying other fields on existing items', async () => {
    const model = opened.slots[0].model;
    // Modify every UI-visible field on weapons[0]
    model.weapons[0].itemId = 0x00099999;
    model.weapons[0].count = 99;
    model.weapons[0].misc1 = 0x10ff;
    model.weapons[0].misc2 = 0x02000000;
    model.weapons[0].durability = 1;

    // Tamper with ro_idx1/ro_idx2 — these read-only display fields should
    // NOT affect the actual idx1/idx2 written to disk. The writer gets
    // idx1/idx2 from the original fullModel via _ref lookup, not from ro_.
    const w0 = /** @type {Record<string, any>} */ (model.weapons[0]);
    const w1 = /** @type {Record<string, any>} */ (model.weapons[1]);
    w0.ro_idx1 = 999;
    w0.ro_idx2 = 999;
    w1.ro_idx1 = 888;
    w1.ro_idx2 = 888;

    const { slots } = await writeAndReopen(opened.slots, opened.profileNumber);
    // Verify at the full-model level that idx1/idx2 are unchanged
    // (i.e. they match the original values, NOT the tampered ro_ values)
    const fullModel = slots[0].session.fullModel;
    expect(fullModel.weapons[0].idx1).toBe(0);
    expect(fullModel.weapons[0].idx2).toBe(0);
    expect(fullModel.weapons[1].idx1).toBe(1);
    expect(fullModel.weapons[1].idx2).toBe(1);
  });

  test('deleting an inventory item round-trips', async () => {
    const model = opened.slots[0].model;
    // Remove the second weapon
    model.weapons = [model.weapons[0]];

    const { slots } = await writeAndReopen(opened.slots, opened.profileNumber);
    expect(slots[0].model.weapons).toHaveLength(1);
  });

  test("deleting an item preserves remaining items' idx1/idx2", async () => {
    const model = opened.slots[0].model;
    // Remove the second weapon
    model.weapons = [model.weapons[0]];

    const { slots } = await writeAndReopen(opened.slots, opened.profileNumber);
    // Verify at the full-model level that the remaining weapon's idx1/idx2 are unchanged
    const fullModel = slots[0].session.fullModel;
    expect(fullModel.weapons[0].idx1).toBe(0);
    expect(fullModel.weapons[0].idx2).toBe(0);
  });

  // -------------------------------------------------------------------
  // Deposit (Thomas storage — all 4 categories)
  // -------------------------------------------------------------------

  test('deposit weapon round-trip (all sub-fields)', async () => {
    const model = opened.slots[0].model;
    model.deposit[0].itemId = 0xff0001;
    model.deposit[0].count = 50;
    model.deposit[0].durability = 250;
    model.deposit[0].unknown1 = 0x00000003;
    model.deposit[0].sortOrder = (0x10ff << 16) | 10;

    const { slots } = await writeAndReopen(opened.slots, opened.profileNumber);
    const expected = { ...getExpectedModel(1) };
    // When durability changes, flags[5..6] must also be updated to match
    // (writer writes durability to the same bytes as flags[5..6]).
    expected.deposit[0] = {
      ...expected.deposit[0],
      itemId: 0xff0001,
      count: 50,
      durability: 250,
      unknown1: 0x00000003,
      sortOrder: (0x10ff << 16) | 10,
      flags: [0x21, 0x00, 0x00, 0x00, 0x00, (250 >> 8) & 0xff, 250 & 0xff],
    };
    assertModelsMatch(extractComparableModel(slots[0].session.fullModel), expected);
  });

  test('deposit armor round-trip', async () => {
    const model = opened.slots[0].model;
    model.deposit[1].itemId = 0xff0002;
    model.deposit[1].count = 10;
    model.deposit[1].durability = 99;

    const { slots } = await writeAndReopen(opened.slots, opened.profileNumber);
    const expected = { ...getExpectedModel(1) };
    expected.deposit[1] = {
      ...expected.deposit[1],
      itemId: 0xff0002,
      count: 10,
      durability: 99,
      flags: [0x21, 0x00, 0x00, 0x00, 0x00, (99 >> 8) & 0xff, 99 & 0xff],
    };
    assertModelsMatch(extractComparableModel(slots[0].session.fullModel), expected);
  });

  test('deposit goods round-trip (count = 999, durability = 0)', async () => {
    const model = opened.slots[0].model;
    model.deposit[3].count = 999;
    model.deposit[3].itemId = 0xff0004;

    const { slots } = await writeAndReopen(opened.slots, opened.profileNumber);
    const expected = { ...getExpectedModel(1) };
    expected.deposit[3] = {
      ...expected.deposit[3],
      itemId: 0xff0004,
      count: 999,
    };
    assertModelsMatch(extractComparableModel(slots[0].session.fullModel), expected);
  });

  test('deposit durability=0 round-trips explicitly (not defaulted)', async () => {
    const model = opened.slots[0].model;
    model.deposit[0].durability = 0;

    const { slots } = await writeAndReopen(opened.slots, opened.profileNumber);
    expect(slots[0].model.deposit[0].durability).toBe(0);
  });

  test('deposit flags array round-trips (pad bytes + flag byte)', async () => {
    const model = opened.slots[0].model;
    // Modify only the flag byte and pad bytes (flags[0..4]).
    // flags[5..6] are the durability bytes, tested separately via durability field.
    model.deposit[0].flags = [0x25, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06];
    // Set durability to match flags[5..6] so the assertion is consistent
    model.deposit[0].durability = (0x05 << 8) | 0x06;

    const { slots } = await writeAndReopen(opened.slots, opened.profileNumber);
    const expected = { ...getExpectedModel(1) };
    expected.deposit[0] = {
      ...expected.deposit[0],
      durability: (0x05 << 8) | 0x06,
      flags: [0x25, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06],
    };
    assertModelsMatch(extractComparableModel(slots[0].session.fullModel), expected);
  });

  // -------------------------------------------------------------------
  // Deposit: add / delete
  // -------------------------------------------------------------------

  test('adding a new deposit item round-trips', async () => {
    const model = opened.slots[0].model;
    model.deposit.push({
      category: 'rings',
      itemId: 0x00ff0001,
      count: 1,
      durability: 0,
      unknown1: 0,
      sortOrder: 0,
      flags: [0x21, 0, 0, 0, 0, 0, 0],
    });

    const { slots } = await writeAndReopen(opened.slots, opened.profileNumber);
    expect(slots[0].model.deposit).toHaveLength(5); // factory has 4
    const newDep = slots[0].model.deposit.find((d) => d.itemId === 0x00ff0001);
    expect(newDep).toBeDefined();
    expect(newDep.count).toBe(1);
    expect(newDep.category).toBe('rings');
  });

  test('deleting deposit items round-trips', async () => {
    const model = opened.slots[0].model;
    // Keep only the first deposit item
    model.deposit = [model.deposit[0]];

    const { slots } = await writeAndReopen(opened.slots, opened.profileNumber);
    expect(slots[0].model.deposit).toHaveLength(1);
    expect(slots[0].model.deposit[0].itemId).toBe(0x00020001 + 1);
  });

  // -------------------------------------------------------------------
  // Spells
  // -------------------------------------------------------------------

  test('spell records round-trip (itemId, status, misc1, misc2)', async () => {
    const model = opened.slots[0].model;
    model.spells[0].itemId = 0x02000001;
    model.spells[0].status = 1;
    model.spells[0].misc1 = 5;
    model.spells[0].misc2 = 99;
    model.spells[1].status = 0;

    const { slots } = await writeAndReopen(opened.slots, opened.profileNumber);
    const expected = { ...getExpectedModel(1) };
    expected.spells[0] = {
      ...expected.spells[0],
      itemId: 0x02000001,
      status: 1,
      misc1: 5,
      misc2: 99,
    };
    expected.spells[1] = { ...expected.spells[1], status: 0 };
    assertModelsMatch(extractComparableModel(slots[0].session.fullModel), expected);
  });

  test('adding a new spell round-trips', async () => {
    const model = opened.slots[0].model;
    model.spells.push({ itemId: 0x03000001, status: 3, misc1: 0, misc2: 0 });

    const { slots } = await writeAndReopen(opened.slots, opened.profileNumber);
    const newSpell = slots[0].model.spells.find((s) => s.itemId === 0x03000001);
    expect(newSpell).toBeDefined();
    expect(newSpell.status).toBe(3);
  });

  test('removing a spell round-trips', async () => {
    const model = opened.slots[0].model;
    model.spells = [model.spells[0]];

    const { slots } = await writeAndReopen(opened.slots, opened.profileNumber);
    expect(slots[0].model.spells).toHaveLength(1);
  });

  // -------------------------------------------------------------------
  // Appearance (hair color)
  // -------------------------------------------------------------------

  test('negative hair color round-trips', async () => {
    const model = opened.slots[0].model;
    model.hairR = -0.5;

    const { slots } = await writeAndReopen(opened.slots, opened.profileNumber);
    const expected = { ...getExpectedModel(1), hairR: -0.5 };
    assertModelsMatch(extractComparableModel(slots[0].session.fullModel), expected, {
      floatPrecision: 5,
    });
  });

  // -------------------------------------------------------------------
  // Misc
  // -------------------------------------------------------------------

  test('clearCount round-trip', async () => {
    const model = opened.slots[0].model;
    model.clearCount = 255;

    const { slots } = await writeAndReopen(opened.slots, opened.profileNumber);
    const expected = { ...getExpectedModel(1), clearCount: 255 };
    assertModelsMatch(extractComparableModel(slots[0].session.fullModel), expected);
  });

  test('clearCount = 0 round-trips', async () => {
    const model = opened.slots[0].model;
    model.clearCount = 0;

    const { slots } = await writeAndReopen(opened.slots, opened.profileNumber);
    const expected = { ...getExpectedModel(1), clearCount: 0 };
    assertModelsMatch(extractComparableModel(slots[0].session.fullModel), expected);
  });

  // -------------------------------------------------------------------
  // NPC flags (nested objects)
  // -------------------------------------------------------------------

  test('all NPC flags set to false round-trip', async () => {
    const model = opened.slots[0].model;
    model.sageFreke = { friendly: false, hostile: false, dead: false };
    model.thomas = { friendly: false, hostile: false, dead: false };
    model.boldwin = { friendly: false, hostile: false, dead: false };

    const { slots } = await writeAndReopen(opened.slots, opened.profileNumber);
    const expected = {
      ...getExpectedModel(1),
      sageFreke: { friendly: false, hostile: false, dead: false },
      thomas: { friendly: false, hostile: false, dead: false },
      boldwin: { friendly: false, hostile: false, dead: false },
    };
    assertModelsMatch(extractComparableModel(slots[0].session.fullModel), expected);
  });

  // -------------------------------------------------------------------
  // SFO fields
  // -------------------------------------------------------------------

  test('profileNumber change round-trips through SFO', async () => {
    const { slots, profileNumber: readProfileNumber } = await writeAndReopen(opened.slots, 200);
    // profileNumber is written to PARAM.SFO at offset 0x570
    const sfoBytes = sandbox.readFile('PARAM.SFO');
    expect(sfoBytes[0x570]).toBe(200);
    // openSave should also read it back from the SFO
    expect(readProfileNumber).toBe(200);
    expect(slots[0].slot).toBe(1);
  });

  test('accountId change round-trips through SFO', async () => {
    const newAccountId = '11223344556677889900aabbccddeeff';

    const { filesToWrite } = await writeSaveData(
      opened.slots,
      [],
      opened.profileNumber,
      newAccountId,
    );
    sandbox.writeFiles(filesToWrite);

    // Read SFO from disk and verify accountId
    const sfoBytes = sandbox.readFile('PARAM.SFO');
    const readAcctId = getSfoAccountId(sfoBytes);
    expect(readAcctId).toBe(newAccountId);

    // Re-open and verify openSave returns the accountId
    const { accountId } = await openSave(sandbox.readFiles());
    expect(accountId).toBe(newAccountId);
  });

  // -------------------------------------------------------------------
  // SFO field preservation: modifying slot fields must NOT corrupt SFO
  // -------------------------------------------------------------------

  test('SFO fields preserved when only slot model fields change', async () => {
    // Modify slot-level fields only — do NOT change profileNumber or accountId.
    // The original bug (pre-b84344ac) caused accountId to be lost on save
    // because it was read from firstSlot.model.accountId (which could be
    // undefined), causing writeSfoAccountId to be silently skipped.
    const model = opened.slots[0].model;
    model.world = 9;
    model.vit = 99;
    model.name = 'Hero';

    // writeAndReopen defaults accountId to opened.accountId, simulating
    // the case where the user changes slot data but NOT folder-level fields.
    const { slots, profileNumber, accountId } = await writeAndReopen(
      opened.slots,
      opened.profileNumber,
    );

    // SFO fields must be preserved exactly
    expect(profileNumber).toBe(42);
    expect(accountId).toBe('aabbccdd11223344aabbccdd11223344');

    // Slot-level changes must also survive
    expect(slots[0].model.world).toBe(9);
    expect(slots[0].model.vit).toBe(99);
    expect(slots[0].model.name).toBe('Hero');
  });

  test('slot model fields preserved when only SFO fields change', async () => {
    // Change only SFO-level fields (profileNumber + accountId).
    // Slot model data must remain untouched.
    const newAccountId = '11223344556677889900aabbccddeeff';

    const { slots, profileNumber, accountId } = await writeAndReopen(
      opened.slots,
      200,
      newAccountId,
    );

    // SFO fields must reflect the new values
    expect(profileNumber).toBe(200);
    expect(accountId).toBe(newAccountId);

    // All slot model fields must match the original factory values
    assertModelsMatch(extractComparableModel(slots[0].session.fullModel), getExpectedModel(1));
  });

  test('combined SFO + slot model fields change simultaneously', async () => {
    // Change both SFO-level and slot-level fields at the same time.
    const model = opened.slots[0].model;
    model.vit = 80;
    model.name = 'Combined';
    const newAccountId = 'aabbccdd112233445566778899001122';

    const { slots, profileNumber, accountId } = await writeAndReopen(
      opened.slots,
      100,
      newAccountId,
    );

    // SFO fields must reflect the new values
    expect(profileNumber).toBe(100);
    expect(accountId).toBe(newAccountId);

    // Slot model changes must also survive
    expect(slots[0].model.vit).toBe(80);
    expect(slots[0].model.name).toBe('Combined');
  });

  // -------------------------------------------------------------------
  // SFO field edge cases
  // -------------------------------------------------------------------

  test('profileNumber = 0 round-trips through SFO', async () => {
    const { profileNumber } = await writeAndReopen(opened.slots, 0);
    expect(profileNumber).toBe(0);
    const sfoBytes = sandbox.readFile('PARAM.SFO');
    expect(sfoBytes[0x570]).toBe(0);
  });

  test('profileNumber = 255 round-trips through SFO', async () => {
    const { profileNumber } = await writeAndReopen(opened.slots, 255);
    expect(profileNumber).toBe(255);
    const sfoBytes = sandbox.readFile('PARAM.SFO');
    expect(sfoBytes[0x570]).toBe(255);
  });

  test('accountId cleared to zeros round-trips through SFO', async () => {
    // writeSfoAccountId accepts a 32-char all-zeros hex string.
    // This tests the "clear accountId" path (e.g., removing PSN binding).
    const clearedAccountId = '00000000000000000000000000000000';

    const { filesToWrite } = await writeSaveData(
      opened.slots,
      [],
      opened.profileNumber,
      clearedAccountId,
    );
    sandbox.writeFiles(filesToWrite);

    const sfoBytes = sandbox.readFile('PARAM.SFO');
    const readAcctId = getSfoAccountId(sfoBytes);
    expect(readAcctId).toBe(clearedAccountId);

    const { accountId } = await openSave(sandbox.readFiles());
    expect(accountId).toBe(clearedAccountId);
  });

  // -------------------------------------------------------------------
  // Full model round-trip (modify everything at once)
  // -------------------------------------------------------------------

  test('full model: modify all field groups simultaneously', async () => {
    const model = opened.slots[0].model;

    // Modify every normal-range scalar field across all groups in a single
    // round-trip. Genuine edge cases (U32 boundaries, 0xFFFFFFFF clearing,
    // CJK/empty/max names, negative floats, durability=0, deposit flags,
    // add/delete, idx1/idx2 invariants) are covered by their own focused
    // tests below/above. assertModelsMatch verifies every field — modified
    // ones against the new values AND unmodified arrays against the factory
    // model, so cross-field corruption is also caught here.
    model.world = 9;
    model.block = 2;
    model.x = -500.5;
    model.y = 300.25;
    model.z = 0.0;
    model.rot = 6.28318;

    // Vitals
    model.currHP = 1;
    model.currMaxHP = 2;
    model.maxHP = 3;
    model.currMP = 4;
    model.currMaxMP = 5;
    model.maxMP = 6;
    model.currStam = 7;
    model.currMaxStam = 8;
    model.maxStam = 9;

    // Stats
    model.vit = 50;
    model.int = 51;
    model.end = 52;
    model.str = 53;
    model.dex = 54;
    model.magic = 55;
    model.faith = 56;
    model.luck = 57;
    model.souls = 123456;
    model.soulMem = 9999999;
    model.levelsPurchased = 99;

    // Identity
    model.phantomType = 5;
    model.name = 'Hero';
    model.gender = 1;
    model.startClass = 7;

    // Spell slots / appearance
    model.spellSlots = 6;
    model.miracleSlots = 4;
    model.hairR = 0.75;
    model.hairG = 0.5;
    model.hairB = 0.25;

    // Tendency
    model.charTendency = 80.0;
    model.nexusTendency = -10.0;
    model.w1Tendency = 11.5;
    model.w2Tendency = -12.5;
    model.w3Tendency = 13.75;
    model.w4Tendency = -14.25;
    model.w5Tendency = 15.5;

    // Misc
    model.clearCount = 7;
    model.archSealed = !model.archSealed;

    // NPC flags (set all three objects fully)
    model.sageFreke = { friendly: false, hostile: true, dead: true };
    model.thomas = { friendly: false, hostile: true, dead: true };
    model.boldwin = { friendly: true, hostile: false, dead: true };

    const { slots } = await writeAndReopen(opened.slots, opened.profileNumber);

    const expected = {
      ...getExpectedModel(1),
      world: 9,
      block: 2,
      x: -500.5,
      y: 300.25,
      z: 0.0,
      rot: 6.28318,
      currHP: 1,
      currMaxHP: 2,
      maxHP: 3,
      currMP: 4,
      currMaxMP: 5,
      maxMP: 6,
      currStam: 7,
      currMaxStam: 8,
      maxStam: 9,
      vit: 50,
      int: 51,
      end: 52,
      str: 53,
      dex: 54,
      magic: 55,
      faith: 56,
      luck: 57,
      souls: 123456,
      soulMem: 9999999,
      levelsPurchased: 99,
      phantomType: 5,
      name: 'Hero',
      gender: 1,
      startClass: 7,
      spellSlots: 6,
      miracleSlots: 4,
      hairR: 0.75,
      hairG: 0.5,
      hairB: 0.25,
      charTendency: 80.0,
      nexusTendency: -10.0,
      w1Tendency: 11.5,
      w2Tendency: -12.5,
      w3Tendency: 13.75,
      w4Tendency: -14.25,
      w5Tendency: 15.5,
      clearCount: 7,
      archSealed: true,
      sageFreke: { friendly: false, hostile: true, dead: true },
      thomas: { friendly: false, hostile: true, dead: true },
      boldwin: { friendly: true, hostile: false, dead: true },
    };
    assertModelsMatch(extractComparableModel(slots[0].session.fullModel), expected, {
      floatPrecision: 5,
    });
  });

  // -------------------------------------------------------------------
  // No-op re-save: write without changes must be idempotent
  // -------------------------------------------------------------------

  test('no-op re-save preserves all fields unchanged', async () => {
    const model = /** @type {Record<string, any>} */ (opened.slots[0].model);

    // Tamper with ALL ro_ pointer fields — simulating a UI layer setting
    // bogus values. These must never reach disk: the writer only reads
    // specific named model fields (leftHand1, rightHand1, etc.) and resolves
    // pointers from the binary buffer. ro_ fields are simply ignored.
    model.ro_leftHand1Ptr = 0xdead0001;
    model.ro_rightHand1Ptr = 0xdead0002;
    model.ro_leftHand2Ptr = 0xdead0003;
    model.ro_rightHand2Ptr = 0xdead0004;
    model.ro_arrowsPtr = 0xdead0005;
    model.ro_boltsPtr = 0xdead0006;
    model.ro_helmetPtr = 0xdead0007;
    model.ro_chestPtr = 0xdead0008;
    model.ro_gauntletsPtr = 0xdead0009;
    model.ro_leggingsPtr = 0xdead000a;
    model.ro_ring1Ptr = 0xdead000c;
    model.ro_ring2Ptr = 0xdead000d;
    model.ro_quickSlot1Ptr = 0xdead000e;
    model.ro_quickSlot2Ptr = 0xdead000f;
    model.ro_quickSlot3Ptr = 0xdead0010;
    model.ro_quickSlot4Ptr = 0xdead0011;
    model.ro_quickSlot5Ptr = 0xdead0012;

    // Tamper with ALL ro_idx1/ro_idx2 on every inventory item
    for (const cat of ['weapons', 'armor', 'rings', 'goods']) {
      for (const item of model[cat]) {
        item.ro_idx1 = 999;
        item.ro_idx2 = 999;
      }
    }

    const { slots } = await writeAndReopen(opened.slots, opened.profileNumber);

    // All UI-visible fields should match the original factory values
    assertModelsMatch(extractComparableModel(slots[0].session.fullModel), getExpectedModel(1));

    // Equipment pointers on disk must match the ORIGINAL values (not tampered)
    const fm = slots[0].session.fullModel;
    const expected = getExpectedModel(1);
    expect(fm.leftHand1Ptr).toBe(expected.leftHand1Ptr);
    expect(fm.rightHand1Ptr).toBe(expected.rightHand1Ptr);
    expect(fm.leftHand2Ptr).toBe(expected.leftHand2Ptr);
    expect(fm.rightHand2Ptr).toBe(expected.rightHand2Ptr);
    expect(fm.arrowsPtr).toBe(expected.arrowsPtr);
    expect(fm.boltsPtr).toBe(0xffffffff); // was empty, stays empty
    expect(fm.helmetPtr).toBe(expected.helmetPtr);
    expect(fm.chestPtr).toBe(expected.chestPtr);
    expect(fm.gauntletsPtr).toBe(expected.gauntletsPtr);
    expect(fm.leggingsPtr).toBe(expected.leggingsPtr);
    expect(fm.ring1Ptr).toBe(expected.ring1Ptr);
    expect(fm.ring2Ptr).toBe(0xffffffff); // was empty, stays empty
    expect(fm.quickSlot1Ptr).toBe(expected.quickSlot1Ptr);
    expect(fm.quickSlot2Ptr).toBe(expected.quickSlot2Ptr);
    expect(fm.quickSlot3Ptr).toBe(0xffffffff); // was empty, stays empty
    expect(fm.quickSlot4Ptr).toBe(expected.quickSlot4Ptr);
    expect(fm.quickSlot5Ptr).toBe(expected.quickSlot5Ptr);

    // idx1/idx2 on disk must match the ORIGINAL values (not tampered 999)
    expect(fm.weapons[0].idx1).toBe(0);
    expect(fm.weapons[0].idx2).toBe(0);
    expect(fm.weapons[1].idx1).toBe(1);
    expect(fm.weapons[1].idx2).toBe(1);
    expect(fm.armor[0].idx1).toBe(2);
    expect(fm.rings[0].idx1).toBe(3);
    expect(fm.goods[0].idx1).toBe(4);
    expect(fm.goods[2].idx1).toBe(6);
  });

  // -------------------------------------------------------------------
  // New item placement: idx1 = slot invariant
  // -------------------------------------------------------------------

  test('new weapon added + equipped gets idx1 = slot and correct pointer', async () => {
    const model = opened.slots[0].model;

    // Add a new weapon that is NOT in the original inventory (no _ref)
    const newWeaponId = 0x000271f0; // distinct from factory items
    model.weapons.push({
      _ref: '',
      itemId: newWeaponId,
      count: 1,
      misc1: 0x1016,
      misc2: 0x01000000,
      durability: 200,
    });

    // Equip the new weapon in right-hand slot 1
    model.rightHand1 = newWeaponId;

    const { slots } = await writeAndReopen(opened.slots, opened.profileNumber);
    const fm = slots[0].session.fullModel;

    const newWeapon = fm.weapons.find((w) => w.itemId >>> 0 === newWeaponId >>> 0);
    expect(newWeapon).toBeDefined();

    // idx1 must equal the slot number (the game's invariant).
    // Factory fills 7 items (slots 0–6), so the new weapon goes to slot 7.
    expect(newWeapon._slot).toBe(7);
    expect(newWeapon.idx1).toBe(7); // NOT global-max+1
    expect(newWeapon.idx2).toBe(7);

    // Equipped ID and pointer must resolve correctly
    expect(fm.rightHand1 >>> 0).toBe(newWeaponId >>> 0);
    expect(fm.rightHand1Ptr >>> 0).toBe(7);
  });

  test('new ring added + equipped gets idx1 = slot and correct pointer', async () => {
    const model = opened.slots[0].model;

    const newRingId = 0x00020080;
    model.rings.push({
      _ref: '',
      itemId: newRingId,
      count: 1,
      misc1: 0x14,
      misc2: 0x01000000,
      durability: 0,
    });

    model.ring1 = newRingId;

    const { slots } = await writeAndReopen(opened.slots, opened.profileNumber);
    const fm = slots[0].session.fullModel;

    const newRing = fm.rings.find((r) => r.itemId >>> 0 === newRingId >>> 0);
    expect(newRing).toBeDefined();

    expect(newRing._slot).toBe(7);
    expect(newRing.idx1).toBe(7);
    expect(newRing.idx2).toBe(7);

    expect(fm.ring1 >>> 0).toBe(newRingId >>> 0);
    expect(fm.ring1Ptr >>> 0).toBe(7);
  });
});
