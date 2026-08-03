/**
 * Tests for model sanitization and merge logic.
 */
import { sanitizeModel, mergeModel } from '../../js/des-savefile/model.js';

// Helper: create a full model (as reader.readSave would produce)
function makeFullModel() {
  return {
    world: 1,
    block: 2,
    x: 100.5,
    y: 200.0,
    z: 300.0,
    rot: 45.0,
    vit: 50,
    str: 30,
    souls: 99999,
    name: 'TestChar',
    weapons: [
      {
        itemId: 0x10000001,
        count: 1,
        idx1: 10,
        misc1: 0x0ffc,
        idx2: 0,
        misc2: 0x01000000,
        durability: 300,
        _slot: 0,
      },
      {
        itemId: 0x10000002,
        count: 1,
        idx1: 11,
        misc1: 0x1000,
        idx2: 1,
        misc2: 0x01000000,
        durability: 250,
        _slot: 1,
      },
    ],
    armor: [
      {
        itemId: 0x20000001,
        count: 1,
        idx1: 20,
        misc1: 0x03f4,
        idx2: 2,
        misc2: 0x01000000,
        durability: 200,
        _slot: 5,
      },
    ],
    rings: [
      {
        itemId: 0x30000001,
        count: 1,
        idx1: 30,
        misc1: 0x0013,
        idx2: 3,
        misc2: 0x01000000,
        durability: 0,
        _slot: 10,
      },
    ],
    goods: [
      {
        itemId: 0x40000001,
        count: 99,
        idx1: 40,
        misc1: 0x0001,
        idx2: 4,
        misc2: 0x01000000,
        durability: 0,
        _slot: 15,
      },
    ],
    deposit: [
      {
        category: 'weapons',
        itemId: 0x10000002,
        count: 1,
        unknown1: 0,
        sortOrder: 0x00010000,
        flags: [0x21, 0, 0, 0, 0, 0x01, 0x2c],
      },
      {
        category: 'armor',
        itemId: 0x20000001,
        count: 5,
        unknown1: 0,
        sortOrder: 0x00010000,
        flags: [0x21, 0, 0, 0, 0, 0x00, 0xc8],
      },
      {
        category: 'goods',
        itemId: 0x40000002,
        count: 99,
        unknown1: 0,
        sortOrder: 0x00010000,
        flags: [0x21, 0, 0, 0, 0, 0, 0],
      },
    ],
    spells: [{ itemId: 0x10000007, status: 2, misc1: 0, misc2: 0 }],
    sageFreke: { friendly: true, hostile: false, dead: false },
    thomas: { friendly: true, hostile: false, dead: false },
    boldwin: { friendly: false, hostile: true, dead: false },
    archSealed: true,
    clearCount: 3,
    charTendency: 50.0,
    nexusTendency: -20.0,
  };
}

