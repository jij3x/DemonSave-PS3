/**
 * @jest-environment jsdom
 *
 * Tests for inventory-table.js — inventory table rendering and collection.
 */

import {
  renderInventory,
  makeInventoryRow,
  collectInventory,
} from '../../js/ui/tables/inventory-table.js';
import { getCategoryData } from '../../js/ui/core/controls.js';

const IDS = {
  weapon: 10000, // Dagger (type 1)
  shield: 150000, // type 2
  ammo: 160000, // type 4
  armor: 100000, // Gold Mask
  ring: 100, // Ring of Great Strength
  good: 6, // Key Item (type 12)
};

// Build a table with data-* attributes from a plain object.
function typedTable(category, attrs = {}) {
  const table = document.createElement('table');
  table.className = 'inv-table';
  table.dataset.category = category;
  for (const [k, v] of Object.entries(attrs)) table.dataset[k] = String(v);
  const tbody = document.createElement('tbody');
  table.appendChild(tbody);
  document.body.appendChild(table);
  return table;
}

describe('inventory-table', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('makeInventoryRow', () => {
    test('weapons row: split misc1, durability cell, matched option', () => {
      const tr = makeInventoryRow('weapons', {
        itemId: IDS.weapon,
        _ref: 'r1',
        misc1: 0x0102,
        misc2: 7,
        durability: 50,
        count: 1,
      });
      expect(tr.dataset.existing).toBe('true');
      expect(/** @type {HTMLSelectElement} */ (tr.querySelector('.inv-name')).value).toBe(
        String(IDS.weapon),
      );
      expect(/** @type {HTMLInputElement} */ (tr.querySelector('.inv-misc1hi')).value).toBe('1');
      expect(/** @type {HTMLInputElement} */ (tr.querySelector('.inv-misc1lo')).value).toBe('2');
      expect(/** @type {HTMLInputElement} */ (tr.querySelector('.inv-durability')).value).toBe(
        '50',
      );
      expect(tr.dataset.misc2).toBe('7');
    });

    test('defaults typeIdHint when only two args are passed', () => {
      const tr = makeInventoryRow('armor', {
        itemId: IDS.armor,
        _ref: 'r',
        misc1: 0,
        durability: 10,
        count: 1,
      });
      expect(/** @type {HTMLSelectElement} */ (tr.querySelector('.inv-name')).value).toBe(
        String(IDS.armor),
      );
    });

    test('new row (no _ref) is marked row-added with a placeholder', () => {
      const tr = makeInventoryRow('armor', {
        itemId: IDS.armor,
        misc1: 0,
        durability: 10,
        count: 1,
      });
      expect(tr.dataset.existing).toBe('false');
      expect(tr.classList.contains('row-added')).toBe(true);
      expect(tr.querySelector('.inv-name option[value=""]')).toBeTruthy();
    });

    test('invIdxByRef without the row _ref leaves roIdx1 unset', () => {
      const tr = makeInventoryRow(
        'armor',
        { itemId: IDS.armor, _ref: 'r', misc1: 0, durability: 10, count: 1 },
        null,
        new Map([['other', 9]]),
      );
      expect(
        /** @type {HTMLSelectElement} */ (tr.querySelector('.inv-name')).dataset.roIdx1,
      ).toBeUndefined();
    });

    test('invIdxByRef with the row _ref sets roIdx1', () => {
      const tr = makeInventoryRow(
        'armor',
        { itemId: IDS.armor, _ref: 'r', misc1: 0, durability: 10, count: 1 },
        null,
        new Map([['r', 42]]),
      );
      expect(/** @type {HTMLSelectElement} */ (tr.querySelector('.inv-name')).dataset.roIdx1).toBe(
        '42',
      );
    });

    test('weapons/armor misc2 defaults to 0 when undefined', () => {
      const tr = makeInventoryRow('armor', {
        itemId: IDS.armor,
        _ref: 'r',
        misc1: 0,
        durability: 10,
        count: 1,
      });
      expect(tr.dataset.misc2).toBe('0');
    });

    test('ammo (type 4) hides durability and defaults durability to 0', () => {
      const tr = makeInventoryRow('weapons', { itemId: IDS.ammo, _ref: 'r', misc1: 0, count: 30 });
      expect(/** @type {HTMLInputElement} */ (tr.querySelector('.inv-durability'))).toBeNull();
      expect(tr.dataset.durability).toBe('0');
      // ammo shows a count
      expect(tr.querySelector('.inv-count')).toBeTruthy();
    });

    test('rings/goods misc2 and durability default to 0 when undefined', () => {
      const tr = makeInventoryRow('rings', { itemId: IDS.ring, _ref: 'r', misc1: 5, count: 1 });
      expect(tr.dataset.misc2).toBe('0');
      expect(tr.dataset.durability).toBe('0');
      expect(/** @type {HTMLInputElement} */ (tr.querySelector('.inv-misc1val')).value).toBe('5');
    });

    test('unknown item id renders an Unknown option', () => {
      const tr = makeInventoryRow('rings', { itemId: 0x10ffff, _ref: 'r', misc1: 0, count: 1 });
      const opt = /** @type {HTMLSelectElement} */ (tr.querySelector('.inv-name'))
        .selectedOptions[0];
      expect(opt.textContent).toMatch(/Unknown \(0x/);
    });

    test('item id 0 renders no item option and no tooltip', () => {
      const tr = makeInventoryRow('rings', { itemId: 0, _ref: 'r', misc1: 0, count: 1 });
      const sel = /** @type {HTMLSelectElement} */ (tr.querySelector('.inv-name'));
      expect(sel.selectedOptions.length).toBe(0);
      expect(sel.hasAttribute('data-tooltip')).toBe(false);
    });

    test('accepts an explicit typeIdHint', () => {
      const tr = makeInventoryRow(
        'weapons',
        { itemId: IDS.weapon, _ref: 'r', misc1: 0x0102, durability: 50, count: 1 },
        1,
      );
      expect(/** @type {HTMLSelectElement} */ (tr.querySelector('.inv-name')).value).toBe(
        String(IDS.weapon),
      );
    });

    test('undefined itemId sets no prevId and adds no matched option', () => {
      const tr = makeInventoryRow('rings', { misc1: 0, count: 1 });
      const sel = /** @type {HTMLSelectElement} */ (tr.querySelector('.inv-name'));
      expect(sel.dataset.prevId).toBeUndefined();
    });

    test('throws on an unsupported category', () => {
      expect(() => makeInventoryRow('spells', { itemId: 1, misc1: 0, count: 1 })).toThrow(
        /unsupported category/,
      );
    });
  });

  describe('renderInventory', () => {
    test('weapons: routes a type-1 item into its type table', () => {
      typedTable('weapons', { weaponType: 1 });
      renderInventory('weapons', [
        { itemId: IDS.weapon, _ref: 'r', misc1: 0, durability: 50, count: 1 },
      ]);
      const tb1 = document.querySelector('table.inv-table[data-weapon-type="1"] tbody');
      expect(tb1.querySelectorAll('tr').length).toBe(1);
    });

    test('weapons: falls back to the type-1 table when the item type table is absent', () => {
      // Only type-1 table exists; item is a shield (type 2) → its table is missing.
      typedTable('weapons', { weaponType: 1 });
      renderInventory('weapons', [
        { itemId: IDS.shield, _ref: 'r', misc1: 0, durability: 50, count: 1 },
      ]);
      const tb1 = document.querySelector('table.inv-table[data-weapon-type="1"] tbody');
      expect(tb1.querySelectorAll('tr').length).toBe(1);
    });

    test('goods: no fallback table means the record is dropped silently', () => {
      // No goods tables at all; item is type 12 → type-12 missing, type-9 fallback missing.
      renderInventory('goods', [{ itemId: IDS.good, _ref: 'r', misc1: 0, count: 1 }]);
      expect(document.querySelectorAll('tr').length).toBe(0);
    });

    test('goods: falls back to the type-9 table when the item type table is absent', () => {
      typedTable('goods', { goodsType: 9 });
      renderInventory('goods', [{ itemId: IDS.good, _ref: 'r', misc1: 0, count: 1 }]);
      const tb = document.querySelector('table.inv-table[data-goods-type="9"] tbody');
      expect(tb.querySelectorAll('tr').length).toBe(1);
    });

    test('weapons: drops the record when neither its type table nor the type-1 fallback exist', () => {
      renderInventory('weapons', [
        { itemId: IDS.shield, _ref: 'r', misc1: 0, durability: 50, count: 1 },
      ]);
      expect(document.querySelectorAll('tr').length).toBe(0);
    });

    test('goods: routes into its own type table when present', () => {
      typedTable('goods', { goodsType: 12 });
      renderInventory('goods', [{ itemId: IDS.good, _ref: 'r', misc1: 0, count: 1 }]);
      expect(document.querySelectorAll('tr').length).toBe(1);
    });

    test('armor: is a no-op when the category table is absent', () => {
      expect(() =>
        renderInventory('armor', [
          { itemId: IDS.armor, _ref: 'r', misc1: 0, durability: 10, count: 1 },
        ]),
      ).not.toThrow();
      expect(document.querySelectorAll('tr').length).toBe(0);
    });

    test('clears existing rows before rendering', () => {
      typedTable('armor');
      const tbody = document.querySelector('table.inv-table[data-category="armor"] tbody');
      tbody.appendChild(document.createElement('tr'));
      renderInventory('armor', [
        { itemId: IDS.armor, _ref: 'r', misc1: 0, durability: 10, count: 1 },
      ]);
      expect(tbody.querySelectorAll('tr').length).toBe(1);
    });
  });

  describe('collectInventory', () => {
    test('returns [] when the category table is absent (null tbody entry skipped)', () => {
      expect(collectInventory('armor')).toEqual([]);
    });

    test('round-trips an armor row (split misc1 reassembly)', () => {
      typedTable('armor');
      const tbody = document.querySelector('table.inv-table[data-category="armor"] tbody');
      tbody.appendChild(
        makeInventoryRow('armor', {
          itemId: IDS.armor,
          _ref: 'r',
          misc1: 0x0102,
          misc2: 4,
          durability: 60,
          count: 1,
        }),
      );
      const [rec] = collectInventory('armor');
      expect(rec.itemId).toBe(IDS.armor);
      expect(rec.misc1).toBe(0x0102);
      expect(rec.misc2).toBe(4);
      expect(rec.durability).toBe(60);
      expect(rec._ref).toBe('r');
    });

    test('round-trips a rings row (single misc1)', () => {
      typedTable('rings');
      const tbody = document.querySelector('table.inv-table[data-category="rings"] tbody');
      tbody.appendChild(
        makeInventoryRow('rings', { itemId: IDS.ring, _ref: 'r', misc1: 9, misc2: 2, count: 1 }),
      );
      const [rec] = collectInventory('rings');
      expect(rec.itemId).toBe(IDS.ring);
      expect(rec.misc1).toBe(9);
    });

    test('round-trips a goods row', () => {
      typedTable('goods', { goodsType: 12 });
      const tbody = document.querySelector('table.inv-table[data-goods-type="12"] tbody');
      tbody.appendChild(
        makeInventoryRow('goods', { itemId: IDS.good, _ref: 'r', misc1: 3, misc2: 0, count: 5 }),
      );
      const [rec] = collectInventory('goods');
      expect(rec.itemId).toBe(IDS.good);
      expect(rec.misc1).toBe(3);
      expect(rec.count).toBe(5);
    });

    test('skips soft-deleted rows', () => {
      typedTable('armor');
      const tbody = document.querySelector('table.inv-table[data-category="armor"] tbody');
      const live = makeInventoryRow('armor', {
        itemId: IDS.armor,
        _ref: 'r',
        misc1: 0,
        durability: 10,
        count: 1,
      });
      const dead = makeInventoryRow('armor', {
        itemId: IDS.armor,
        _ref: 'r2',
        misc1: 0,
        durability: 10,
        count: 1,
      });
      dead.dataset.deleted = 'true';
      tbody.appendChild(live);
      tbody.appendChild(dead);
      expect(collectInventory('armor')).toHaveLength(1);
    });

    test('skips rows whose inv-name select has no value (placeholder)', () => {
      typedTable('rings');
      const tbody = document.querySelector('table.inv-table[data-category="rings"] tbody');
      tbody.appendChild(makeInventoryRow('rings', { itemId: 0, misc1: 0, count: 1 })); // new row, placeholder
      expect(collectInventory('rings')).toEqual([]);
    });

    test('defaults misc1 to 0 for a single-layout row missing the misc1 input', () => {
      typedTable('rings');
      const tbody = document.querySelector('table.inv-table[data-category="rings"] tbody');
      const tr = document.createElement('tr');
      const sel = document.createElement('select');
      sel.className = 'inv-name';
      const opt = document.createElement('option');
      opt.value = String(IDS.ring);
      opt.selected = true;
      sel.appendChild(opt);
      tr.appendChild(sel);
      tr.dataset.misc2 = '0';
      tbody.appendChild(tr);
      const [rec] = collectInventory('rings');
      expect(rec.misc1).toBe(0);
    });

    test('parses an item id of 0 without throwing', () => {
      typedTable('armor');
      const tbody = document.querySelector('table.inv-table[data-category="armor"] tbody');
      const tr = document.createElement('tr');
      const sel = document.createElement('select');
      sel.className = 'inv-name';
      const opt = document.createElement('option');
      opt.value = '0';
      opt.selected = true;
      sel.appendChild(opt);
      tr.appendChild(sel);
      tr.dataset.misc2 = '0';
      tbody.appendChild(tr);
      const [rec] = collectInventory('armor');
      expect(rec.itemId).toBe(0);
    });
  });

  describe('getCategoryData sanity', () => {
    test('all four categories expose non-empty id/name arrays', () => {
      for (const cat of ['weapons', 'armor', 'rings', 'goods']) {
        const { ids, names } = getCategoryData(cat);
        expect(ids.length).toBeGreaterThan(0);
        expect(ids.length).toBe(names.length);
      }
    });
  });
});
