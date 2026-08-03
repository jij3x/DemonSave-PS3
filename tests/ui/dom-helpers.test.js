/**
 * @jest-environment jsdom
 *
 * Tests for dom-helpers.js — DOM accessors, equipment display, debounced
 * refresh, targeted equipment refresh, and shared table-cell builders.
 */

const { jest } = await import('@jest/globals');

const {
  $,
  setVal,
  getVal,
  getNum,
  getEqId,
  setEquipmentText,
  refreshEquipmentDisplay,
  refreshEquipmentForItems,
  setupEquipmentSync,
  EQ_IDS,
  EQ_CATEGORY,
  makeCountCell,
  parseCountValue,
  makeNumCell,
} = await import('../../js/ui/core/dom-helpers.js');
const { resetDispatcher } = await import('../../js/ui/core/event-dispatcher.js');
const db = await import('../../js/des-db/index.js');

const WEAPON_IDS = db.getItemIdsByCategory('weapons');
const VALID_WEAPON_ID = WEAPON_IDS[0]; // Dagger (10000)

describe('dom-helpers', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetDispatcher();
    // Reset the debounce timer by cancelling any pending refresh
    refreshEquipmentDisplay.cancel();
  });

  // -------------------------------------------------------------------------
  // Basic DOM accessors
  // -------------------------------------------------------------------------

  describe('$ accessor', () => {
    test('returns element by id', () => {
      const div = document.createElement('div');
      div.id = 'test';
      document.body.appendChild(div);
      expect($('test')).toBe(div);
    });

    test('returns null for missing id', () => {
      expect($('nonexistent')).toBeNull();
    });
  });

  describe('setVal / getVal', () => {
    test('setVal sets text input value', () => {
      const inp = document.createElement('input');
      inp.id = 'name';
      inp.type = 'text';
      document.body.appendChild(inp);

      setVal('name', 'hello');
      expect(inp.value).toBe('hello');
    });

    test('setVal on checkbox sets checked', () => {
      const cb = document.createElement('input');
      cb.id = 'flag';
      cb.type = 'checkbox';
      document.body.appendChild(cb);

      setVal('flag', true);
      expect(cb.checked).toBe(true);

      setVal('flag', false);
      expect(cb.checked).toBe(false);
    });

    test('setVal is a no-op for missing element', () => {
      expect(() => setVal('missing', 'x')).not.toThrow();
    });

    test('getVal reads text input', () => {
      const inp = document.createElement('input');
      inp.id = 'name';
      inp.type = 'text';
      inp.value = 'world';
      document.body.appendChild(inp);

      expect(getVal('name')).toBe('world');
    });

    test('getVal reads checkbox as boolean', () => {
      const cb = document.createElement('input');
      cb.id = 'flag';
      cb.type = 'checkbox';
      cb.checked = true;
      document.body.appendChild(cb);

      expect(getVal('flag')).toBe(true);
    });

    test('getVal returns undefined for missing element', () => {
      expect(getVal('missing')).toBeUndefined();
    });
  });

  describe('getNum', () => {
    test('reads a numeric value', () => {
      const inp = document.createElement('input');
      inp.id = 'vit';
      inp.type = 'number';
      inp.value = '42';
      document.body.appendChild(inp);

      expect(getNum('vit')).toBe(42);
    });

    test('returns 0 for empty string', () => {
      const inp = document.createElement('input');
      inp.id = 'vit';
      inp.type = 'number';
      inp.value = '';
      document.body.appendChild(inp);

      expect(getNum('vit')).toBe(0);
    });

    test('returns 0 for undefined element', () => {
      expect(getNum('missing')).toBe(0);
    });

    test('returns 0 for NaN', () => {
      const inp = document.createElement('input');
      inp.id = 'vit';
      inp.type = 'number';
      inp.value = 'abc';
      document.body.appendChild(inp);

      expect(getNum('vit')).toBe(0);
    });

    test('reads a float value', () => {
      const inp = document.createElement('input');
      inp.id = 'x';
      inp.type = 'number';
      inp.value = '3.14';
      document.body.appendChild(inp);

      expect(getNum('x')).toBe(3.14);
    });
  });

  describe('getEqId', () => {
    test('reads data-id from span', () => {
      const span = document.createElement('span');
      span.id = 'leftHand1';
      span.dataset.id = '12345';
      document.body.appendChild(span);

      expect(getEqId('leftHand1')).toBe(12345);
    });

    test('returns 0 for missing element', () => {
      expect(getEqId('missing')).toBe(0);
    });

    test('returns 0 for missing data-id attribute', () => {
      const span = document.createElement('span');
      span.id = 'leftHand1';
      document.body.appendChild(span);

      expect(getEqId('leftHand1')).toBe(0);
    });

    test('returns unsigned 32-bit for high IDs', () => {
      const span = document.createElement('span');
      span.id = 'leftHand1';
      span.dataset.id = String(0xffffffff);
      document.body.appendChild(span);

      expect(getEqId('leftHand1')).toBe(0xffffffff >>> 0);
    });
  });

  // -------------------------------------------------------------------------
  // Equipment display
  // -------------------------------------------------------------------------

  describe('setEquipmentText', () => {
    test('is a no-op for missing element', () => {
      expect(() => setEquipmentText('missing', 100, 'weapons')).not.toThrow();
    });

    test('displays "(none)" for 0xFFFFFFFF', () => {
      const span = document.createElement('span');
      span.id = 'ring1';
      document.body.appendChild(span);

      setEquipmentText('ring1', 0xffffffff, 'rings');

      expect(span.textContent).toBe('(none)');
      expect(span.dataset.id).toBe(String(0xffffffff));
    });

    test('displays item name for valid ID', () => {
      const span = document.createElement('span');
      span.id = 'leftHand1';
      document.body.appendChild(span);

      setEquipmentText('leftHand1', VALID_WEAPON_ID, 'weapons');

      expect(span.textContent).toBe(db.getItem('weapons', VALID_WEAPON_ID).name);
      expect(span.dataset.id).toBe(String(VALID_WEAPON_ID));
    });

    test('displays "Unknown (0x...)" for unrecognized ID', () => {
      const span = document.createElement('span');
      span.id = 'leftHand1';
      document.body.appendChild(span);

      setEquipmentText('leftHand1', 0x00abcdef, 'weapons');

      expect(span.textContent).toBe('Unknown (0x00ABCDEF)');
      expect(span.dataset.id).toBe(String(0x00abcdef));
    });

    test('stores data-orig-id on first set', () => {
      const span = document.createElement('span');
      span.id = 'leftHand1';
      document.body.appendChild(span);

      setEquipmentText('leftHand1', VALID_WEAPON_ID, 'weapons');

      expect(span.dataset.origId).toBe(String(VALID_WEAPON_ID));
    });

    test('resetOrig=true re-captures data-orig-id', () => {
      const span = document.createElement('span');
      span.id = 'leftHand1';
      document.body.appendChild(span);

      setEquipmentText('leftHand1', VALID_WEAPON_ID, 'weapons');
      expect(span.dataset.origId).toBe(String(VALID_WEAPON_ID));

      // Change to a different item WITHOUT resetOrig
      setEquipmentText('leftHand1', 0xffffffff, 'weapons');
      expect(span.dataset.origId).toBe(String(VALID_WEAPON_ID)); // unchanged

      // Change WITH resetOrig
      setEquipmentText('leftHand1', 0xffffffff, 'weapons', true);
      expect(span.dataset.origId).toBe(String(0xffffffff)); // re-captured
    });

    test('sets data-tooltip attributes', () => {
      const span = document.createElement('span');
      span.id = 'leftHand1';
      document.body.appendChild(span);

      setEquipmentText('leftHand1', VALID_WEAPON_ID, 'weapons');

      expect(span.getAttribute('data-tooltip')).toBeTruthy();
      expect(span.getAttribute('data-tooltip-if-truncated')).toBe('true');
    });
  });

  // -------------------------------------------------------------------------
  // Debounced refreshEquipmentDisplay
  // -------------------------------------------------------------------------

  describe('refreshEquipmentDisplay (debounced)', () => {
    beforeAll(() => jest.useFakeTimers());
    afterAll(() => jest.useRealTimers());

    test('flush() forces immediate execution', () => {
      const span = document.createElement('span');
      span.id = 'leftHand1';
      span.dataset.id = String(VALID_WEAPON_ID);
      span.dataset.origId = String(VALID_WEAPON_ID);
      document.body.appendChild(span);

      // No matching inventory row — after refresh, span should be cleared
      refreshEquipmentDisplay();
      // Before flush, nothing happened
      // (We can't easily check "before" because debounce may have 0ms,
      // but flush forces immediate execution)
      refreshEquipmentDisplay.flush();

      expect(span.dataset.id).toBe(String(0xffffffff));
      expect(span.textContent).toBe('(none)');
    });

    test('cancel() discards pending refresh', () => {
      const span = document.createElement('span');
      span.id = 'leftHand1';
      span.dataset.id = String(VALID_WEAPON_ID);
      span.dataset.origId = String(VALID_WEAPON_ID);
      document.body.appendChild(span);

      refreshEquipmentDisplay();
      refreshEquipmentDisplay.cancel();

      // Advance timers — nothing should happen (pending was cancelled)
      jest.advanceTimersByTime(100);

      expect(span.dataset.id).toBe(String(VALID_WEAPON_ID));
    });

    test('flush() is a no-op when no refresh is pending', () => {
      // Cancel first to ensure nothing is pending
      refreshEquipmentDisplay.cancel();
      expect(() => refreshEquipmentDisplay.flush()).not.toThrow();
    });

    test('cancel() is a no-op when no refresh is pending', () => {
      refreshEquipmentDisplay.cancel();
      expect(() => refreshEquipmentDisplay.cancel()).not.toThrow();
    });

    test('debounced refresh clears slot when item not in inventory', () => {
      const span = document.createElement('span');
      span.id = 'leftHand1';
      span.dataset.id = String(VALID_WEAPON_ID);
      span.dataset.origId = String(VALID_WEAPON_ID);
      document.body.appendChild(span);

      refreshEquipmentDisplay();
      jest.advanceTimersByTime(100);

      expect(span.dataset.id).toBe(String(0xffffffff));
      expect(span.textContent).toBe('(none)');
    });

    test('debounced refresh keeps slot when item IS in inventory', () => {
      const span = document.createElement('span');
      span.id = 'leftHand1';
      span.dataset.id = String(VALID_WEAPON_ID);
      span.dataset.origId = String(VALID_WEAPON_ID);
      document.body.appendChild(span);

      // Build an inventory row containing the item
      const table = document.createElement('table');
      table.className = 'grid-table inv-table';
      table.dataset.category = 'weapons';
      const tbody = document.createElement('tbody');
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      const sel = document.createElement('select');
      sel.className = 'inv-name';
      const opt = document.createElement('option');
      opt.value = String(VALID_WEAPON_ID);
      sel.appendChild(opt);
      sel.value = String(VALID_WEAPON_ID);
      td.appendChild(sel);
      tr.appendChild(td);
      tbody.appendChild(tr);
      table.appendChild(tbody);
      document.body.appendChild(table);

      refreshEquipmentDisplay();
      jest.advanceTimersByTime(100);

      expect(span.dataset.id).toBe(String(VALID_WEAPON_ID));
    });

    test('debounced refresh restores "(none)" slot when original item returns', () => {
      const span = document.createElement('span');
      span.id = 'leftHand1';
      span.dataset.id = String(0xffffffff); // currently "(none)"
      span.dataset.origId = String(VALID_WEAPON_ID); // original was a real item
      document.body.appendChild(span);

      // Build an inventory row containing the original item (simulating undelete)
      const table = document.createElement('table');
      table.className = 'grid-table inv-table';
      table.dataset.category = 'weapons';
      const tbody = document.createElement('tbody');
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      const sel = document.createElement('select');
      sel.className = 'inv-name';
      const opt = document.createElement('option');
      opt.value = String(VALID_WEAPON_ID);
      sel.appendChild(opt);
      sel.value = String(VALID_WEAPON_ID);
      td.appendChild(sel);
      tr.appendChild(td);
      tbody.appendChild(tr);
      table.appendChild(tbody);
      document.body.appendChild(table);

      refreshEquipmentDisplay();
      jest.advanceTimersByTime(100);

      // Slot should be restored to the original item
      expect(span.dataset.id).toBe(String(VALID_WEAPON_ID));
      expect(span.textContent).toBe(db.getItem('weapons', VALID_WEAPON_ID).name);
    });
  });

  // -------------------------------------------------------------------------
  // refreshEquipmentForItems (targeted refresh)
  // -------------------------------------------------------------------------

  describe('refreshEquipmentForItems', () => {
    test('clears slot on delete when item no longer in inventory', () => {
      const span = document.createElement('span');
      span.id = 'leftHand1';
      span.dataset.id = String(VALID_WEAPON_ID);
      span.dataset.origId = String(VALID_WEAPON_ID);
      document.body.appendChild(span);

      refreshEquipmentForItems([{ itemId: String(VALID_WEAPON_ID), idx1: null, action: 'delete' }]);

      expect(span.dataset.id).toBe(String(0xffffffff));
      expect(span.textContent).toBe('(none)');
    });

    test('does NOT clear slot on delete when a duplicate still exists', () => {
      const span = document.createElement('span');
      span.id = 'leftHand1';
      span.dataset.id = String(VALID_WEAPON_ID);
      span.dataset.origId = String(VALID_WEAPON_ID);
      document.body.appendChild(span);

      // Build an inventory row containing the item
      const table = document.createElement('table');
      table.className = 'grid-table inv-table';
      table.dataset.category = 'weapons';
      const tbody = document.createElement('tbody');
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      const sel = document.createElement('select');
      sel.className = 'inv-name';
      const opt = document.createElement('option');
      opt.value = String(VALID_WEAPON_ID);
      sel.appendChild(opt);
      sel.value = String(VALID_WEAPON_ID);
      td.appendChild(sel);
      tr.appendChild(td);
      tbody.appendChild(tr);
      table.appendChild(tbody);
      document.body.appendChild(table);

      refreshEquipmentForItems([{ itemId: String(VALID_WEAPON_ID), idx1: null, action: 'delete' }]);

      // Still in inventory (the row we created) → slot should NOT be cleared
      expect(span.dataset.id).toBe(String(VALID_WEAPON_ID));
    });

    test('does not clear slot on delete when slot shows a different item', () => {
      const span = document.createElement('span');
      span.id = 'leftHand1';
      span.dataset.id = String(VALID_WEAPON_ID);
      span.dataset.origId = String(VALID_WEAPON_ID);
      document.body.appendChild(span);

      refreshEquipmentForItems([
        { itemId: String(VALID_WEAPON_ID + 1), idx1: null, action: 'delete' },
      ]);

      expect(span.dataset.id).toBe(String(VALID_WEAPON_ID));
    });

    test('does not clear slot on delete when slot is already "(none)"', () => {
      const span = document.createElement('span');
      span.id = 'leftHand1';
      span.dataset.id = String(0xffffffff);
      span.dataset.origId = String(0xffffffff);
      document.body.appendChild(span);

      refreshEquipmentForItems([{ itemId: String(VALID_WEAPON_ID), idx1: null, action: 'delete' }]);

      expect(span.dataset.id).toBe(String(0xffffffff));
    });

    test('restores "(none)" slot on undelete when original item matches', () => {
      const span = document.createElement('span');
      span.id = 'leftHand1';
      span.dataset.id = String(0xffffffff); // currently "(none)"
      span.dataset.origId = String(VALID_WEAPON_ID); // original item
      document.body.appendChild(span);

      refreshEquipmentForItems([
        { itemId: String(VALID_WEAPON_ID), idx1: null, action: 'undelete' },
      ]);

      expect(span.dataset.id).toBe(String(VALID_WEAPON_ID));
      expect(span.textContent).toBe(db.getItem('weapons', VALID_WEAPON_ID).name);
    });

    test('does not restore slot on undelete when origId does not match', () => {
      const span = document.createElement('span');
      span.id = 'leftHand1';
      span.dataset.id = String(0xffffffff);
      span.dataset.origId = String(VALID_WEAPON_ID);
      document.body.appendChild(span);

      refreshEquipmentForItems([
        { itemId: String(VALID_WEAPON_ID + 99), idx1: null, action: 'undelete' },
      ]);

      expect(span.dataset.id).toBe(String(0xffffffff));
    });

    test('does not restore slot on undelete when slot is not "(none)"', () => {
      const span = document.createElement('span');
      span.id = 'leftHand1';
      span.dataset.id = String(VALID_WEAPON_ID);
      span.dataset.origId = String(VALID_WEAPON_ID);
      document.body.appendChild(span);

      refreshEquipmentForItems([
        { itemId: String(VALID_WEAPON_ID), idx1: null, action: 'undelete' },
      ]);

      // Slot already has an item, no restore needed
      expect(span.dataset.id).toBe(String(VALID_WEAPON_ID));
    });

    test('idx1 pair matching on delete — clears slot only when pair matches', () => {
      const span = document.createElement('span');
      span.id = 'leftHand1';
      span.dataset.id = String(VALID_WEAPON_ID);
      span.dataset.origId = String(VALID_WEAPON_ID);
      span.dataset.roIdx1 = '5';
      document.body.appendChild(span);

      // Delete with a DIFFERENT idx1 → slot should NOT be cleared
      refreshEquipmentForItems([{ itemId: String(VALID_WEAPON_ID), idx1: '99', action: 'delete' }]);
      expect(span.dataset.id).toBe(String(VALID_WEAPON_ID));

      // Delete with SAME idx1 AND no remaining inventory → slot cleared
      refreshEquipmentForItems([{ itemId: String(VALID_WEAPON_ID), idx1: '5', action: 'delete' }]);
      expect(span.dataset.id).toBe(String(0xffffffff));
    });
  });

  // -------------------------------------------------------------------------
  // setupEquipmentSync
  // -------------------------------------------------------------------------

  describe('setupEquipmentSync', () => {
    test('updates equipment span when inventory item changes via change event', () => {
      const span = document.createElement('span');
      span.id = 'leftHand1';
      span.dataset.id = String(VALID_WEAPON_ID);
      span.dataset.origId = String(VALID_WEAPON_ID);
      span.dataset.roIdx1 = '0';
      document.body.appendChild(span);

      // Build an inventory select with a previous value
      const sel = document.createElement('select');
      sel.className = 'inv-name';
      sel.dataset.prevId = String(VALID_WEAPON_ID);
      sel.dataset.roIdx1 = '0';
      // Populate with options so .value works
      const opt1 = document.createElement('option');
      opt1.value = String(VALID_WEAPON_ID);
      opt1.textContent = 'Dagger';
      const opt2 = document.createElement('option');
      opt2.value = String(VALID_WEAPON_ID + 1);
      opt2.textContent = 'Next';
      sel.appendChild(opt1);
      sel.appendChild(opt2);
      document.body.appendChild(sel);

      setupEquipmentSync();

      // Simulate user changing the item in the inventory row
      sel.value = String(VALID_WEAPON_ID + 1);
      sel.dispatchEvent(new Event('change', { bubbles: true }));

      // The equipment span should now show the new item
      expect(span.dataset.id).toBe(String(VALID_WEAPON_ID + 1));
    });

    test('does not update span when old and new values are the same', () => {
      const span = document.createElement('span');
      span.id = 'leftHand1';
      span.dataset.id = String(VALID_WEAPON_ID);
      span.dataset.origId = String(VALID_WEAPON_ID);
      span.dataset.roIdx1 = '0';
      document.body.appendChild(span);

      const sel = document.createElement('select');
      sel.className = 'inv-name';
      sel.dataset.prevId = String(VALID_WEAPON_ID);
      sel.dataset.roIdx1 = '0';
      const opt = document.createElement('option');
      opt.value = String(VALID_WEAPON_ID);
      sel.appendChild(opt);
      document.body.appendChild(sel);

      setupEquipmentSync();

      sel.value = String(VALID_WEAPON_ID);
      sel.dispatchEvent(new Event('change', { bubbles: true }));

      expect(span.dataset.id).toBe(String(VALID_WEAPON_ID));
    });

    test('ignores rows without roIdx1 (new user-added rows)', () => {
      const span = document.createElement('span');
      span.id = 'leftHand1';
      span.dataset.id = String(VALID_WEAPON_ID);
      span.dataset.origId = String(VALID_WEAPON_ID);
      document.body.appendChild(span);

      const sel = document.createElement('select');
      sel.className = 'inv-name';
      sel.dataset.prevId = String(VALID_WEAPON_ID);
      // NO roIdx1 → new row
      const opt = document.createElement('option');
      opt.value = String(VALID_WEAPON_ID);
      sel.appendChild(opt);
      document.body.appendChild(sel);

      setupEquipmentSync();

      sel.value = String(VALID_WEAPON_ID + 1);
      sel.dispatchEvent(new Event('change', { bubbles: true }));

      // Span unchanged (new rows can't be equipped)
      expect(span.dataset.id).toBe(String(VALID_WEAPON_ID));
    });

    test('ignores non-inv-name selects', () => {
      const sel = document.createElement('select');
      sel.className = 'other-select';
      document.body.appendChild(sel);

      setupEquipmentSync();

      expect(() => sel.dispatchEvent(new Event('change', { bubbles: true }))).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // Table cell builders
  // -------------------------------------------------------------------------

  describe('makeCountCell', () => {
    test('creates a td with a number input', () => {
      const td = makeCountCell('inv-count', 5, true);
      expect(td.tagName).toBe('TD');
      const inp = td.querySelector('input');
      expect(inp).toBeTruthy();
      expect(inp.type).toBe('number');
      expect(inp.value).toBe('5');
      expect(inp.className).toBe('inv-count');
    });

    test('defaults to 0 when val is null', () => {
      const td = makeCountCell('inv-count', null, true);
      expect(td.querySelector('input').value).toBe('0');
    });

    test('hides cell when visible=false', () => {
      const td = makeCountCell('inv-count', 5, false);
      expect(td.hidden).toBe(true);
      expect(td.classList.contains('count-hidden')).toBe(true);
    });

    test('visible cell is not hidden', () => {
      const td = makeCountCell('inv-count', 5, true);
      expect(td.hidden).toBe(false);
      expect(td.classList.contains('count-hidden')).toBe(false);
    });
  });

  describe('parseCountValue', () => {
    test('parses a valid number', () => {
      const inp = document.createElement('input');
      inp.value = '42';
      expect(parseCountValue(inp, 1)).toBe(42);
    });

    test('returns default for null input', () => {
      expect(parseCountValue(null, 5)).toBe(5);
    });

    test('returns default for NaN value', () => {
      const inp = document.createElement('input');
      inp.value = 'abc';
      expect(parseCountValue(inp, 3)).toBe(3);
    });

    test('returns default for empty string', () => {
      const inp = document.createElement('input');
      inp.value = '';
      expect(parseCountValue(inp, 1)).toBe(1);
    });
  });

  describe('makeNumCell', () => {
    test('creates a td with a number input', () => {
      const td = makeNumCell('inv-durability', 300);
      expect(td.tagName).toBe('TD');
      const inp = td.querySelector('input');
      expect(inp.type).toBe('number');
      expect(inp.value).toBe('300');
      expect(inp.className).toBe('inv-durability');
    });

    test('defaults to 0 for null val', () => {
      const td = makeNumCell('inv-durability', null);
      expect(td.querySelector('input').value).toBe('0');
    });
  });

  // -------------------------------------------------------------------------
  // Constants
  // -------------------------------------------------------------------------

  describe('EQ_IDS and EQ_CATEGORY', () => {
    test('EQ_IDS has 17 equipment slots', () => {
      expect(EQ_IDS.length).toBe(17);
      expect(EQ_IDS).toContain('leftHand1');
      expect(EQ_IDS).toContain('quickSlot5');
    });

    test('EQ_CATEGORY maps slots to categories', () => {
      expect(EQ_CATEGORY.leftHand1).toBe('weapons');
      expect(EQ_CATEGORY.helmet).toBe('armor');
      expect(EQ_CATEGORY.ring1).toBe('rings');
      expect(EQ_CATEGORY.quickSlot1).toBe('goods');
    });
  });
});