describe('sanitizeModel', () => {
  test('strips binary internals from inventory items', () => {
    const full = makeFullModel();
    const { model: sanitized } = sanitizeModel(full);

    const w = sanitized.weapons[0];
    expect(w._ref).toBe('inv:0');
    expect(w.itemId).toBe(0x10000001);
    expect(w.count).toBe(1);
    expect(w.misc1).toBe(0x0ffc);
    expect(w.durability).toBe(300);
    expect(w.misc2).toBe(0x01000000);
    // _slot, idx1, idx2 are all binary-internal — stripped from sanitized
    expect(w).not.toHaveProperty('_slot');
    expect(w).not.toHaveProperty('idx1');
    expect(w).not.toHaveProperty('idx2');
  });

  test('rings item exposes UI-visible fields with _ref', () => {
    const full = makeFullModel();
    const { model: sanitized } = sanitizeModel(full);

    const r = sanitized.rings[0];
    expect(r._ref).toBe('inv:10');
    expect(r).not.toHaveProperty('_slot');
    expect(r).not.toHaveProperty('idx1');
    expect(r).not.toHaveProperty('idx2');
    expect(r.misc2).toBe(0x01000000);
  });

  test('armor item exposes UI-visible fields with _ref', () => {
    const full = makeFullModel();
    const { model: sanitized } = sanitizeModel(full);

    const a = sanitized.armor[0];
    expect(a._ref).toBe('inv:5');
    expect(a).not.toHaveProperty('_slot');
    expect(a).not.toHaveProperty('idx1');
    expect(a).not.toHaveProperty('idx2');
    expect(a.misc2).toBe(0x01000000);
  });

  test('armor preserves misc1 (sortId) through sanitize→merge round-trip', () => {
    const full = makeFullModel();
    const { model: sanitized } = sanitizeModel(full);

    // misc1 should be present and correct after sanitization
    expect(sanitized.armor[0].misc1).toBe(0x03f4);

    // Round-trip through merge — misc1 should survive
    const merged = mergeModel(full, sanitized);
    expect(merged.armor[0].misc1).toBe(0x03f4);
  });

  test('rings preserves misc1 (sortId) through sanitize→merge round-trip', () => {
    const full = makeFullModel();
    const { model: sanitized } = sanitizeModel(full);

    // misc1 should be present and correct after sanitization
    expect(sanitized.rings[0].misc1).toBe(0x0013);

    // Round-trip through merge — misc1 should survive
    const merged = mergeModel(full, sanitized);
    expect(merged.rings[0].misc1).toBe(0x0013);
  });

  test('misc1 survives when modified in sanitized model', () => {
    const full = makeFullModel();
    const { model: sanitized } = sanitizeModel(full);

    // Change misc1 on an armor item
    sanitized.armor[0].misc1 = 0x07dc; // gauntlet sortId
    sanitized.rings[0].misc1 = 0x05;

    const merged = mergeModel(full, sanitized);
    expect(merged.armor[0].misc1).toBe(0x07dc);
    expect(merged.rings[0].misc1).toBe(0x05);
  });

  test('goods item exposes UI-visible fields with _ref', () => {
    const full = makeFullModel();
    const { model: sanitized } = sanitizeModel(full);

    const g = sanitized.goods[0];
    expect(g.misc1).toBe(0x0001);
    expect(g._ref).toBe('inv:15');
    expect(g).not.toHaveProperty('_slot');
    expect(g).not.toHaveProperty('idx1');
    expect(g).not.toHaveProperty('idx2');
    expect(g.misc2).toBe(0x01000000);
  });

  test('deposit items carry binary fields (no _ref)', () => {
    const full = makeFullModel();
    const { model: sanitized } = sanitizeModel(full);

    const d0 = sanitized.deposit[0];
    expect(d0.category).toBe('weapons');
    expect(d0.itemId).toBe(0x10000002);
    expect(d0.count).toBe(1);
    // Binary fields are carried on the sanitized model (stored as hidden
    // DOM dataset attributes by the UI), not stripped via _ref.
    expect(d0.unknown1).toBe(0);
    expect(d0.sortOrder).toBe(0x00010000);
    expect(d0.flags).toEqual([0x21, 0, 0, 0, 0, 0x01, 0x2c]);
    // No _ref token on deposit items
    expect(d0).not.toHaveProperty('_ref');
  });

  test('preserves non-inventory fields', () => {
    const full = makeFullModel();
    const { model: sanitized } = sanitizeModel(full);

    expect(sanitized.vit).toBe(50);
    expect(sanitized.str).toBe(30);
    expect(sanitized.name).toBe('TestChar');
    expect(sanitized.souls).toBe(99999);
    expect(sanitized.sageFreke.friendly).toBe(true);
    expect(sanitized.archSealed).toBe(true);
    expect(sanitized.clearCount).toBe(3);
    expect(sanitized.charTendency).toBe(50.0);
  });

  test('preserves spells unchanged', () => {
    const full = makeFullModel();
    const { model: sanitized } = sanitizeModel(full);

    expect(sanitized.spells.length).toBe(1);
    expect(sanitized.spells[0].itemId).toBe(0x10000007);
    expect(sanitized.spells[0].status).toBe(2);
  });

  // NPC flag mutation on the sanitized model must NOT corrupt the original
  // fullModel (which must remain pristine for mergeModel _ref lookups).
  test('NPC flag mutations on sanitized model do not corrupt fullModel', () => {
    const full = makeFullModel();
    const { model: sanitized } = sanitizeModel(full);

    // Verify initial state
    expect(sanitized.sageFreke.friendly).toBe(true);
    expect(full.sageFreke.friendly).toBe(true);

    // Mutate the sanitized model (simulating UI edits)
    sanitized.sageFreke.friendly = false;
    sanitized.sageFreke.dead = true;
    sanitized.thomas.friendly = false;
    sanitized.boldwin.hostile = false;

    // The original fullModel must be unchanged
    expect(full.sageFreke.friendly).toBe(true);
    expect(full.sageFreke.dead).toBe(false);
    expect(full.thomas.friendly).toBe(true);
    expect(full.boldwin.hostile).toBe(true);
  });
});

