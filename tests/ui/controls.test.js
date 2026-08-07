/**
 * @jest-environment jsdom
 *
 * Tests for controls.js — combo box population and category data helpers.
 *
 * Covers fillSelect (indirectly via populateCombos), populateCombos,
 * getCategoryData (all branches), getSpellData, and SPELL_STATUS_NAMES.
 */

export {};

import { bad } from '../helpers.js';

const {
  populateCombos,
  getCategoryData,
  getSpellData,
  SPELL_STATUS_NAMES,
  getWeaponTypes,
  getGoodsTypes,
  getWeaponTypeData,
  getWeaponTypeDataForDeposit,
  getGoodsTypeData,
  getBaseWeaponsForType,
  getPathsForBaseWeapon,
  getUpgradeRefForItemId,
  resolveItemIdFromRef,
  isDurabilityVisible,
  isCountVisible,
  COUNT_LIMITS,
  SELECT_WIDTHS,
} = await import('../../js/ui/core/controls.js');
const db = await import('../../js/des-db/index.js');

const WEAPON_IDS = db.getItemIdsByCategory('weapons');
const ARMOR_IDS = db.getItemIdsByCategory('armor');
const RING_IDS = db.getItemIdsByCategory('rings');
const ITEM_IDS = db.getItemIdsByCategory('goods');
const SPELL_IDS = db.getItemIdsByCategory('spells');
const HAIRSTYLE_IDS = db.getItemIdsByCategory('hairstyles');
const START_CLASSES = db.getStartClasses();
const WARPS = db.getWarps();

