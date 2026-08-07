/**
 * @jest-environment jsdom
 *
 * Tests for deposit-table.js — deposit (Thomas Storage) table rendering,
 * decomposed weapon rows, upgrade-path sync, count clamping, and collection.
 */

import {
  renderDeposit,
  makeDepositRow,
  makeDepositWeaponRow,
  collectDeposit,
  setupDepositWeaponSync,
  setupCountAndDuplicateSync,
} from '../../js/ui/tables/deposit-table.js';
import { DEFAULT_DEPOSIT_FLAGS } from '../../js/ui/core/constants.js';
import { resetDispatcher } from '../../js/ui/core/event-dispatcher.js';
import {
  getPathsForBaseWeapon,
  getWeaponTypeData,
  getUpgradeRefForItemId,
} from '../../js/ui/core/controls.js';

// itemId 10001 == base weapon 1 (Dagger), path 1 (Basic), level +1.
const WEAPON_ID = 10001;
const ARMOR_ID = 100000;
const RING_ID = 100;
const GOOD_ID = 6;
// A type-2 (Shield) item — used to exercise the "base id outside the type
// list" branch when rendered in a type-1 decomposed row.
const SHIELD_ID = getWeaponTypeData(2).ids[0];

function depTable(category, attrs = {}) {
  const table = document.createElement('table');
  table.className = 'dep-table';
  table.dataset.category = category;
  for (const [k, v] of Object.entries(attrs)) table.dataset[k] = String(v);
  const tbody = document.createElement('tbody');
  table.appendChild(tbody);
  document.body.appendChild(table);
  return table;
}

function fire(el, type) {
  el.dispatchEvent(new Event(type, { bubbles: true }));
}