describe('mergeModel', () => {
  test('restores binary internals for existing inventory items', () => {
    const full = makeFullModel();
    const { model: sanitized } = sanitizeModel(full);
    const merged = mergeModel(full, sanitized);

    const w = merged.weapons[0];
    expect(w._slot).toBe(0);
    expect(w.idx1).toBe(10);
    expect(w.idx2).toBe(0);
    expect(w.misc2).toBe(0x01000000);
    expect(w.itemId).toBe(0x10000001);
    expect(w.durability).toBe(300);
  });

  test('passes through user-provided values for new inventory items', () => {
    const full = makeFullModel();
    const { model: sanitized } = sanitizeModel(full);

    // Add a new weapon (as the UI Add button does — no idx1/idx2)
    sanitized.weapons.push({
      _ref: '',
      itemId: 0x10000020,
      count: 1,
      misc1: 0,
      durability: 999,
      misc2: 0x01000000,
    });

    const merged = mergeModel(full, sanitized);
    const newW = merged.weapons[merged.weapons.length - 1];
    expect(newW.itemId).toBe(0x10000020);
    expect(newW.misc2).toBe(0x01000000); // user-provided
    expect(newW._slot).toBeUndefined(); // new item — no physical slot
  });

  test('restores unknown1/sortOrder/flags for existing deposit items', () => {
    const full = makeFullModel();
    const { model: sanitized } = sanitizeModel(full);
    const merged = mergeModel(full, sanitized);

    const d0 = merged.deposit[0];
    expect(d0.unknown1).toBe(0);
    expect(d0.sortOrder).toBe(0x00010000);
    expect(d0.flags).toEqual([0x21, 0, 0, 0, 0, 0x01, 0x2c]);
  });

  test('assigns structural defaults for new deposit items (no durability packing)', () => {
    const full = makeFullModel();
    const { model: sanitized } = sanitizeModel(full);

    // Add a new deposit item
    sanitized.deposit.push({
      _ref: '',
      category: 'weapons',
      itemId: 0x10000005,
      count: 1,
    });

    const merged = mergeModel(full, sanitized);
    const newD = merged.deposit[merged.deposit.length - 1];
    expect(newD.unknown1).toBe(0);
    expect(newD.sortOrder).toBe(0);
    // Structural defaults only — flag byte 0x21, no durability packed
    expect(newD.flags).toEqual([0x21, 0, 0, 0, 0, 0, 0]);
  });

  test('handles deleted items (fewer items in sanitized than original)', () => {
    const full = makeFullModel();
    const { model: sanitized } = sanitizeModel(full);

    // Remove one weapon
    sanitized.weapons = sanitized.weapons.slice(0, 1);

    const merged = mergeModel(full, sanitized);
    expect(merged.weapons.length).toBe(1);
  });

  test('round-trip: sanitize → merge preserves all editable fields', () => {
    const full = makeFullModel();
    const { model: sanitized } = sanitizeModel(full);

    // Modify some values in the sanitized model
    sanitized.vit = 99;
    sanitized.weapons[0].count = 5;
    sanitized.deposit[0].count = 10;
    sanitized.souls = 500000;

    const merged = mergeModel(full, sanitized);

    expect(merged.vit).toBe(99);
    expect(merged.weapons[0].count).toBe(5);
    expect(merged.weapons[0]._slot).toBe(0); // binary internal preserved
    expect(merged.deposit[0].count).toBe(10);
    expect(merged.deposit[0].flags).toEqual([0x21, 0, 0, 0, 0, 0x01, 0x2c]);
    expect(merged.souls).toBe(500000);
  });

  test('new deposit goods get structural defaults (no durability)', () => {
    const full = makeFullModel();
    const { model: sanitized } = sanitizeModel(full);

    sanitized.deposit.push({
      _ref: '',
      category: 'goods',
      itemId: 0x40000003,
      count: 50,
    });

    const merged = mergeModel(full, sanitized);
    const newD = merged.deposit[merged.deposit.length - 1];
    expect(newD.flags).toEqual([0x21, 0, 0, 0, 0, 0, 0]);
  });

  // _ref is stripped from merged output so it doesn't flow through to the
  // writer as dead data.
  test('merged output has no _ref on inventory or deposit items', () => {
    const full = makeFullModel();
    const { model: sanitized } = sanitizeModel(full);

    const merged = mergeModel(full, sanitized);

    // Inventory items: _slot restored, _ref stripped
    for (const w of merged.weapons) {
      expect(w).not.toHaveProperty('_ref');
      expect(w).toHaveProperty('_slot');
    }
    for (const a of merged.armor) {
      expect(a).not.toHaveProperty('_ref');
    }
    for (const r of merged.rings) {
      expect(r).not.toHaveProperty('_ref');
    }
    for (const g of merged.goods) {
      expect(g).not.toHaveProperty('_ref');
    }

    // Deposit items: unknown1/sortOrder/flags restored, _ref stripped
    for (const d of merged.deposit) {
      expect(d).not.toHaveProperty('_ref');
      expect(d).toHaveProperty('unknown1');
    }
  });

  // mergeModel must NOT attach private `_deletedSlots` to the returned model.
  // Instead, deleted slots go through the `out` bag.
  test('merged model has no _deletedSlots (deleted slots via out bag)', () => {
    const full = makeFullModel();
    const { model: sanitized } = sanitizeModel(full);

    // Remove one weapon to create a deletion
    sanitized.weapons = sanitized.weapons.slice(0, 1);

    const out = {};
    const merged = mergeModel(full, sanitized, out);

    // The merged model must NOT have _deletedSlots
    expect(merged).not.toHaveProperty('_deletedSlots');

    // The out bag should contain the deleted slot number
    expect(out.deletedSlots).toBeDefined();
    expect(Array.isArray(out.deletedSlots)).toBe(true);
    expect(out.deletedSlots).toContain(1); // weapons[1] had _slot=1
  });

  test('mergeModel without out bag still works (no deletedSlots tracking)', () => {
    const full = makeFullModel();
    const { model: sanitized } = sanitizeModel(full);
    sanitized.weapons = sanitized.weapons.slice(0, 1);

    // Call without out — should not throw, model should be clean
    const merged = mergeModel(full, sanitized);
    expect(merged).not.toHaveProperty('_deletedSlots');
    expect(merged.weapons).toHaveLength(1);
  });
});