describe('controls', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('populateCombos', () => {
    // populateCombos fills all three selects at once, so all must exist
    function buildAllSelects() {
      for (const id of ['hairstyle', 'startClass', 'warpLocation']) {
        const sel = document.createElement('select');
        sel.id = id;
        document.body.appendChild(sel);
      }
    }

    test('populates hairstyle select with all hairstyle options', () => {
      buildAllSelects();
      populateCombos();

      const sel = document.getElementById('hairstyle');
      const opts = sel.querySelectorAll('option');
      expect(opts.length).toBe(HAIRSTYLE_IDS.length);
      expect(opts[0].value).toBe(String(HAIRSTYLE_IDS[0]));
    });

    test('populates startClass select with all class options', () => {
      buildAllSelects();
      populateCombos();

      const sel = document.getElementById('startClass');
      const opts = sel.querySelectorAll('option');
      expect(opts.length).toBe(START_CLASSES.length);
      expect(opts[0].value).toBe('0');
      expect(opts[0].textContent).toBe(START_CLASSES[0]);
    });

    test('populates warpLocation select with all warp names', () => {
      buildAllSelects();
      populateCombos();

      const sel = document.getElementById('warpLocation');
      const opts = sel.querySelectorAll('option');
      expect(opts.length).toBe(WARPS.length);
      for (let i = 0; i < WARPS.length; i++) {
        expect(opts[i].value).toBe(String(i));
        expect(opts[i].textContent).toBe(WARPS[i].name);
      }
    });

    test('populates all three selects together', () => {
      document.body.innerHTML =
        '<select id="hairstyle"></select>' +
        '<select id="startClass"></select>' +
        '<select id="warpLocation"></select>';

      populateCombos();

      expect(
        /** @type {HTMLSelectElement} */ (document.getElementById('hairstyle')).options.length,
      ).toBe(HAIRSTYLE_IDS.length);
      expect(
        /** @type {HTMLSelectElement} */ (document.getElementById('startClass')).options.length,
      ).toBe(START_CLASSES.length);
      expect(
        /** @type {HTMLSelectElement} */ (document.getElementById('warpLocation')).options.length,
      ).toBe(WARPS.length);
    });
  });

  describe('getCategoryData', () => {
    test('returns weapons ids and names', () => {
      const result = getCategoryData('weapons');
      expect(result.ids).toEqual(WEAPON_IDS);
      expect(result.names).toEqual(db.getItemNamesByCategory('weapons'));
      expect(result.ids.length).toBeGreaterThan(0);
    });

    test('returns armor ids and names', () => {
      const result = getCategoryData('armor');
      expect(result.ids).toEqual(ARMOR_IDS);
      expect(result.names).toEqual(db.getItemNamesByCategory('armor'));
    });

    test('returns rings ids and names', () => {
      const result = getCategoryData('rings');
      expect(result.ids).toEqual(RING_IDS);
      expect(result.names).toEqual(db.getItemNamesByCategory('rings'));
    });

    test('returns goods ids and names', () => {
      const result = getCategoryData('goods');
      expect(result.ids).toEqual(ITEM_IDS);
      expect(result.names).toEqual(db.getItemNamesByCategory('goods'));
    });

    test('returns empty arrays for unknown category (default branch)', () => {
      const result = getCategoryData(bad('unknown'));
      expect(result.ids).toEqual([]);
      expect(result.names).toEqual([]);
    });

    test('returns empty arrays for undefined category', () => {
      const result = getCategoryData(undefined);
      expect(result.ids).toEqual([]);
      expect(result.names).toEqual([]);
    });

    test('returns empty arrays for null category', () => {
      const result = getCategoryData(null);
      expect(result.ids).toEqual([]);
      expect(result.names).toEqual([]);
    });
  });

  describe('getSpellData', () => {
    test('returns spell ids and names', () => {
      const result = getSpellData();
      expect(result.ids).toEqual(SPELL_IDS);
      expect(result.names).toEqual(db.getItemNamesByCategory('spells'));
      expect(result.ids.length).toBeGreaterThan(0);
    });

    test('returns a consistent reference (not a copy)', () => {
      const a = getSpellData();
      const b = getSpellData();
      expect(a.ids).toBe(b.ids);
      expect(a.names).toBe(b.names);
    });
  });

  describe('SPELL_STATUS_NAMES', () => {
    test('has 4 status names', () => {
      expect(SPELL_STATUS_NAMES).toHaveLength(4);
    });

    test('contains expected status names', () => {
      expect(SPELL_STATUS_NAMES[0]).toBe('Unavailable');
      expect(SPELL_STATUS_NAMES[1]).toBe('Unknown');
      expect(SPELL_STATUS_NAMES[2]).toBe('Known');
      expect(SPELL_STATUS_NAMES[3]).toBe('Memorized');
    });
  });

  describe('getWeaponTypes / getGoodsTypes', () => {
    test('getWeaponTypes returns array with correct typeIds', () => {
      const types = getWeaponTypes();
      expect(Array.isArray(types)).toBe(true);
      expect(types.length).toBeGreaterThan(0);
      const typeIds = types.map((t) => t.typeId);
      expect(typeIds).toContain(1); // Weapon
      expect(typeIds).toContain(2); // Shield
      expect(typeIds).toContain(3); // Bow
      expect(typeIds).toContain(4); // Ammo
      expect(typeIds).toContain(6); // Casting Tool
    });

    test('each weapon type has a name', () => {
      for (const t of getWeaponTypes()) {
        expect(typeof t.name).toBe('string');
        expect(t.name.length).toBeGreaterThan(0);
      }
    });

    test('getGoodsTypes returns array with correct typeIds', () => {
      const types = getGoodsTypes();
      expect(Array.isArray(types)).toBe(true);
      expect(types.length).toBeGreaterThan(0);
      const typeIds = types.map((t) => t.typeId);
      expect(typeIds).toContain(9); // Ore
      expect(typeIds).toContain(10); // Consumables
      expect(typeIds).toContain(11); // Souls
      expect(typeIds).toContain(12); // Key Items
    });

    test('each goods type has a name', () => {
      for (const t of getGoodsTypes()) {
        expect(typeof t.name).toBe('string');
        expect(t.name.length).toBeGreaterThan(0);
      }
    });
  });

  describe('getWeaponTypeData / getGoodsTypeData', () => {
    test('getWeaponTypeData returns non-empty arrays for known types', () => {
      for (const { typeId } of getWeaponTypes()) {
        const data = getWeaponTypeData(typeId);
        expect(data.ids.length).toBeGreaterThan(0);
        expect(data.names.length).toBe(data.ids.length);
      }
    });

    test('getWeaponTypeData returns empty for invalid typeId', () => {
      const data = getWeaponTypeData(999);
      expect(data.ids).toEqual([]);
      expect(data.names).toEqual([]);
    });

    test('getWeaponTypeDataForDeposit returns non-empty for known types', () => {
      for (const { typeId } of getWeaponTypes()) {
        const data = getWeaponTypeDataForDeposit(typeId);
        // Deposit data may be same or smaller than inventory (excludes experimental)
        expect(data.ids.length).toBeGreaterThan(0);
        expect(data.names.length).toBe(data.ids.length);
      }
    });

    test('getWeaponTypeDataForDeposit returns empty for invalid typeId', () => {
      const data = getWeaponTypeDataForDeposit(999);
      expect(data.ids).toEqual([]);
      expect(data.names).toEqual([]);
    });

    test('getGoodsTypeData returns non-empty arrays for known types', () => {
      for (const { typeId } of getGoodsTypes()) {
        const data = getGoodsTypeData(typeId);
        expect(data.ids.length).toBeGreaterThan(0);
        expect(data.names.length).toBe(data.ids.length);
      }
    });

    test('getGoodsTypeData returns empty for invalid typeId', () => {
      const data = getGoodsTypeData(999);
      expect(data.ids).toEqual([]);
      expect(data.names).toEqual([]);
    });
  });

  describe('getBaseWeaponsForType', () => {
    test('returns non-empty array for weapon type 1', () => {
      const bases = getBaseWeaponsForType(1);
      expect(bases.length).toBeGreaterThan(0);
      expect(bases[0]).toHaveProperty('baseId');
      expect(bases[0]).toHaveProperty('name');
    });

    test('returns non-empty array for weapon type 2', () => {
      const bases = getBaseWeaponsForType(2);
      expect(bases.length).toBeGreaterThan(0);
    });

    test('returns non-empty array for weapon type 3', () => {
      const bases = getBaseWeaponsForType(3);
      expect(bases.length).toBeGreaterThan(0);
    });

    test('returns empty array for invalid typeId (4 = Ammo)', () => {
      // Type 4 (Ammo) doesn't have base weapons
      const bases = getBaseWeaponsForType(4);
      expect(bases).toEqual([]);
    });

    test('returns empty array for invalid typeId (99)', () => {
      const bases = getBaseWeaponsForType(99);
      expect(bases).toEqual([]);
    });
  });

  describe('getPathsForBaseWeapon', () => {
    test('returns array of path objects for a valid base weapon', () => {
      const bases = getBaseWeaponsForType(1);
      const firstBase = bases[0];
      const paths = getPathsForBaseWeapon(firstBase.baseId);
      expect(paths.length).toBeGreaterThan(0);
      for (const p of paths) {
        expect(p).toHaveProperty('pathId');
        expect(p).toHaveProperty('name');
        expect(p).toHaveProperty('levels');
        expect(Array.isArray(p.levels)).toBe(true);
      }
    });

    test('returns empty array for invalid baseId', () => {
      const paths = getPathsForBaseWeapon(99999);
      expect(paths).toEqual([]);
    });
  });

  describe('getUpgradeRefForItemId', () => {
    test('returns ref array for a weapon with upgrade_ref', () => {
      // Find a weapon with upgrade_ref
      let found = false;
      for (const id of WEAPON_IDS) {
        const ref = getUpgradeRefForItemId(id);
        if (ref) {
          expect(Array.isArray(ref)).toBe(true);
          expect(ref.length).toBeGreaterThanOrEqual(2);
          found = true;
          break;
        }
      }
      expect(found).toBe(true);
    });

    test('returns null for unknown item ID', () => {
      const ref = getUpgradeRefForItemId(0xdeadbeef);
      expect(ref).toBeNull();
    });

    test('returns null for itemId 0', () => {
      // Item 0 doesn't exist — getItem throws, caught by try/catch
      const ref = getUpgradeRefForItemId(0);
      // getItem throws for id 0, so catch returns null
      expect(ref).toBeNull();
    });
  });

  describe('resolveItemIdFromRef', () => {
    test('returns numeric itemId for valid ref', () => {
      // Find a valid ref from an existing weapon
      for (const id of WEAPON_IDS) {
        const ref = getUpgradeRefForItemId(id);
        if (ref) {
          const resolved = resolveItemIdFromRef(ref[0], ref[1], ref[2]);
          expect(resolved).not.toBeNull();
          expect(typeof resolved).toBe('number');
          return;
        }
      }
    });

    test('returns null for invalid ref', () => {
      const result = resolveItemIdFromRef(99999, 999, 999);
      expect(result).toBeNull();
    });
  });

  describe('isDurabilityVisible', () => {
    test('weapons (type 1) show durability', () => {
      expect(isDurabilityVisible('weapons', 1)).toBe(true);
    });

    test('weapons (type 2 Shield) show durability', () => {
      expect(isDurabilityVisible('weapons', 2)).toBe(true);
    });

    test('weapons (type 4 Ammo) hide durability', () => {
      expect(isDurabilityVisible('weapons', 4)).toBe(false);
    });

    test('armor always shows durability', () => {
      expect(isDurabilityVisible('armor', null)).toBe(true);
    });

    test('rings hide durability', () => {
      expect(isDurabilityVisible('rings', null)).toBe(false);
    });

    test('goods hide durability', () => {
      expect(isDurabilityVisible('goods', 9)).toBe(false);
    });

    test('unknown category defaults to true', () => {
      expect(isDurabilityVisible(bad('unknown'), null)).toBe(true);
    });
  });

  describe('isCountVisible', () => {
    test('weapons type 4 (Ammo) show count', () => {
      expect(isCountVisible('weapons', 4)).toBe(true);
    });

    test('weapons type 1 (Weapon) hide count', () => {
      expect(isCountVisible('weapons', 1)).toBe(false);
    });

    test('weapons type 2 (Shield) hide count', () => {
      expect(isCountVisible('weapons', 2)).toBe(false);
    });

    test('goods always show count', () => {
      for (const { typeId } of getGoodsTypes()) {
        expect(isCountVisible('goods', typeId)).toBe(true);
      }
    });

    test('armor hides count', () => {
      expect(isCountVisible('armor', null)).toBe(false);
    });

    test('rings hide count', () => {
      expect(isCountVisible('rings', null)).toBe(false);
    });

    test('unknown category defaults to true', () => {
      expect(isCountVisible(bad('unknown'), null)).toBe(true);
    });
  });

  describe('COUNT_LIMITS', () => {
    test('has inventory limits', () => {
      expect(COUNT_LIMITS.inventory).toEqual({ min: 1, max: 99 });
    });
    test('has deposit limits', () => {
      expect(COUNT_LIMITS.deposit).toEqual({ min: 1, max: 99 });
    });
    test('has ammo limits (wider range for arrows/bolts)', () => {
      expect(COUNT_LIMITS.ammo).toEqual({ min: 1, max: 999 });
    });
  });

  describe('SELECT_WIDTHS', () => {
    test('has width for spells', () => {
      expect(typeof SELECT_WIDTHS.spells).toBe('number');
      expect(SELECT_WIDTHS.spells).toBeGreaterThan(0);
    });

    test('has width for armor and rings', () => {
      expect(typeof SELECT_WIDTHS.armor).toBe('number');
      expect(typeof SELECT_WIDTHS.rings).toBe('number');
    });

    test('has width for goods', () => {
      expect(typeof SELECT_WIDTHS.goods).toBe('number');
    });

    test('has widths for each weapon type', () => {
      for (const { typeId } of getWeaponTypes()) {
        expect(typeof SELECT_WIDTHS[`weapons-${typeId}`]).toBe('number');
        expect(typeof SELECT_WIDTHS[`weapons-${typeId}-deposit`]).toBe('number');
        expect(typeof SELECT_WIDTHS[`base-weapons-${typeId}`]).toBe('number');
      }
    });

    test('has widths for each goods type', () => {
      for (const { typeId } of getGoodsTypes()) {
        expect(typeof SELECT_WIDTHS[`goods-${typeId}`]).toBe('number');
      }
    });

    test('has path and level widths', () => {
      expect(typeof SELECT_WIDTHS.path).toBe('number');
      expect(typeof SELECT_WIDTHS.level).toBe('number');
    });
  });
});