describe('deposit-table', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetDispatcher();
  });

  describe('renderDeposit', () => {
    test('routes armor records into the armor table', () => {
      depTable('armor');
      renderDeposit([{ category: 'armor', itemId: ARMOR_ID, count: 1, durability: 50 }]);
      expect(
        document
          .querySelector('table.dep-table[data-category="armor"] tbody')
          .querySelectorAll('tr').length,
      ).toBe(1);
    });

    test('routes a decomposed weapon into its type table', () => {
      depTable('weapons', { weaponType: 1 });
      renderDeposit([{ category: 'weapons', itemId: WEAPON_ID, count: 1, durability: 50 }]);
      expect(document.querySelectorAll('tr').length).toBe(1);
    });

    test('drops records whose target table is absent', () => {
      renderDeposit([{ category: 'armor', itemId: ARMOR_ID, count: 1 }]);
      expect(document.querySelectorAll('tr').length).toBe(0);
    });

    test('weapons record falls back to the type-1 table when its type table is absent', () => {
      depTable('weapons', { weaponType: 1 });
      // SHIELD_ID is type 2; only the type-1 table exists → fallback branch.
      renderDeposit([{ category: 'weapons', itemId: SHIELD_ID, count: 1, durability: 50 }]);
      const tb1 = document.querySelector('table.dep-table[data-weapon-type="1"] tbody');
      expect(tb1.querySelectorAll('tr').length).toBe(1);
    });

    test('goods record falls back to the type-9 table when its type table is absent', () => {
      depTable('goods', { goodsType: 9 });
      // GOOD_ID (6) is type 12; only the type-9 table exists → fallback branch.
      renderDeposit([{ category: 'goods', itemId: GOOD_ID, count: 1 }]);
      const tb9 = document.querySelector('table.dep-table[data-goods-type="9"] tbody');
      expect(tb9.querySelectorAll('tr').length).toBe(1);
    });
  });

  describe('makeDepositRow', () => {
    test('armor existing row stores binary fields and shows durability', () => {
      const tr = makeDepositRow('armor', {
        itemId: ARMOR_ID,
        count: 1,
        durability: 50,
        unknown1: 7,
        sortOrder: 2,
        flags: [1, 2, 3],
      });
      expect(tr.dataset.existing).toBe('true');
      expect(tr.dataset.unknown1).toBe('7');
      expect(tr.dataset.sortOrder).toBe('2');
      expect(tr.dataset.flags).toBe('[1,2,3]');
      expect(/** @type {HTMLSelectElement} */ (tr.querySelector('.dep-name')).value).toBe(
        String(ARMOR_ID),
      );
      expect(/** @type {HTMLInputElement} */ (tr.querySelector('.inv-dep-durability')).value).toBe(
        '50',
      );
    });

    test('uses default args for a non-weapon/goods category', () => {
      const tr = makeDepositRow('rings', { itemId: RING_ID, count: 1 });
      expect(tr.dataset.existing).toBe('true');
      expect(/** @type {HTMLSelectElement} */ (tr.querySelector('.dep-name')).value).toBe(
        String(RING_ID),
      );
    });

    test('weapons row without a type hint derives the type from the item id', () => {
      // No typeIdHint (4th arg) → getWeaponTypeId(rec.itemId) runs.
      const tr = makeDepositRow('weapons', { itemId: WEAPON_ID, count: 1, durability: 50 });
      expect(tr.dataset.existing).toBe('true');
      expect(tr.querySelector('.dep-name')).toBeTruthy();
    });

    test('visible durability defaults to 0 when undefined', () => {
      const tr = makeDepositRow('armor', { itemId: ARMOR_ID, count: 1 });
      expect(/** @type {HTMLInputElement} */ (tr.querySelector('.inv-dep-durability')).value).toBe(
        '0',
      );
    });

    test('new row gets row-added class and a placeholder', () => {
      const tr = makeDepositRow('armor', { itemId: 0, count: 1 }, false);
      expect(tr.dataset.existing).toBe('false');
      expect(tr.classList.contains('row-added')).toBe(true);
      expect(tr.querySelector('.dep-name option[value=""]')).toBeTruthy();
    });

    test('unknown item id renders an Unknown option', () => {
      const tr = makeDepositRow('armor', { itemId: 0x10ffff, count: 1 });
      expect(
        /** @type {HTMLSelectElement} */ (tr.querySelector('.dep-name')).selectedOptions[0]
          .textContent,
      ).toMatch(/Unknown \(0x/);
    });

    test('item id 0 renders no option and no tooltip', () => {
      const tr = makeDepositRow('armor', { itemId: 0, count: 1 });
      const sel = /** @type {HTMLSelectElement} */ (tr.querySelector('.dep-name'));
      expect(sel.selectedOptions.length).toBe(0);
      expect(sel.hasAttribute('data-tooltip')).toBe(false);
    });

    test('goods shows a count and hides durability via dataset', () => {
      const tr = makeDepositRow('goods', { itemId: GOOD_ID, count: 5, durability: 0 });
      expect(tr.querySelector('.dep-count')).toBeTruthy();
      expect(tr.querySelector('.inv-dep-durability')).toBeNull();
      expect(tr.dataset.durability).toBe('0');
    });

    test('non-array flags and missing unknown1/sortOrder produce empty datasets', () => {
      const tr = makeDepositRow('armor', { itemId: ARMOR_ID, count: 1, flags: null });
      expect(tr.dataset.flags).toBe('');
      expect(tr.dataset.unknown1).toBe('');
      expect(tr.dataset.sortOrder).toBe('');
    });
  });

  describe('makeDepositWeaponRow', () => {
    test('decomposed row splits itemId into base/path/level selects', () => {
      const tr = makeDepositWeaponRow(1, { itemId: WEAPON_ID, count: 1, durability: 50 });
      expect(tr.dataset.decomposed).toBe('true');
      expect(/** @type {HTMLSelectElement} */ (tr.querySelector('.dep-base-weapon')).value).toBe(
        '1',
      );
      expect(/** @type {HTMLSelectElement} */ (tr.querySelector('.dep-path')).value).toBe('1');
      expect(/** @type {HTMLSelectElement} */ (tr.querySelector('.dep-level')).value).toBe('1');
      expect(/** @type {HTMLInputElement} */ (tr.querySelector('.dep-item-id')).value).toBe(
        String(WEAPON_ID),
      );
      expect(/** @type {HTMLInputElement} */ (tr.querySelector('.inv-dep-durability')).value).toBe(
        '50',
      );
    });

    test('new decomposed row has a placeholder and row-added class', () => {
      const tr = makeDepositWeaponRow(1, { itemId: 0, count: 1 }, false);
      expect(tr.dataset.existing).toBe('false');
      expect(tr.classList.contains('row-added')).toBe(true);
      expect(tr.querySelector('.dep-base-weapon option[value=""]')).toBeTruthy();
    });

    test('count and durability default when undefined', () => {
      const tr = makeDepositWeaponRow(1, { itemId: WEAPON_ID });
      expect(/** @type {HTMLInputElement} */ (tr.querySelector('.dep-count')).value).toBe('1');
      expect(/** @type {HTMLInputElement} */ (tr.querySelector('.inv-dep-durability')).value).toBe(
        '0',
      );
    });

    test('adds an extra base option when the item base is outside the type list', () => {
      // A shield (type 2) rendered in a type-1 row: its baseId is valid but
      // absent from the type-1 base-weapon list → the extra-option branch.
      const tr = makeDepositWeaponRow(1, { itemId: SHIELD_ID, count: 1, durability: 50 });
      const baseSel = /** @type {HTMLSelectElement} */ (tr.querySelector('.dep-base-weapon'));
      const expectedBase = getUpgradeRefForItemId(SHIELD_ID)[0];
      const selected = baseSel.selectedOptions[0];
      expect(selected).toBeTruthy();
      expect(selected.value).toBe(String(expectedBase));
      // The extra option's text comes from the item's own db name.
      expect(selected.textContent.length).toBeGreaterThan(0);
    });
  });

  describe('collectDeposit', () => {
    test('round-trips an armor row including binary fields', () => {
      depTable('armor');
      document.querySelector('table.dep-table[data-category="armor"] tbody').appendChild(
        makeDepositRow('armor', {
          itemId: ARMOR_ID,
          count: 1,
          durability: 50,
          unknown1: 7,
          sortOrder: 2,
          flags: [1, 2],
        }),
      );
      const armor = collectDeposit().find((r) => r.category === 'armor');
      expect(armor.itemId).toBe(ARMOR_ID);
      expect(armor.durability).toBe(50);
      expect(armor.unknown1).toBe(7);
      expect(armor.sortOrder).toBe(2);
      expect(armor.flags).toEqual([1, 2]);
    });

    test('skips soft-deleted rows', () => {
      depTable('armor');
      const tbody = document.querySelector('table.dep-table[data-category="armor"] tbody');
      tbody.appendChild(makeDepositRow('armor', { itemId: ARMOR_ID, count: 1 }));
      const dead = makeDepositRow('armor', { itemId: ARMOR_ID + 1, count: 1 });
      dead.dataset.deleted = 'true';
      tbody.appendChild(dead);
      expect(collectDeposit().filter((r) => r.category === 'armor')).toHaveLength(1);
    });

    test('skips placeholder rows (empty dep-name value)', () => {
      depTable('armor');
      document
        .querySelector('table.dep-table[data-category="armor"] tbody')
        .appendChild(makeDepositRow('armor', { itemId: 0, count: 1 }, false));
      expect(collectDeposit().filter((r) => r.category === 'armor')).toHaveLength(0);
    });

    test('collects a decomposed weapon row via its hidden item-id input', () => {
      depTable('weapons', { weaponType: 1 });
      document
        .querySelector('table.dep-table[data-category="weapons"][data-weapon-type="1"] tbody')
        .appendChild(makeDepositWeaponRow(1, { itemId: WEAPON_ID, count: 1, durability: 60 }));
      const weapons = collectDeposit().filter((r) => r.category === 'weapons');
      expect(weapons).toHaveLength(1);
      expect(weapons[0].itemId).toBe(WEAPON_ID);
      expect(weapons[0].durability).toBe(60);
    });

    test('falls back to DEFAULT_DEPOSIT_FLAGS when the flags dataset is invalid JSON', () => {
      depTable('armor');
      const tr = makeDepositRow('armor', { itemId: ARMOR_ID, count: 1 });
      tr.dataset.flags = 'not-json';
      document.querySelector('table.dep-table[data-category="armor"] tbody').appendChild(tr);
      const armor = collectDeposit().find((r) => r.category === 'armor');
      expect(armor.flags).toEqual(DEFAULT_DEPOSIT_FLAGS);
    });

    test('durability is undefined when no durability input or dataset is present', () => {
      depTable('rings');
      const tr = makeDepositRow('rings', { itemId: RING_ID, count: 1 });
      delete tr.dataset.durability;
      document.querySelector('table.dep-table[data-category="rings"] tbody').appendChild(tr);
      const ring = collectDeposit().find((r) => r.category === 'rings');
      expect(ring.durability).toBeUndefined();
    });
  });

  describe('setupCountAndDuplicateSync', () => {
    beforeEach(() => {
      setupCountAndDuplicateSync();
    });

    test('clamps a dep-count above the max down to max', () => {
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.className = 'dep-count';
      inp.min = '1';
      inp.max = '99';
      inp.value = '200';
      document.body.appendChild(inp);
      fire(inp, 'input');
      expect(inp.value).toBe('99');
    });

    test('clamps an inv-count below the min up to min', () => {
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.className = 'inv-count';
      inp.min = '5';
      inp.max = '99';
      inp.value = '0';
      document.body.appendChild(inp);
      fire(inp, 'input');
      expect(inp.value).toBe('5');
    });

    test('ignores non-number inputs', () => {
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.className = 'dep-count';
      inp.value = 'keep';
      document.body.appendChild(inp);
      fire(inp, 'input');
      expect(inp.value).toBe('keep');
    });

    test('ignores number inputs without a count class', () => {
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.className = 'other';
      inp.min = '1';
      inp.max = '99';
      inp.value = '200';
      document.body.appendChild(inp);
      fire(inp, 'input');
      expect(inp.value).toBe('200');
    });

    test('leaves an empty (NaN) value untouched', () => {
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.className = 'dep-count';
      inp.min = '1';
      inp.max = '99';
      inp.value = ''; // jsdom sanitizes non-numeric input to ''
      document.body.appendChild(inp);
      fire(inp, 'input');
      expect(inp.value).toBe('');
    });

    test('change on a dep-name select runs without error', () => {
      const sel = document.createElement('select');
      sel.className = 'dep-name';
      sel.dataset.lazyCat = 'goods';
      document.body.appendChild(sel);
      expect(() => fire(sel, 'change')).not.toThrow();
    });

    test('change on a non-name select is ignored', () => {
      const sel = document.createElement('select');
      sel.className = 'other';
      document.body.appendChild(sel);
      expect(() => fire(sel, 'change')).not.toThrow();
    });
  });

  describe('setupDepositWeaponSync', () => {
    beforeEach(() => {
      setupDepositWeaponSync();
    });

    function attachRow(tr) {
      const tbody = document.createElement('tbody');
      tbody.appendChild(tr);
      document.body.appendChild(tbody);
      return tr;
    }

    test('changing the base weapon repopulates path and level selects', () => {
      const tr = attachRow(
        makeDepositWeaponRow(1, { itemId: WEAPON_ID, count: 1, durability: 50 }),
      );
      const baseSel = tr.querySelector('.dep-base-weapon');
      baseSel.value = '2'; // Parrying Dagger
      fire(baseSel, 'change');
      const pathSel = tr.querySelector('.dep-path');
      const levelSel = tr.querySelector('.dep-level');
      expect(pathSel.options.length).toBe(getPathsForBaseWeapon(2).length);
      expect(levelSel.options.length).toBeGreaterThan(0);
      expect(tr.querySelector('.dep-item-id').value).not.toBe('');
    });

    test('changing the path repopulates the level select', () => {
      const tr = attachRow(
        makeDepositWeaponRow(1, { itemId: WEAPON_ID, count: 1, durability: 50 }),
      );
      const pathSel = tr.querySelector('.dep-path');
      pathSel.value = '2'; // Quality
      fire(pathSel, 'change');
      expect(tr.querySelector('.dep-level').options.length).toBeGreaterThan(0);
    });

    test('changing the level recomposes the hidden item id', () => {
      const tr = attachRow(
        makeDepositWeaponRow(1, { itemId: WEAPON_ID, count: 1, durability: 50 }),
      );
      const levelSel = tr.querySelector('.dep-level');
      const before = tr.querySelector('.dep-item-id').value;
      levelSel.value = '5';
      fire(levelSel, 'change');
      expect(tr.querySelector('.dep-item-id').value).not.toBe(before);
    });

    test('changing the base to the placeholder is a no-op', () => {
      const tr = attachRow(makeDepositWeaponRow(1, { itemId: 0, count: 1 }, false));
      const baseSel = tr.querySelector('.dep-base-weapon');
      const before = tr.querySelector('.dep-item-id').value;
      fire(baseSel, 'change');
      expect(tr.querySelector('.dep-item-id').value).toBe(before);
    });

    test('ignores changes on non-decomposed rows', () => {
      const tr = attachRow(makeDepositRow('armor', { itemId: ARMOR_ID, count: 1 }));
      expect(() => fire(tr.querySelector('.dep-name'), 'change')).not.toThrow();
    });

    test('ignores change events from non-select elements', () => {
      const div = document.createElement('div');
      document.body.appendChild(div);
      expect(() => fire(div, 'change')).not.toThrow();
    });

    test('changing the base weapon to one with no upgrade paths clears path and level', () => {
      const tr = attachRow(
        makeDepositWeaponRow(1, { itemId: WEAPON_ID, count: 1, durability: 50 }),
      );
      const baseSel = tr.querySelector('.dep-base-weapon');
      // A base id with no entry in rel-upgrades → getPathsForBaseWeapon returns [].
      const bogus = document.createElement('option');
      bogus.value = '999999';
      baseSel.appendChild(bogus);
      baseSel.value = '999999';
      const pathSel = tr.querySelector('.dep-path');
      const levelSel = tr.querySelector('.dep-level');
      pathSel.setAttribute('data-tooltip', 'stale');

      fire(baseSel, 'change');

      // Non-upgradable: path select emptied, path tooltip cleared, levels cleared.
      expect(pathSel.options.length).toBe(0);
      expect(pathSel.hasAttribute('data-tooltip')).toBe(false);
      expect(levelSel.options.length).toBe(0);
    });

    test('changing the path to the placeholder clears its tooltip', () => {
      const tr = attachRow(
        makeDepositWeaponRow(1, { itemId: WEAPON_ID, count: 1, durability: 50 }),
      );
      const pathSel = tr.querySelector('.dep-path');
      const ph = document.createElement('option');
      ph.value = '';
      pathSel.appendChild(ph);
      pathSel.value = ''; // pathId becomes NaN (falsy)
      pathSel.setAttribute('data-tooltip', 'stale');

      fire(pathSel, 'change');

      expect(pathSel.hasAttribute('data-tooltip')).toBe(false);
    });

    test('changing the path to an unknown path id clears levels without error', () => {
      const tr = attachRow(
        makeDepositWeaponRow(1, { itemId: WEAPON_ID, count: 1, durability: 50 }),
      );
      const pathSel = tr.querySelector('.dep-path');
      const bogus = document.createElement('option');
      bogus.value = '9999'; // not a real path → getUpgradePathDef throws
      pathSel.appendChild(bogus);
      pathSel.value = '9999';
      const levelSel = tr.querySelector('.dep-level');

      expect(() => fire(pathSel, 'change')).not.toThrow();
      // populateLevelSelect's try/catch swallows the throw → no options added.
      expect(levelSel.options.length).toBe(0);
    });
  });
});