/* ========================================================================
 * Branch coverage: empty/missing category arrays
 * ==================================================================== */

describe('sanitizeModel: branch coverage', () => {
  test('handles model with null/undefined category arrays', () => {
    const full = makeFullModel();
    full.weapons = null;
    full.armor = undefined;
    full.rings = null;
    full.goods = undefined;
    full.deposit = null;
    full.spells = undefined;
    expect(() => sanitizeModel(full)).not.toThrow();
  });

  test('handles model with missing NPC flag objects', () => {
    const full = makeFullModel();
    delete full.sageFreke;
    delete full.thomas;
    delete full.boldwin;
    expect(() => sanitizeModel(full)).not.toThrow();
  });

  test('sanitizes deposit items without flags array', () => {
    const full = makeFullModel();
    full.deposit[0].flags = undefined;
    full.deposit[1].flags = 'not-an-array';
    const { model: sanitized } = sanitizeModel(full);
    // Should get default flags array
    expect(sanitized.deposit[0].flags).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(sanitized.deposit[1].flags).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  test('deposit durability defaults to 0 when undefined', () => {
    const full = makeFullModel();
    full.deposit[0].durability = undefined;
    const { model: sanitized } = sanitizeModel(full);
    expect(sanitized.deposit[0].durability).toBe(0);
  });
});

describe('mergeModel: branch coverage', () => {
  test('handles sanitized model with null/undefined category arrays', () => {
    const full = makeFullModel();
    const { model: sanitized } = sanitizeModel(full);
    sanitized.weapons = null;
    sanitized.armor = undefined;
    sanitized.rings = null;
    sanitized.goods = undefined;
    sanitized.deposit = null;
    sanitized.spells = undefined;
    expect(() => mergeModel(full, sanitized)).not.toThrow();
  });

  test('handles original model with null/undefined category arrays', () => {
    const full = makeFullModel();
    full.weapons = null;
    full.armor = undefined;
    full.rings = null;
    full.goods = undefined;
    const { model: sanitized } = sanitizeModel(makeFullModel());
    expect(() => mergeModel(full, sanitized)).not.toThrow();
  });

  test('handles deposit items with unknown1 defined (no default assigned)', () => {
    const full = makeFullModel();
    const { model: sanitized } = sanitizeModel(full);
    // Existing items have unknown1 defined → should NOT get defaults
    const merged = mergeModel(full, sanitized);
    expect(merged.deposit[0].unknown1).toBe(0);
  });

  test('handles inventory items with no _ref (treated as new)', () => {
    const full = makeFullModel();
    const { model: sanitized } = sanitizeModel(full);
    // Add an item without _ref
    sanitized.weapons.push({
      itemId: 0x99999999,
      count: 1,
      misc1: 0,
      misc2: 0x01000000,
      durability: 100,
    });
    const merged = mergeModel(full, sanitized);
    const newW = merged.weapons[merged.weapons.length - 1];
    expect(newW._slot).toBeUndefined();
  });

  test('handles inventory item with _ref that does not match any original', () => {
    const full = makeFullModel();
    const { model: sanitized } = sanitizeModel(full);
    sanitized.weapons[0]._ref = 'inv:999'; // slot doesn't exist in original
    const merged = mergeModel(full, sanitized);
    // Item with invalid _ref gets no _slot restored
    expect(merged.weapons[0]._slot).toBeUndefined();
  });

  test('deposit merge with unknown1 present (no defaults)', () => {
    const full = makeFullModel();
    const { model: sanitized } = sanitizeModel(full);
    // All existing deposit items have unknown1 defined → no defaults needed
    const merged = mergeModel(full, sanitized);
    for (const d of merged.deposit) {
      expect(d.unknown1).toBe(0);
    }
  });
});
