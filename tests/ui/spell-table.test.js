/**
 * @jest-environment jsdom
 *
 * Tests for spell-table.js — spell table rendering and collection.
 */

import { renderSpellTable, makeSpellRow, collectSpells } from '../../js/ui/tables/spell-table.js';
import { getSpellData, SPELL_STATUS_NAMES } from '../../js/ui/core/controls.js';

function setupSpellTable() {
  document.body.innerHTML = '<div id="spellsTableBody"><table><tbody></tbody></table></div>';
  return document.querySelector('#spellsTableBody tbody');
}

describe('spell-table', () => {
  let knownSpellId;
  let knownSpellName;
  let unknownSpellId;

  beforeAll(() => {
    const { ids, names } = getSpellData();
    knownSpellId = ids[0];
    knownSpellName = names[0];
    const idSet = new Set(ids);
    let u = 0x10ffff;
    while (idSet.has(u)) u++;
    unknownSpellId = u;
  });

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('renderSpellTable', () => {
    test('is a no-op when the table tbody is absent', () => {
      expect(() => renderSpellTable([{ itemId: knownSpellId, status: 0 }])).not.toThrow();
      expect(document.querySelectorAll('tr').length).toBe(0);
    });

    test('clears existing rows before appending new ones', () => {
      const tbody = setupSpellTable();
      const stale = document.createElement('tr');
      tbody.appendChild(stale);
      renderSpellTable([{ itemId: knownSpellId, status: 0 }]);
      expect(tbody.children.length).toBe(1);
      expect(tbody.contains(stale)).toBe(false);
    });

    test('appends one row per spell', () => {
      const tbody = setupSpellTable();
      renderSpellTable([
        { itemId: knownSpellId, status: 0, misc1: 5, misc2: 9 },
        { itemId: knownSpellId, status: 1, misc1: 0, misc2: 0 },
      ]);
      expect(tbody.querySelectorAll('tr').length).toBe(2);
    });

    test('clears the table when given an empty spell list', () => {
      const tbody = setupSpellTable();
      tbody.appendChild(document.createElement('tr'));
      renderSpellTable([]);
      expect(tbody.children.length).toBe(0);
    });
  });

  describe('makeSpellRow', () => {
    test('existing known spell: matched option, status options, misc fields, delete button', () => {
      const tr = makeSpellRow({ itemId: knownSpellId, status: 2, misc1: 7, misc2: 3 });
      expect(tr.dataset.existing).toBe('true');
      expect(tr.classList.contains('row-added')).toBe(false);

      const sel = /** @type {HTMLSelectElement} */ (tr.querySelector('.spell-name'));
      expect(sel.value).toBe(String(knownSpellId));
      expect(sel.selectedOptions[0].textContent).toBe(knownSpellName);

      const statusSel = /** @type {HTMLSelectElement} */ (tr.querySelector('.spell-status'));
      expect(statusSel.options.length).toBe(SPELL_STATUS_NAMES.length);
      expect(statusSel.selectedOptions[0].value).toBe('2');

      expect(/** @type {HTMLInputElement} */ (tr.querySelector('.inv-spell-misc1')).value).toBe('7');
      expect(tr.dataset.misc2).toBe('3');
      expect(tr.querySelector('.row-del')).toBeTruthy();
    });

    test('new row (isExisting=false) gets row-added class and a placeholder', () => {
      const tr = makeSpellRow({ itemId: 0, status: 0 }, false);
      expect(tr.dataset.existing).toBe('false');
      expect(tr.classList.contains('row-added')).toBe(true);
      const placeholder = /** @type {HTMLOptionElement} */ (tr.querySelector('.spell-name option[value=""]'));
      expect(placeholder).toBeTruthy();
      expect(placeholder.selected).toBe(true);
    });

    test('unknown spell id renders an Unknown option', () => {
      const tr = makeSpellRow({ itemId: unknownSpellId, status: 0 });
      const opt = /** @type {HTMLSelectElement} */ (tr.querySelector('.spell-name')).selectedOptions[0];
      expect(opt.textContent).toMatch(/Unknown \(0x/);
      expect(opt.value).toBe(String(unknownSpellId));
    });

    test('spell id 0 renders no item option and sets no tooltip', () => {
      const tr = makeSpellRow({ itemId: 0, status: 0 });
      const sel = /** @type {HTMLSelectElement} */ (tr.querySelector('.spell-name'));
      expect(sel.selectedOptions.length).toBe(0);
      expect(sel.hasAttribute('data-tooltip')).toBe(false);
    });

    test('undefined itemId renders no item option', () => {
      const tr = makeSpellRow({ status: 0 });
      expect(/** @type {HTMLSelectElement} */ (tr.querySelector('.spell-name')).querySelectorAll('option').length).toBe(0);
    });

    test('non-numeric status defaults to 0', () => {
      const tr = makeSpellRow({ itemId: knownSpellId, status: 'oops' });
      expect(/** @type {HTMLSelectElement} */ (tr.querySelector('.spell-status')).selectedOptions[0].value).toBe('0');
    });

    test('undefined misc1/misc2 default to 0', () => {
      const tr = makeSpellRow({ itemId: knownSpellId, status: 0 });
      expect(/** @type {HTMLInputElement} */ (tr.querySelector('.inv-spell-misc1')).value).toBe('0');
      expect(tr.dataset.misc2).toBe('0');
    });
  });

  describe('collectSpells', () => {
    test('round-trips rendered rows back into records', () => {
      setupSpellTable();
      renderSpellTable([{ itemId: knownSpellId, status: 1, misc1: 4, misc2: 8 }]);
      expect(collectSpells()).toEqual([
        { itemId: knownSpellId, status: 1, misc1: 4, misc2: 8 },
      ]);
    });

    test('skips soft-deleted rows', () => {
      const tbody = setupSpellTable();
      tbody.appendChild(makeSpellRow({ itemId: knownSpellId, status: 0 }, true));
      const deleted = makeSpellRow({ itemId: knownSpellId, status: 0 }, true);
      deleted.dataset.deleted = 'true';
      tbody.appendChild(deleted);
      expect(collectSpells()).toHaveLength(1);
    });

    test('skips rows whose spell-name select has no value (placeholder)', () => {
      const tbody = setupSpellTable();
      tbody.appendChild(makeSpellRow({ itemId: 0 }, false));
      expect(collectSpells()).toHaveLength(0);
    });

    test('defaults status and misc1 to 0 when their inputs are absent', () => {
      const tbody = setupSpellTable();
      const tr = document.createElement('tr');
      const sel = document.createElement('select');
      sel.className = 'spell-name';
      const opt = document.createElement('option');
      opt.value = String(knownSpellId);
      opt.selected = true;
      sel.appendChild(opt);
      tr.appendChild(sel);
      tr.dataset.misc2 = '11';
      tbody.appendChild(tr);

      const [spell] = collectSpells();
      expect(spell.itemId).toBe(knownSpellId);
      expect(spell.status).toBe(0);
      expect(spell.misc1).toBe(0);
      expect(spell.misc2).toBe(11);
    });
  });
});
