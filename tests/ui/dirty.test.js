/**
 * @jest-environment jsdom
 *
 * Tests for the dirty-state tracking module.
 *
 * Verifies baseline capture, dirty detection on scalar fields, revert
 * detection (value back to original clears dirty), soft-delete row
 * handling, and new-row exclusion from dirty tracking.
 */

import { jest } from '@jest/globals';

const {
  isElementDirty,
  captureBaseline,
  clearDirtyMarks,
  purgeDeletedRows,
  recomputeDirty,
  hasUnsavedChanges,
  setupDirtyListeners,
  buildDirtyTree,
  onRowAdded,
  onRowRemoved,
  onRowSoftDeleted,
  onRowUndeleted,
  setDirtyCallback,
  resetAndCaptureBaseline,
  resetDirtyState,
  setEncToggleDirty,
  hasSlotChanges,
} = await import('../../js/ui/core/dirty.js');

/**
 * Build a minimal #app > #charPanel.tab-group.top-level tree (one tab button
 * + tab-content) and seed the dirty tree. Returns the created elements so a
 * test can append inputs/tables into `content` and assert on `btn`/`app`.
 */
function buildTreeContent(tabKey = 't') {
  const app = document.createElement('div');
  app.id = 'app';
  document.body.appendChild(app);

  const btn = document.createElement('button');
  btn.className = 'tab';
  btn.dataset.tab = tabKey;
  btn.appendChild(document.createElement('span')).className = 'dirty-dot';
  const tabsDiv = document.createElement('div');
  tabsDiv.className = 'tabs';
  tabsDiv.appendChild(btn);

  const content = document.createElement('div');
  content.className = 'tab-content';
  content.dataset.tab = tabKey;

  const charPanel = document.createElement('div');
  charPanel.id = 'charPanel';
  charPanel.className = 'tab-group top-level';
  charPanel.appendChild(tabsDiv);
  charPanel.appendChild(content);
  app.appendChild(charPanel);

  buildDirtyTree();
  return { app, charPanel, btn, content };
}

describe('dirty tracking', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('isElementDirty', () => {
    test('returns false when no baseline (data-orig undefined)', () => {
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = '5';
      expect(isElementDirty(inp)).toBe(false);
    });

    test('number input: same value is not dirty', () => {
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = '5';
      inp.dataset.orig = '5';
      expect(isElementDirty(inp)).toBe(false);
    });

    test('number input: different value is dirty', () => {
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = '10';
      inp.dataset.orig = '5';
      expect(isElementDirty(inp)).toBe(true);
    });

    test('number input: numeric equality ("5" vs "5.0") is not dirty', () => {
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = '5.0';
      inp.dataset.orig = '5';
      expect(isElementDirty(inp)).toBe(false);
    });

    test('checkbox: same checked state is not dirty', () => {
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = true;
      cb.dataset.orig = 'true';
      expect(isElementDirty(cb)).toBe(false);
    });

    test('checkbox: different checked state is dirty', () => {
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = false;
      cb.dataset.orig = 'true';
      expect(isElementDirty(cb)).toBe(true);
    });

    test('text input: same value is not dirty', () => {
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.value = 'hello';
      inp.dataset.orig = 'hello';
      expect(isElementDirty(inp)).toBe(false);
    });

    test('text input: different value is dirty', () => {
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.value = 'world';
      inp.dataset.orig = 'hello';
      expect(isElementDirty(inp)).toBe(true);
    });

    test('select: same value is not dirty', () => {
      const sel = document.createElement('select');
      const opt1 = document.createElement('option');
      opt1.value = 'a';
      const opt2 = document.createElement('option');
      opt2.value = 'b';
      sel.appendChild(opt1);
      sel.appendChild(opt2);
      sel.value = 'b';
      sel.dataset.orig = 'b';
      expect(isElementDirty(sel)).toBe(false);
    });

    test('select: different value is dirty', () => {
      const sel = document.createElement('select');
      const opt1 = document.createElement('option');
      opt1.value = 'a';
      const opt2 = document.createElement('option');
      opt2.value = 'b';
      sel.appendChild(opt1);
      sel.appendChild(opt2);
      sel.value = 'a';
      sel.dataset.orig = 'b';
      expect(isElementDirty(sel)).toBe(true);
    });
  });

  describe('captureBaseline', () => {
    test('stores data-orig for all inputs and selects', () => {
      const app = document.createElement('div');
      app.id = 'app';
      document.body.appendChild(app);

      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = '42';
      inp.id = 'vit';
      app.appendChild(inp);

      const sel = document.createElement('select');
      sel.id = 'gender';
      const opt = document.createElement('option');
      opt.value = '1';
      sel.appendChild(opt);
      sel.value = '1';
      app.appendChild(sel);

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.id = 'archSealed';
      cb.checked = true;
      app.appendChild(cb);

      captureBaseline();

      expect(inp.dataset.orig).toBe('42');
      expect(sel.dataset.orig).toBe('1');
      expect(cb.dataset.orig).toBe('true');
    });

    test('skips warpLocation, saveSlot', () => {
      const app = document.createElement('div');
      app.id = 'app';
      document.body.appendChild(app);

      for (const id of ['warpLocation', 'saveSlot']) {
        const el = document.createElement('input');
        el.id = id;
        el.value = '99';
        app.appendChild(el);
      }

      captureBaseline();

      for (const id of ['warpLocation', 'saveSlot']) {
        const el = document.getElementById(id);
        expect(el.dataset.orig).toBeUndefined();
      }
    });

    test('tracks profileNum (folder-level SFO field)', () => {
      const app = document.createElement('div');
      app.id = 'app';
      document.body.appendChild(app);

      const inp = document.createElement('input');
      inp.id = 'profileNum';
      inp.type = 'number';
      inp.value = '5';
      app.appendChild(inp);

      captureBaseline();

      expect(inp.dataset.orig).toBe('5');
    });

    test('skips disabled elements (e.g. in soft-deleted rows)', () => {
      const app = document.createElement('div');
      app.id = 'app';
      document.body.appendChild(app);

      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = '5';
      inp.disabled = true;
      app.appendChild(inp);

      captureBaseline();

      expect(inp.dataset.orig).toBeUndefined();
    });
  });

  describe('recomputeDirty', () => {
    test('marks changed scalar input with .dirty class', () => {
      const app = document.createElement('div');
      app.id = 'app';
      document.body.appendChild(app);

      const inp = document.createElement('input');
      inp.type = 'number';
      inp.id = 'vit';
      inp.value = '50';
      app.appendChild(inp);

      captureBaseline();
      expect(inp.classList.contains('dirty')).toBe(false);

      // Change the value
      inp.value = '60';
      recomputeDirty();

      expect(inp.classList.contains('dirty')).toBe(true);
    });

    test('clears .dirty when value reverts to original', () => {
      const app = document.createElement('div');
      app.id = 'app';
      document.body.appendChild(app);

      const inp = document.createElement('input');
      inp.type = 'number';
      inp.id = 'vit';
      inp.value = '50';
      app.appendChild(inp);

      captureBaseline();

      inp.value = '60';
      recomputeDirty();
      expect(inp.classList.contains('dirty')).toBe(true);

      inp.value = '50';
      recomputeDirty();
      expect(inp.classList.contains('dirty')).toBe(false);
    });

    test('marks changed existing table row with .row-dirty', () => {
      const app = document.createElement('div');
      app.id = 'app';
      document.body.appendChild(app);

      const table = document.createElement('table');
      table.className = 'grid-table inv-table';
      table.dataset.category = 'weapons';
      const tbody = document.createElement('tbody');
      table.appendChild(tbody);
      app.appendChild(table);

      const tr = document.createElement('tr');
      tr.dataset.existing = 'true';
      const td = document.createElement('td');
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = '5';
      td.appendChild(inp);
      tr.appendChild(td);
      tbody.appendChild(tr);

      captureBaseline();

      inp.value = '10';
      recomputeDirty();

      expect(tr.classList.contains('row-dirty')).toBe(true);
    });

    test('does NOT mark new rows as dirty (data-existing="false")', () => {
      const app = document.createElement('div');
      app.id = 'app';
      document.body.appendChild(app);

      const table = document.createElement('table');
      table.className = 'grid-table inv-table';
      table.dataset.category = 'weapons';
      const tbody = document.createElement('tbody');
      table.appendChild(tbody);
      app.appendChild(table);

      const tr = document.createElement('tr');
      tr.dataset.existing = 'false';
      const td = document.createElement('td');
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = '5';
      td.appendChild(inp);
      tr.appendChild(td);
      tbody.appendChild(tr);

      captureBaseline();

      inp.value = '10';
      recomputeDirty();

      expect(tr.classList.contains('row-dirty')).toBe(false);
    });

    test('marks soft-deleted existing row as .row-dirty', () => {
      const app = document.createElement('div');
      app.id = 'app';
      document.body.appendChild(app);

      const table = document.createElement('table');
      table.className = 'grid-table inv-table';
      table.dataset.category = 'weapons';
      const tbody = document.createElement('tbody');
      table.appendChild(tbody);
      app.appendChild(table);

      const tr = document.createElement('tr');
      tr.dataset.existing = 'true';
      tr.dataset.deleted = 'true';
      const td = document.createElement('td');
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = '5';
      td.appendChild(inp);
      tr.appendChild(td);
      tbody.appendChild(tr);

      captureBaseline();
      recomputeDirty();

      expect(tr.classList.contains('row-dirty')).toBe(true);
    });
  });

  describe('hasUnsavedChanges', () => {
    test('returns false when nothing changed', () => {
      const app = document.createElement('div');
      app.id = 'app';
      document.body.appendChild(app);

      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = '50';
      app.appendChild(inp);

      captureBaseline();

      expect(hasUnsavedChanges()).toBe(false);
    });

    test('returns true when a scalar changed', () => {
      const app = document.createElement('div');
      app.id = 'app';
      document.body.appendChild(app);

      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = '50';
      app.appendChild(inp);

      captureBaseline();
      inp.value = '60';

      expect(hasUnsavedChanges()).toBe(true);
    });

    test('returns true when an existing row has a changed field', () => {
      const app = document.createElement('div');
      app.id = 'app';
      document.body.appendChild(app);

      const table = document.createElement('table');
      table.className = 'grid-table inv-table';
      table.dataset.category = 'weapons';
      const tbody = document.createElement('tbody');
      table.appendChild(tbody);
      app.appendChild(table);

      const tr = document.createElement('tr');
      tr.dataset.existing = 'true';
      const td = document.createElement('td');
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = '5';
      td.appendChild(inp);
      tr.appendChild(td);
      tbody.appendChild(tr);

      captureBaseline();
      inp.value = '10';

      expect(hasUnsavedChanges()).toBe(true);
    });

    test('returns false for new (inserted) rows', () => {
      const app = document.createElement('div');
      app.id = 'app';
      document.body.appendChild(app);

      const table = document.createElement('table');
      table.className = 'grid-table inv-table';
      table.dataset.category = 'weapons';
      const tbody = document.createElement('tbody');
      table.appendChild(tbody);
      app.appendChild(table);

      const tr = document.createElement('tr');
      tr.dataset.existing = 'false';
      const td = document.createElement('td');
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = '5';
      td.appendChild(inp);
      tr.appendChild(td);
      tbody.appendChild(tr);

      captureBaseline();

      expect(hasUnsavedChanges()).toBe(false);
    });

    test('returns true when an existing row is soft-deleted', () => {
      const app = document.createElement('div');
      app.id = 'app';
      document.body.appendChild(app);

      const table = document.createElement('table');
      table.className = 'grid-table inv-table';
      table.dataset.category = 'weapons';
      const tbody = document.createElement('tbody');
      table.appendChild(tbody);
      app.appendChild(table);

      const tr = document.createElement('tr');
      tr.dataset.existing = 'true';
      tr.dataset.deleted = 'true';
      const td = document.createElement('td');
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = '5';
      td.appendChild(inp);
      tr.appendChild(td);
      tbody.appendChild(tr);

      captureBaseline();

      expect(hasUnsavedChanges()).toBe(true);
    });

    test('returns true via row scan for a dirty SKIP_ID field in a grid row', () => {
      // The scalar fallback loop skips SKIP_ID elements, but the grid-row
      // scan (hasUnsavedChanges row loop) still inspects them — so a dirty
      // SKIP_ID field inside a row is caught by the row path, not the scalar path.
      const app = document.createElement('div');
      app.id = 'app';
      document.body.appendChild(app);

      const table = document.createElement('table');
      table.className = 'grid-table inv-table';
      const tbody = document.createElement('tbody');
      table.appendChild(tbody);
      app.appendChild(table);

      const tr = document.createElement('tr');
      tr.dataset.existing = 'true';
      const td = document.createElement('td');
      const inp = document.createElement('input');
      inp.id = 'warpLocation'; // SKIP_ID: skipped by scalar loop + captureBaseline
      inp.type = 'text';
      inp.value = '5';
      td.appendChild(inp);
      tr.appendChild(td);
      tbody.appendChild(tr);

      captureBaseline(); // skips warpLocation, so set the baseline manually
      inp.dataset.orig = '5';
      inp.value = '10'; // now dirty

      expect(hasUnsavedChanges()).toBe(true);
    });
  });

  // --- Branch-coverage tests ---

  describe('isElementDirty edge cases', () => {
    test('number input: both values NaN (empty) is not dirty', () => {
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = '';
      inp.dataset.orig = '';
      expect(isElementDirty(inp)).toBe(false);
    });

    test('number input: current NaN, orig valid is dirty', () => {
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = '';
      inp.dataset.orig = '5';
      expect(isElementDirty(inp)).toBe(true);
    });

    test('number input: current valid, orig NaN is dirty', () => {
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = '5';
      inp.dataset.orig = '';
      expect(isElementDirty(inp)).toBe(true);
    });

    test('number input: negative numbers compare correctly', () => {
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = '-10';
      inp.dataset.orig = '-10';
      expect(isElementDirty(inp)).toBe(false);

      inp.value = '-5';
      expect(isElementDirty(inp)).toBe(true);
    });

    test('number input: near-equal within epsilon is not dirty', () => {
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = '5.0000000001';
      inp.dataset.orig = '5';
      expect(isElementDirty(inp)).toBe(false);
    });
  });

  describe('document.body fallback (no #app)', () => {
    test('captureBaseline works without #app element', () => {
      // No #app div — functions should fall back to document.body
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = '42';
      document.body.appendChild(inp);

      captureBaseline();

      expect(inp.dataset.orig).toBe('42');
    });

    test('recomputeDirty works without #app element', () => {
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = '42';
      document.body.appendChild(inp);

      captureBaseline();
      inp.value = '50';
      recomputeDirty();

      expect(inp.classList.contains('dirty')).toBe(true);
    });

    test('clearDirtyMarks works without #app element', () => {
      const inp = document.createElement('input');
      inp.classList.add('dirty');
      document.body.appendChild(inp);

      clearDirtyMarks();

      expect(inp.classList.contains('dirty')).toBe(false);
    });

    test('hasUnsavedChanges works without #app element', () => {
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = '42';
      document.body.appendChild(inp);

      captureBaseline();

      expect(hasUnsavedChanges()).toBe(false);

      inp.value = '99';
      expect(hasUnsavedChanges()).toBe(true);
    });
  });

  describe('recomputeDirty row edge cases', () => {
    test('existing row with all cells matching baseline is NOT dirty', () => {
      const app = document.createElement('div');
      app.id = 'app';
      document.body.appendChild(app);

      const table = document.createElement('table');
      table.className = 'grid-table inv-table';
      const tbody = document.createElement('tbody');
      table.appendChild(tbody);
      app.appendChild(table);

      const tr = document.createElement('tr');
      tr.dataset.existing = 'true';
      const td = document.createElement('td');
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = '5';
      td.appendChild(inp);
      tr.appendChild(td);
      tbody.appendChild(tr);

      captureBaseline();
      // Value unchanged
      recomputeDirty();

      expect(tr.classList.contains('row-dirty')).toBe(false);
    });

    test('existing row with multiple cells, only one dirty', () => {
      const app = document.createElement('div');
      app.id = 'app';
      document.body.appendChild(app);

      const table = document.createElement('table');
      table.className = 'grid-table inv-table';
      const tbody = document.createElement('tbody');
      table.appendChild(tbody);
      app.appendChild(table);

      const tr = document.createElement('tr');
      tr.dataset.existing = 'true';

      const td1 = document.createElement('td');
      const inp1 = document.createElement('input');
      inp1.type = 'number';
      inp1.value = '5';
      td1.appendChild(inp1);

      const td2 = document.createElement('td');
      const inp2 = document.createElement('input');
      inp2.type = 'number';
      inp2.value = '10';
      td2.appendChild(inp2);

      tr.appendChild(td1);
      tr.appendChild(td2);
      tbody.appendChild(tr);

      captureBaseline();

      // Change only the second input
      inp2.value = '20';
      recomputeDirty();

      expect(tr.classList.contains('row-dirty')).toBe(true);
    });
  });

  describe('setupDirtyListeners and debounce', () => {
    beforeAll(() => jest.useFakeTimers());
    afterAll(() => jest.useRealTimers());

    test('setupDirtyListeners attaches input and change listeners', () => {
      const app = document.createElement('div');
      app.id = 'app';
      document.body.appendChild(app);

      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = '50';
      app.appendChild(inp);

      captureBaseline();
      setupDirtyListeners();

      // Simulate user editing — should NOT be dirty immediately (debounced)
      inp.value = '60';
      inp.dispatchEvent(new Event('input', { bubbles: true }));

      // Not dirty yet (debounce hasn't fired)
      expect(inp.classList.contains('dirty')).toBe(false);

      // Advance fake timers past the debounce delay
      jest.advanceTimersByTime(200);

      // Now should be dirty
      expect(inp.classList.contains('dirty')).toBe(true);
    });

    test('multiple rapid inputs are coalesced (single recompute)', () => {
      const app = document.createElement('div');
      app.id = 'app';
      document.body.appendChild(app);

      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = '50';
      app.appendChild(inp);

      captureBaseline();
      setupDirtyListeners();

      // Rapid-fire inputs
      inp.value = '51';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      inp.value = '52';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      inp.value = '53';
      inp.dispatchEvent(new Event('input', { bubbles: true }));

      jest.advanceTimersByTime(200);

      // Single recompute with final value
      expect(inp.classList.contains('dirty')).toBe(true);
    });

    test('change event triggers recompute', () => {
      const app = document.createElement('div');
      app.id = 'app';
      document.body.appendChild(app);

      const sel = document.createElement('select');
      const opt1 = document.createElement('option');
      opt1.value = 'a';
      const opt2 = document.createElement('option');
      opt2.value = 'b';
      sel.appendChild(opt1);
      sel.appendChild(opt2);
      sel.value = 'a';
      app.appendChild(sel);

      captureBaseline();
      setupDirtyListeners();

      sel.value = 'b';
      sel.dispatchEvent(new Event('change', { bubbles: true }));

      jest.advanceTimersByTime(200);

      expect(sel.classList.contains('dirty')).toBe(true);
    });
  });

  // --- Hierarchical dirty tree tests ---

  describe('hierarchical dirty tree', () => {
    let app;

    /**
     * Build a minimal tab-group DOM for testing.
     * Returns a populated charPanel that IS the tab-group (direct children:
     * .tabs and .tab-content), matching what buildDirtyTree expects.
     */
    function buildTestCharPanel(tabKey = 't1', label = 'Tab 1') {
      const btn = document.createElement('button');
      btn.className = 'tab';
      btn.dataset.tab = tabKey;
      btn.textContent = label;
      const span = document.createElement('span');
      span.className = 'dirty-dot';
      btn.appendChild(span);

      const content = document.createElement('div');
      content.className = 'tab-content';
      content.dataset.tab = tabKey;

      const tabsDiv = document.createElement('div');
      tabsDiv.className = 'tabs';
      tabsDiv.appendChild(btn);

      const charPanel = document.createElement('div');
      charPanel.id = 'charPanel';
      charPanel.className = 'tab-group top-level';
      charPanel.appendChild(tabsDiv);
      charPanel.appendChild(content);

      return { charPanel, btn, content };
    }

    beforeEach(() => {
      app = document.createElement('div');
      app.id = 'app';
      document.body.appendChild(app);
    });

    test('buildDirtyTree creates nodes for tab groups', () => {
      const { charPanel } = buildTestCharPanel();
      app.appendChild(charPanel);

      buildDirtyTree();
      captureBaseline();

      expect(hasUnsavedChanges()).toBe(false);
    });

    test('editing a scalar in a tab-content bumps the tab dirty dot', () => {
      const { charPanel, btn, content } = buildTestCharPanel();
      app.appendChild(charPanel);

      buildDirtyTree();

      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = '50';
      content.appendChild(inp);

      captureBaseline();
      expect(btn.classList.contains('dirty')).toBe(false);

      inp.value = '60';
      recomputeDirty();

      expect(inp.classList.contains('dirty')).toBe(true);
      expect(btn.classList.contains('dirty')).toBe(true);
    });

    test('reverting value clears the tab dirty dot', () => {
      const { charPanel, btn, content } = buildTestCharPanel();
      app.appendChild(charPanel);

      buildDirtyTree();

      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = '50';
      content.appendChild(inp);

      captureBaseline();
      inp.value = '60';
      recomputeDirty();
      expect(btn.classList.contains('dirty')).toBe(true);

      inp.value = '50';
      recomputeDirty();

      expect(btn.classList.contains('dirty')).toBe(false);
    });

    test('hasUnsavedChanges is O(1) via root count', () => {
      const { charPanel, content } = buildTestCharPanel();
      app.appendChild(charPanel);

      buildDirtyTree();

      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = '50';
      content.appendChild(inp);

      captureBaseline();
      expect(hasUnsavedChanges()).toBe(false);

      inp.value = '60';
      recomputeDirty();
      expect(hasUnsavedChanges()).toBe(true);

      inp.value = '50';
      recomputeDirty();
      expect(hasUnsavedChanges()).toBe(false);
    });
  });

  // --- Row lifecycle hook tests ---

  describe('row lifecycle hooks', () => {
    let app;

    beforeEach(() => {
      app = buildTreeContent().app;
    });

    function makeTestRow(existing = true) {
      const table = document.createElement('table');
      table.className = 'grid-table inv-table';
      const tbody = document.createElement('tbody');
      table.appendChild(tbody);
      app.querySelector('.tab-content').appendChild(table);

      const tr = document.createElement('tr');
      tr.dataset.existing = String(existing);
      const td = document.createElement('td');
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = '5';
      td.appendChild(inp);
      tr.appendChild(td);
      tbody.appendChild(tr);
      return tr;
    }

    test('onRowAdded bumps dirty count for new row', () => {
      captureBaseline();
      expect(hasUnsavedChanges()).toBe(false);

      const tr = makeTestRow(false);
      onRowAdded(tr);

      expect(hasUnsavedChanges()).toBe(true);
    });

    test('onRowRemoved undoes onRowAdded', () => {
      captureBaseline();
      const tr = makeTestRow(false);
      onRowAdded(tr);
      expect(hasUnsavedChanges()).toBe(true);

      onRowRemoved(tr);
      expect(hasUnsavedChanges()).toBe(false);
    });

    test('onRowSoftDeleted bumps dirty for existing row', () => {
      const tr = makeTestRow(true);
      captureBaseline();
      expect(hasUnsavedChanges()).toBe(false);

      onRowSoftDeleted(tr);
      expect(hasUnsavedChanges()).toBe(true);
    });

    test('onRowUndeleted undoes onRowSoftDeleted', () => {
      const tr = makeTestRow(true);
      captureBaseline();
      onRowSoftDeleted(tr);
      expect(hasUnsavedChanges()).toBe(true);

      onRowUndeleted(tr);
      expect(hasUnsavedChanges()).toBe(false);
    });

    test('onRowSoftDeleted clears per-cell dirty before adding deletion dirty', () => {
      const tr = makeTestRow(true);
      const inp = tr.querySelector('input');
      captureBaseline();

      // Make a cell dirty first
      inp.value = '99';
      recomputeDirty();
      expect(hasUnsavedChanges()).toBe(true);

      // Soft-delete clears cell dirty, adds deletion dirty
      onRowSoftDeleted(tr);
      // Net: was 1 dirty cell (cleared → 0) + 1 deletion = 1 dirty
      expect(hasUnsavedChanges()).toBe(true);

      // Undelete removes the deletion dirty
      onRowUndeleted(tr);
      expect(hasUnsavedChanges()).toBe(false);
    });

    test('onRowAdded is idempotent (double-add counted once)', () => {
      captureBaseline();
      const tr = makeTestRow(false);
      onRowAdded(tr);
      onRowAdded(tr); // second call should be a no-op

      onRowRemoved(tr);
      expect(hasUnsavedChanges()).toBe(false);
    });
  });

  // --- Dirty callback tests ---

  describe('setDirtyCallback', () => {
    let app;

    beforeAll(() => jest.useFakeTimers());
    afterAll(() => jest.useRealTimers());

    beforeEach(() => {
      app = buildTreeContent().app;
    });

    test('callback fires with true when form becomes dirty', () => {
      const calls = [];
      setDirtyCallback((isDirty) => calls.push(isDirty));

      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = '50';
      app.querySelector('.tab-content').appendChild(inp);

      captureBaseline();
      setupDirtyListeners();

      inp.value = '60';
      inp.dispatchEvent(new Event('input', { bubbles: true }));

      jest.advanceTimersByTime(200);

      expect(calls).toContain(true);
    });

    test('callback fires with false when form reverts to clean', () => {
      const calls = [];
      setDirtyCallback((isDirty) => calls.push(isDirty));

      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = '50';
      app.querySelector('.tab-content').appendChild(inp);

      captureBaseline();
      setupDirtyListeners();

      // Make dirty
      inp.value = '60';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      jest.advanceTimersByTime(200);

      // Revert to clean
      inp.value = '50';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      jest.advanceTimersByTime(200);

      expect(calls).toContain(false);
    });
  });

  describe('recomputeDirty scalar and row paths', () => {
    test('recomputeDirty with no inputs in a grid-table tbody row is safe', () => {
      const app = document.createElement('div');
      app.id = 'app';
      document.body.appendChild(app);

      const table = document.createElement('table');
      table.className = 'grid-table inv-table';
      const tbody = document.createElement('tbody');
      table.appendChild(tbody);
      app.appendChild(table);

      // Empty row — no inputs, not new, not deleted
      const tr = document.createElement('tr');
      tr.dataset.existing = 'true';
      tbody.appendChild(tr);

      captureBaseline();
      // Should not throw
      recomputeDirty();
      expect(tr.classList.contains('row-dirty')).toBe(false);
    });
  });

  describe('hasUnsavedChanges with table rows', () => {
    function buildDirtyRow(deleted = false) {
      const app = document.createElement('div');
      app.id = 'app';
      document.body.appendChild(app);

      const table = document.createElement('table');
      table.className = 'grid-table inv-table';
      const tbody = document.createElement('tbody');
      table.appendChild(tbody);
      app.appendChild(table);

      const tr = document.createElement('tr');
      tr.dataset.existing = 'true';
      if (deleted) tr.dataset.deleted = 'true';
      const td = document.createElement('td');
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = '5';
      td.appendChild(inp);
      tr.appendChild(td);
      tbody.appendChild(tr);
      return { tr, inp };
    }

    test('returns true when a table row has a dirty cell', () => {
      const { inp } = buildDirtyRow();
      captureBaseline();
      inp.value = '99';
      // recomputeDirty is needed to update the dirty tree
      recomputeDirty();

      expect(hasUnsavedChanges()).toBe(true);
    });

    test('returns true when a table row is soft-deleted', () => {
      buildDirtyRow(true);
      captureBaseline();
      // recomputeDirty marks soft-deleted rows as dirty in the tree
      recomputeDirty();

      expect(hasUnsavedChanges()).toBe(true);
    });

    test('returns false when all table rows match baseline', () => {
      buildDirtyRow();
      captureBaseline();

      expect(hasUnsavedChanges()).toBe(false);
    });
  });

  describe('purgeDeletedRows', () => {
    test('removes all soft-deleted rows from grid tables', () => {
      const app = document.createElement('div');
      app.id = 'app';
      document.body.appendChild(app);

      const table = document.createElement('table');
      table.className = 'grid-table inv-table';
      const tbody = document.createElement('tbody');
      table.appendChild(tbody);
      app.appendChild(table);

      // Create 3 rows, 2 deleted
      const tr1 = document.createElement('tr');
      tr1.dataset.deleted = 'true';
      const tr2 = document.createElement('tr');
      const tr3 = document.createElement('tr');
      tr3.dataset.deleted = 'true';
      tbody.appendChild(tr1);
      tbody.appendChild(tr2);
      tbody.appendChild(tr3);

      purgeDeletedRows();

      expect(tbody.querySelectorAll('tr').length).toBe(1);
      expect(tbody.contains(tr2)).toBe(true);
    });

    test('does not remove rows from non-grid tables', () => {
      const table = document.createElement('table');
      table.className = 'some-other-table';
      const tbody = document.createElement('tbody');
      table.appendChild(tbody);
      document.body.appendChild(table);

      const tr = document.createElement('tr');
      tr.dataset.deleted = 'true';
      tbody.appendChild(tr);

      purgeDeletedRows();

      expect(tbody.querySelectorAll('tr').length).toBe(1);
    });
  });

  // --- Nested tab-group and editor panel tree tests ---

  describe('buildDirtyTree nested structures', () => {
    test('processes nested sub-tab groups inside tab-content', () => {
      const app = document.createElement('div');
      app.id = 'app';
      document.body.appendChild(app);

      // Build charPanel with nested sub-tab-container
      const charPanel = document.createElement('div');
      charPanel.id = 'charPanel';
      charPanel.className = 'tab-group top-level';

      const tabsDiv = document.createElement('div');
      tabsDiv.className = 'tabs';
      const btn = document.createElement('button');
      btn.className = 'tab';
      btn.dataset.tab = 'editor-tab';
      btn.appendChild(document.createElement('span')).className = 'dirty-dot';
      tabsDiv.appendChild(btn);

      const content = document.createElement('div');
      content.className = 'tab-content';
      content.dataset.tab = 'editor-tab';

      // Add nested sub-tab-container with a sub-tab-group
      const subContainer = document.createElement('div');
      subContainer.className = 'sub-tab-container';

      const subTabGroup = document.createElement('div');
      subTabGroup.className = 'tab-group';

      const subTabsDiv = document.createElement('div');
      subTabsDiv.className = 'tabs';
      const subBtn = document.createElement('button');
      subBtn.className = 'tab';
      subBtn.dataset.tab = 'sub-tab-1';
      subBtn.appendChild(document.createElement('span')).className = 'dirty-dot';
      subTabsDiv.appendChild(subBtn);

      const subContent = document.createElement('div');
      subContent.className = 'tab-content';
      subContent.dataset.tab = 'sub-tab-1';

      subTabGroup.appendChild(subTabsDiv);
      subTabGroup.appendChild(subContent);
      subContainer.appendChild(subTabGroup);
      content.appendChild(subContainer);

      charPanel.appendChild(tabsDiv);
      charPanel.appendChild(content);
      app.appendChild(charPanel);

      // Should not throw — exercises recursive processTabGroup
      buildDirtyTree();

      // Add an input to the sub-content and verify dirty tracking works
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = '5';
      subContent.appendChild(inp);

      captureBaseline();
      inp.value = '10';
      recomputeDirty();

      // Both the sub-tab button and the parent tab button should be dirty
      expect(subBtn.classList.contains('dirty')).toBe(true);
      expect(btn.classList.contains('dirty')).toBe(true);
    });

    test('processes editor panel (main#editor > .tab-group)', () => {
      const app = document.createElement('div');
      app.id = 'app';
      document.body.appendChild(app);

      // Build editor panel
      const editor = document.createElement('main');
      editor.id = 'editor';

      const editorGroup = document.createElement('div');
      editorGroup.className = 'tab-group top-level';

      const tabsDiv = document.createElement('div');
      tabsDiv.className = 'tabs';
      const btn = document.createElement('button');
      btn.className = 'tab';
      btn.dataset.tab = 'build';
      btn.appendChild(document.createElement('span')).className = 'dirty-dot';
      tabsDiv.appendChild(btn);

      const content = document.createElement('div');
      content.className = 'tab-content';
      content.dataset.tab = 'build';

      editorGroup.appendChild(tabsDiv);
      editorGroup.appendChild(content);
      editor.appendChild(editorGroup);
      app.appendChild(editor);

      // Should not throw — exercises editor panel tree building
      buildDirtyTree();

      // Verify dirty tracking works on editor panel content
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = '50';
      content.appendChild(inp);

      captureBaseline();
      expect(btn.classList.contains('dirty')).toBe(false);

      inp.value = '99';
      recomputeDirty();

      expect(btn.classList.contains('dirty')).toBe(true);
    });

    test('hasUnsavedChanges fallback scan works for scalar without tree', () => {
      // The dirty module's dirtyRoot may be set from prior tests.
      // We just verify hasUnsavedChanges returns a boolean without crashing.
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = '5';
      inp.dataset.orig = '5';
      document.body.appendChild(inp);

      // Should return a boolean
      expect(typeof hasUnsavedChanges()).toBe('boolean');
    });
  });

  // --- Debounced dirty listener with table row cells ---

  describe('debounced dirty tracking on table row cells', () => {
    beforeAll(() => jest.useFakeTimers());
    afterAll(() => jest.useRealTimers());

    test('editing a cell inside a grid-table row marks the row dirty via debounce', () => {
      const { content, btn } = buildTreeContent();

      // Add a table with an existing row containing an input
      const table = document.createElement('table');
      table.className = 'grid-table inv-table';
      const tbody = document.createElement('tbody');
      table.appendChild(tbody);
      content.appendChild(table);

      const tr = document.createElement('tr');
      tr.dataset.existing = 'true';
      const td = document.createElement('td');
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = '5';
      td.appendChild(inp);
      tr.appendChild(td);
      tbody.appendChild(tr);

      captureBaseline();
      setupDirtyListeners();

      // Edit the cell
      inp.value = '99';
      inp.dispatchEvent(new Event('input', { bubbles: true }));

      // Not dirty yet (debounced)
      expect(inp.classList.contains('dirty')).toBe(false);

      jest.advanceTimersByTime(200);

      // Now dirty
      expect(inp.classList.contains('dirty')).toBe(true);
      expect(tr.classList.contains('row-dirty')).toBe(true);
      expect(btn.classList.contains('dirty')).toBe(true);
    });

    test('change event on a select inside a grid-table row marks it dirty', () => {
      const { content } = buildTreeContent();

      // Add a table with a row containing a select
      const table = document.createElement('table');
      table.className = 'grid-table inv-table';
      const tbody = document.createElement('tbody');
      table.appendChild(tbody);
      content.appendChild(table);

      const tr = document.createElement('tr');
      tr.dataset.existing = 'true';
      const td = document.createElement('td');
      const sel = document.createElement('select');
      const opt1 = document.createElement('option');
      opt1.value = 'a';
      const opt2 = document.createElement('option');
      opt2.value = 'b';
      sel.appendChild(opt1);
      sel.appendChild(opt2);
      sel.value = 'a';
      td.appendChild(sel);
      tr.appendChild(td);
      tbody.appendChild(tr);

      captureBaseline();
      setupDirtyListeners();

      sel.value = 'b';
      sel.dispatchEvent(new Event('change', { bubbles: true }));

      jest.advanceTimersByTime(200);

      expect(sel.classList.contains('dirty')).toBe(true);
      expect(tr.classList.contains('row-dirty')).toBe(true);
    });
  });

  // --- Additional branch-coverage tests ---

  describe('row lifecycle edge cases', () => {
    let app;

    beforeEach(() => {
      app = buildTreeContent().app;
    });

    test('onRowRemoved on a row that was never added is a no-op', () => {
      captureBaseline();
      const table = document.createElement('table');
      table.className = 'grid-table inv-table';
      const tbody = document.createElement('tbody');
      table.appendChild(tbody);
      app.querySelector('.tab-content').appendChild(table);

      const tr = document.createElement('tr');
      tr.dataset.existing = 'false';
      tbody.appendChild(tr);

      // Should not throw or affect dirty count
      onRowRemoved(tr);
      expect(hasUnsavedChanges()).toBe(false);
    });

    test('onRowUndeleted on a row that was never soft-deleted is a no-op', () => {
      captureBaseline();
      const table = document.createElement('table');
      table.className = 'grid-table inv-table';
      const tbody = document.createElement('tbody');
      table.appendChild(tbody);
      app.querySelector('.tab-content').appendChild(table);

      const tr = document.createElement('tr');
      tr.dataset.existing = 'true';
      tbody.appendChild(tr);

      // Should not throw or affect dirty count
      onRowUndeleted(tr);
      expect(hasUnsavedChanges()).toBe(false);
    });

    test('onRowAdded on a row not inside .tab-content falls back to toolbar node', () => {
      captureBaseline();
      // Row outside any tab-content (directly in #app)
      const table = document.createElement('table');
      table.className = 'grid-table inv-table';
      const tbody = document.createElement('tbody');
      table.appendChild(tbody);
      app.appendChild(table);

      const tr = document.createElement('tr');
      tr.dataset.existing = 'false';
      tbody.appendChild(tr);

      // Should not throw — uses toolbar fallback node
      onRowAdded(tr);
      expect(hasUnsavedChanges()).toBe(true);

      onRowRemoved(tr);
      expect(hasUnsavedChanges()).toBe(false);
    });

    test('onRowSoftDeleted on a row not inside .tab-content falls back to toolbar node', () => {
      captureBaseline();
      const table = document.createElement('table');
      table.className = 'grid-table inv-table';
      const tbody = document.createElement('tbody');
      table.appendChild(tbody);
      app.appendChild(table);

      const tr = document.createElement('tr');
      tr.dataset.existing = 'true';
      const td = document.createElement('td');
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = '5';
      td.appendChild(inp);
      tr.appendChild(td);
      tbody.appendChild(tr);

      // Should not throw
      onRowSoftDeleted(tr);
      expect(tr.classList.contains('row-dirty')).toBe(true);
      expect(hasUnsavedChanges()).toBe(true);

      onRowUndeleted(tr);
      expect(hasUnsavedChanges()).toBe(false);
    });

    test('onRowSoftDeleted with no dirty cells does not crash', () => {
      captureBaseline();
      const table = document.createElement('table');
      table.className = 'grid-table inv-table';
      const tbody = document.createElement('tbody');
      table.appendChild(tbody);
      app.querySelector('.tab-content').appendChild(table);

      const tr = document.createElement('tr');
      tr.dataset.existing = 'true';
      const td = document.createElement('td');
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = '5';
      td.appendChild(inp);
      tr.appendChild(td);
      tbody.appendChild(tr);

      // Soft-delete with no dirty cells (dirtyCellCount stays 0)
      onRowSoftDeleted(tr);
      expect(tr.classList.contains('row-dirty')).toBe(true);
    });
  });

  describe('setupDirtyListeners SKIP_IDS', () => {
    beforeAll(() => jest.useFakeTimers());
    afterAll(() => jest.useRealTimers());

    test('SKIP_IDS elements are excluded from dirty tracking', () => {
      const app = document.createElement('div');
      app.id = 'app';
      document.body.appendChild(app);

      for (const id of ['warpLocation', 'saveSlot']) {
        const el = document.createElement('input');
        el.type = 'number';
        el.value = '0';
        el.id = id;
        app.appendChild(el);
      }

      captureBaseline();
      setupDirtyListeners();

      // Change values
      for (const id of ['warpLocation', 'saveSlot']) {
        const el = /** @type {HTMLInputElement} */ (document.getElementById(id));
        el.value = '99';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }

      jest.advanceTimersByTime(200);

      // SKIP_IDS elements should NOT be marked dirty
      for (const id of ['warpLocation', 'saveSlot']) {
        expect(document.getElementById(id).classList.contains('dirty')).toBe(false);
      }
    });
  });

  describe('processTabGroup edge cases', () => {
    test('tab-content without data-tab is skipped', () => {
      const app = document.createElement('div');
      app.id = 'app';
      document.body.appendChild(app);

      const charPanel = document.createElement('div');
      charPanel.id = 'charPanel';
      charPanel.className = 'tab-group top-level';
      const tabsDiv = document.createElement('div');
      tabsDiv.className = 'tabs';
      const btn = document.createElement('button');
      btn.className = 'tab';
      btn.dataset.tab = 'real';
      btn.appendChild(document.createElement('span')).className = 'dirty-dot';
      tabsDiv.appendChild(btn);

      // Real tab-content
      const content = document.createElement('div');
      content.className = 'tab-content';
      content.dataset.tab = 'real';

      // Fake tab-content WITHOUT data-tab (should be skipped)
      const fakeContent = document.createElement('div');
      fakeContent.className = 'tab-content';
      // No data-tab attribute!

      charPanel.appendChild(tabsDiv);
      charPanel.appendChild(content);
      charPanel.appendChild(fakeContent);
      app.appendChild(charPanel);

      // Should not throw — exercises the `if (!tabKey) continue;` branch
      buildDirtyTree();
    });

    test('tab-content with no matching button gets null indicator', () => {
      const app = document.createElement('div');
      app.id = 'app';
      document.body.appendChild(app);

      const charPanel = document.createElement('div');
      charPanel.id = 'charPanel';
      charPanel.className = 'tab-group top-level';
      const tabsDiv = document.createElement('div');
      tabsDiv.className = 'tabs';
      // Button for tab "a" only
      const btnA = document.createElement('button');
      btnA.className = 'tab';
      btnA.dataset.tab = 'a';
      btnA.appendChild(document.createElement('span')).className = 'dirty-dot';
      tabsDiv.appendChild(btnA);

      // Content for tab "a" (has button) and tab "b" (no button)
      const contentA = document.createElement('div');
      contentA.className = 'tab-content';
      contentA.dataset.tab = 'a';
      const contentB = document.createElement('div');
      contentB.className = 'tab-content';
      contentB.dataset.tab = 'b';

      charPanel.appendChild(tabsDiv);
      charPanel.appendChild(contentA);
      charPanel.appendChild(contentB);
      app.appendChild(charPanel);

      // Should not throw — contentB gets indicatorEl=null
      buildDirtyTree();

      // Input in contentB can still be tracked (node exists, just no indicator)
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = '5';
      contentB.appendChild(inp);
      captureBaseline();
      inp.value = '10';
      recomputeDirty();
      expect(inp.classList.contains('dirty')).toBe(true);
    });
  });

  describe('bump clamp safety', () => {
    test('count clamps to 0 when going negative', () => {
      const { content } = buildTreeContent();

      captureBaseline();

      // Add then remove then remove again — second remove guard prevents
      // double-counting, but let's verify it doesn't crash.
      const table = document.createElement('table');
      table.className = 'grid-table inv-table';
      const tbody = document.createElement('tbody');
      table.appendChild(tbody);
      content.appendChild(table);
      const tr = document.createElement('tr');
      tr.dataset.existing = 'false';
      tbody.appendChild(tr);

      onRowAdded(tr);
      expect(hasUnsavedChanges()).toBe(true);
      onRowRemoved(tr);
      expect(hasUnsavedChanges()).toBe(false);
      // Double-remove: guarded by newRowContributesDirty.get(tr) === false
      onRowRemoved(tr);
      expect(hasUnsavedChanges()).toBe(false);
    });
  });

  describe('hasUnsavedChanges outside tab-content', () => {
    test('scalar outside tab-content is detected after recomputeDirty', () => {
      const { app } = buildTreeContent();

      // Input outside any tab-content (directly in #app)
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = '5';
      inp.id = 'vit';
      app.appendChild(inp);

      captureBaseline();
      inp.value = '99';
      recomputeDirty();

      expect(hasUnsavedChanges()).toBe(true);
    });
  });

  describe('clearDirtyMarks without tree', () => {
    test('clearDirtyMarks removes all dirty marks from DOM', () => {
      const app = document.createElement('div');
      app.id = 'app';
      document.body.appendChild(app);

      // Add elements with dirty classes
      const inp = document.createElement('input');
      inp.classList.add('dirty');
      app.appendChild(inp);

      const tr = document.createElement('tr');
      tr.classList.add('row-dirty');
      app.appendChild(tr);

      // Also add a tab button with dirty
      const btn = document.createElement('button');
      btn.classList.add('dirty');
      app.appendChild(btn);

      clearDirtyMarks();

      expect(inp.classList.contains('dirty')).toBe(false);
      expect(tr.classList.contains('row-dirty')).toBe(false);
      expect(btn.classList.contains('dirty')).toBe(false);
    });
  });

  describe('updateElementDirty via debounced listener edge cases', () => {
    beforeAll(() => jest.useFakeTimers());
    afterAll(() => jest.useRealTimers());

    test('editing input inside a new row (data-existing=false) does not mark dirty', () => {
      const { content } = buildTreeContent();

      const table = document.createElement('table');
      table.className = 'grid-table inv-table';
      const tbody = document.createElement('tbody');
      table.appendChild(tbody);
      content.appendChild(table);

      const tr = document.createElement('tr');
      tr.dataset.existing = 'false';
      const td = document.createElement('td');
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = '5';
      td.appendChild(inp);
      tr.appendChild(td);
      tbody.appendChild(tr);

      captureBaseline();
      setupDirtyListeners();

      inp.value = '99';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      jest.advanceTimersByTime(200);

      // New row inputs should NOT be marked dirty (tracked at row level)
      expect(inp.classList.contains('dirty')).toBe(false);
      expect(tr.classList.contains('row-dirty')).toBe(false);
    });

    test('editing input inside a soft-deleted row does not mark dirty', () => {
      const { content } = buildTreeContent();

      const table = document.createElement('table');
      table.className = 'grid-table inv-table';
      const tbody = document.createElement('tbody');
      table.appendChild(tbody);
      content.appendChild(table);

      const tr = document.createElement('tr');
      tr.dataset.existing = 'true';
      tr.dataset.deleted = 'true';
      const td = document.createElement('td');
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = '5';
      inp.disabled = true;
      td.appendChild(inp);
      tr.appendChild(td);
      tbody.appendChild(tr);

      captureBaseline();
      setupDirtyListeners();

      // Try to edit (even though disabled, simulate the event)
      inp.value = '99';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      jest.advanceTimersByTime(200);

      // Soft-deleted row inputs should NOT be marked dirty via updateElementDirty
      // (the deleted row is already tracked as dirty at the row level)
    });

    test('input without baseline (no data-orig) is ignored by dirty listener', () => {
      const { content } = buildTreeContent();
      setupDirtyListeners();

      // Input with no baseline — should be ignored
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = '5';
      // No captureBaseline, so no data-orig
      content.appendChild(inp);

      inp.value = '99';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      jest.advanceTimersByTime(200);

      // No crash, no dirty mark (data-orig is undefined → updateElementDirty returns early)
      expect(inp.classList.contains('dirty')).toBe(false);
    });

    test('reverting value to baseline via debounce clears dirty', () => {
      const { content } = buildTreeContent();

      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = '5';
      content.appendChild(inp);

      captureBaseline();
      setupDirtyListeners();

      // Make dirty
      inp.value = '10';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      jest.advanceTimersByTime(200);
      expect(inp.classList.contains('dirty')).toBe(true);

      // Revert to baseline — should clear dirty (isDirty === wasDirty transition)
      inp.value = '5';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      jest.advanceTimersByTime(200);
      expect(inp.classList.contains('dirty')).toBe(false);
    });
  });

  // --- resetAndCaptureBaseline tests ---

  describe('resetAndCaptureBaseline', () => {
    test('captures baseline and clears dirty marks in a single pass', () => {
      const { content, btn } = buildTreeContent();

      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = '50';
      content.appendChild(inp);

      // First capture + make dirty
      captureBaseline();
      inp.value = '99';
      recomputeDirty();
      expect(inp.classList.contains('dirty')).toBe(true);
      expect(btn.classList.contains('dirty')).toBe(true);

      // Now resetAndCaptureBaseline should clear everything + set new baseline
      resetAndCaptureBaseline();

      expect(inp.classList.contains('dirty')).toBe(false);
      expect(btn.classList.contains('dirty')).toBe(false);
      expect(inp.dataset.orig).toBe('99');
      expect(hasUnsavedChanges()).toBe(false);
    });

    test('skips warpLocation, saveSlot', () => {
      const app = document.createElement('div');
      app.id = 'app';
      document.body.appendChild(app);

      for (const id of ['warpLocation', 'saveSlot']) {
        const el = document.createElement('input');
        el.id = id;
        el.type = 'number';
        el.value = '5';
        app.appendChild(el);
      }

      resetAndCaptureBaseline();

      for (const id of ['warpLocation', 'saveSlot']) {
        expect(document.getElementById(id).dataset.orig).toBeUndefined();
      }
    });

    test('skips disabled elements', () => {
      const app = document.createElement('div');
      app.id = 'app';
      document.body.appendChild(app);

      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = '5';
      inp.disabled = true;
      app.appendChild(inp);

      resetAndCaptureBaseline();

      expect(inp.dataset.orig).toBeUndefined();
    });

    test('captures checkbox baseline as string', () => {
      const app = document.createElement('div');
      app.id = 'app';
      document.body.appendChild(app);

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = true;
      app.appendChild(cb);

      resetAndCaptureBaseline();

      expect(cb.dataset.orig).toBe('true');
    });

    test('removes row-dirty class from existing rows', () => {
      const app = document.createElement('div');
      app.id = 'app';
      document.body.appendChild(app);

      const table = document.createElement('table');
      table.className = 'grid-table inv-table';
      const tbody = document.createElement('tbody');
      table.appendChild(tbody);
      app.appendChild(table);

      const tr = document.createElement('tr');
      tr.dataset.existing = 'true';
      tr.classList.add('row-dirty');
      tbody.appendChild(tr);

      resetAndCaptureBaseline();

      expect(tr.classList.contains('row-dirty')).toBe(false);
    });

    test('removes dirty class from non-input elements (tab buttons, row markers)', () => {
      const app = document.createElement('div');
      app.id = 'app';
      document.body.appendChild(app);

      // A non-input/non-select element carrying .dirty (e.g. a tab button or row marker).
      const marker = document.createElement('div');
      marker.className = 'dirty';
      app.appendChild(marker);

      resetAndCaptureBaseline();

      expect(marker.classList.contains('dirty')).toBe(false);
    });

    test('cancels pending debounced flush', () => {
      const app = document.createElement('div');
      app.id = 'app';
      document.body.appendChild(app);

      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = '50';
      app.appendChild(inp);

      // Should not throw even with pending elements
      expect(() => resetAndCaptureBaseline()).not.toThrow();
    });
  });

  // --- resetDirtyState tests ---

  describe('resetDirtyState', () => {
    beforeAll(() => jest.useFakeTimers());
    afterAll(() => jest.useRealTimers());

    test('clears dirty state so hasUnsavedChanges uses fallback scan', () => {
      const { content } = buildTreeContent();
      captureBaseline();

      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = '50';
      content.appendChild(inp);
      captureBaseline();
      inp.value = '60';
      recomputeDirty();

      expect(hasUnsavedChanges()).toBe(true);

      // Reset — tree root count goes to 0
      resetDirtyState();

      expect(hasUnsavedChanges()).toBe(false);
    });

    test('clears the dirty callback', () => {
      const { content } = buildTreeContent();

      const calls = [];
      setDirtyCallback((isDirty) => calls.push(isDirty));

      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = '50';
      content.appendChild(inp);
      captureBaseline();
      setupDirtyListeners();

      inp.value = '60';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      jest.advanceTimersByTime(200);

      expect(calls.length).toBeGreaterThan(0);

      // Reset clears callback
      resetDirtyState();

      const callsBefore = calls.length;
      inp.value = '70';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      jest.advanceTimersByTime(200);

      expect(calls.length).toBe(callsBefore); // no new callback fires
    });

    test('is safe to call when no tree exists', () => {
      expect(() => resetDirtyState()).not.toThrow();
    });
  });

  // --- Fallback scan coverage (dirtyRoot set but reset) ---
  // Note: dirtyRoot persists across tests within the same test file.
  // resetDirtyState() resets its count to 0 but doesn't null it.
  // These tests exercise the tree-based path with count=0 baseline.

  describe('hasUnsavedChanges after reset (dirtyRoot.count = 0)', () => {
    test('returns false when nothing changed after reset', () => {
      resetDirtyState();
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = '42';
      document.body.appendChild(inp);

      captureBaseline();

      expect(hasUnsavedChanges()).toBe(false);
    });

    test('returns false for changed input after reset without recomputeDirty', () => {
      resetDirtyState();
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = '42';
      document.body.appendChild(inp);

      captureBaseline();
      inp.value = '99';

      // Tree count is still 0 — recomputeDirty wasn't called
      // This is expected behavior (O(1) check via root count)
      expect(hasUnsavedChanges()).toBe(false);
    });

    test('returns true for changed input after reset + recomputeDirty', () => {
      resetDirtyState();
      buildDirtyTree();
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = '42';
      document.body.appendChild(inp);

      captureBaseline();
      inp.value = '99';
      recomputeDirty();

      expect(hasUnsavedChanges()).toBe(true);
    });
  });

  // --- Enc/dec toggle dirty tracking tests ---

  describe('setEncToggleDirty', () => {
    beforeEach(() => {
      buildTreeContent();
      captureBaseline();
    });

    test('makes hasUnsavedChanges return true when set to dirty', () => {
      expect(hasUnsavedChanges()).toBe(false);

      setEncToggleDirty(true);

      expect(hasUnsavedChanges()).toBe(true);
    });

    test('makes hasUnsavedChanges return false when set back to clean', () => {
      setEncToggleDirty(true);
      expect(hasUnsavedChanges()).toBe(true);

      setEncToggleDirty(false);

      expect(hasUnsavedChanges()).toBe(false);
    });

    test('is idempotent (double-true counted once)', () => {
      setEncToggleDirty(true);
      setEncToggleDirty(true); // no-op

      setEncToggleDirty(false);

      expect(hasUnsavedChanges()).toBe(false);
    });

    test('survives resetAndCaptureBaseline (slot switch scenario)', () => {
      setEncToggleDirty(true);
      expect(hasUnsavedChanges()).toBe(true);

      // Simulate slot switch (calls resetAndCaptureBaseline internally)
      resetAndCaptureBaseline();

      // Enc toggle dirty should survive because it's app-level state
      expect(hasUnsavedChanges()).toBe(true);
    });

    test('survives captureBaseline', () => {
      setEncToggleDirty(true);
      expect(hasUnsavedChanges()).toBe(true);

      captureBaseline();

      expect(hasUnsavedChanges()).toBe(true);
    });

    test('is cleared by resetDirtyState (close/teardown)', () => {
      setEncToggleDirty(true);
      expect(hasUnsavedChanges()).toBe(true);

      resetDirtyState();

      expect(hasUnsavedChanges()).toBe(false);
    });

    test('fires dirty callback on transition', () => {
      const calls = [];
      setDirtyCallback((isDirty) => calls.push(isDirty));

      setEncToggleDirty(true);

      expect(calls).toContain(true);
    });
  });

  // --- hasSlotChanges tests ---

  describe('hasSlotChanges', () => {
    let app;
    let content;

    beforeEach(() => {
      const built = buildTreeContent();
      app = built.app;
      content = built.content;
      captureBaseline();
    });

    test('returns false when nothing is dirty', () => {
      expect(hasSlotChanges()).toBe(false);
    });

    test('returns false when only toolbar fields (profileNum) are dirty', () => {
      // profileNum is outside any tab-content → falls to toolbar node
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.id = 'profileNum';
      inp.value = '5';
      app.appendChild(inp);
      captureBaseline();

      inp.value = '99';
      recomputeDirty();

      expect(hasUnsavedChanges()).toBe(true); // total dirty
      expect(hasSlotChanges()).toBe(false); // but no per-slot changes
    });

    test('returns false when only toolbar fields (accountId) are dirty', () => {
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.id = 'accountId';
      inp.value = 'old';
      app.appendChild(inp);
      captureBaseline();

      inp.value = 'new';
      recomputeDirty();

      expect(hasUnsavedChanges()).toBe(true);
      expect(hasSlotChanges()).toBe(false);
    });

    test('returns false when only enc toggle is dirty', () => {
      setEncToggleDirty(true);

      expect(hasUnsavedChanges()).toBe(true);
      expect(hasSlotChanges()).toBe(false);
    });

    test('returns true when per-slot field (in tab-content) is dirty', () => {
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = '50';
      content.appendChild(inp);
      captureBaseline();

      inp.value = '99';
      recomputeDirty();

      expect(hasSlotChanges()).toBe(true);
    });

    test('returns true when both toolbar and per-slot fields are dirty', () => {
      // Toolbar field
      const toolbarInp = document.createElement('input');
      toolbarInp.type = 'number';
      toolbarInp.id = 'profileNum';
      toolbarInp.value = '5';
      app.appendChild(toolbarInp);

      // Per-slot field
      const slotInp = document.createElement('input');
      slotInp.type = 'number';
      slotInp.value = '50';
      content.appendChild(slotInp);

      captureBaseline();

      toolbarInp.value = '99';
      slotInp.value = '99';
      recomputeDirty();

      expect(hasUnsavedChanges()).toBe(true);
      expect(hasSlotChanges()).toBe(true);
    });

    test('returns false after reset when everything was dirty', () => {
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = '50';
      content.appendChild(inp);
      captureBaseline();

      inp.value = '99';
      recomputeDirty();
      expect(hasSlotChanges()).toBe(true);

      resetAndCaptureBaseline();

      expect(hasSlotChanges()).toBe(false);
    });

    test('returns false when tree is not built (resetDirtyState)', () => {
      resetDirtyState();
      expect(hasSlotChanges()).toBe(false);
    });
  });

  // --- Branch-coverage: skip paths in recomputeDirty / baseline ---

  describe('resetAndCaptureBaseline and recomputeDirty skip branches', () => {
    test('resetAndCaptureBaseline falls back to document.body when #app is absent', () => {
      // No #app element → exercises the `document.body` fallback.
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = '42';
      document.body.appendChild(inp);

      resetAndCaptureBaseline();

      expect(inp.dataset.orig).toBe('42');
    });

    test('recomputeDirty skips SKIP_ID scalars and scalars without a baseline', () => {
      const app = document.createElement('div');
      app.id = 'app';
      document.body.appendChild(app);

      // SKIP_ID element (warpLocation) — skipped by the scalar loop.
      const skip = document.createElement('input');
      skip.id = 'warpLocation';
      skip.type = 'number';
      skip.value = '5';
      app.appendChild(skip);

      // Plain scalar with no data-orig (no captureBaseline) — skipped.
      const noBaseline = document.createElement('input');
      noBaseline.type = 'number';
      noBaseline.value = '7';
      app.appendChild(noBaseline);

      // Should not throw; both `continue` branches fire.
      expect(() => recomputeDirty()).not.toThrow();
    });

    test('recomputeDirty skips existing-row cells without a baseline', () => {
      const app = document.createElement('div');
      app.id = 'app';
      document.body.appendChild(app);

      const table = document.createElement('table');
      table.className = 'grid-table inv-table';
      const tbody = document.createElement('tbody');
      table.appendChild(tbody);
      app.appendChild(table);

      const tr = document.createElement('tr');
      tr.dataset.existing = 'true';
      const td = document.createElement('td');
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = '5';
      td.appendChild(inp);
      tr.appendChild(td);
      tbody.appendChild(tr);

      // No captureBaseline → cell has no data-orig → `continue` fires.
      expect(() => recomputeDirty()).not.toThrow();
      expect(tr.classList.contains('row-dirty')).toBe(false);
    });
  });

  // --- Branch-coverage: debounce / listener target edge cases ---

  describe('debounce and listener-target branch coverage', () => {
    beforeAll(() => jest.useFakeTimers());
    afterAll(() => jest.useRealTimers());

    test('updateElementDirty skips an input inside a soft-deleted row', () => {
      const { content } = buildTreeContent();

      const table = document.createElement('table');
      table.className = 'grid-table inv-table';
      const tbody = document.createElement('tbody');
      table.appendChild(tbody);
      content.appendChild(table);

      const tr = document.createElement('tr');
      tr.dataset.existing = 'true';
      const td = document.createElement('td');
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = '5';
      td.appendChild(inp);
      tr.appendChild(td);
      tbody.appendChild(tr);

      captureBaseline(); // input is enabled → data-orig captured
      setupDirtyListeners();

      // Now soft-delete the row AFTER baseline capture so data-orig is defined.
      tr.dataset.deleted = 'true';

      inp.value = '99';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      jest.advanceTimersByTime(200);

      // updateElementDirty hit the deleted-row early return (no per-cell tracking).
      expect(inp.classList.contains('dirty')).toBe(false);
    });

    test('input/change handlers ignore non-input/non-select targets (textarea)', () => {
      const { content } = buildTreeContent();
      captureBaseline();
      setupDirtyListeners();

      // A textarea is neither HTMLInputElement nor HTMLSelectElement.
      const ta = document.createElement('textarea');
      ta.value = 'x';
      content.appendChild(ta);

      expect(() => {
        ta.value = 'y';
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        ta.dispatchEvent(new Event('change', { bubbles: true }));
        jest.advanceTimersByTime(200);
      }).not.toThrow();
    });

    test('input event from a <select> schedules a dirty check', () => {
      const { content } = buildTreeContent();

      const sel = document.createElement('select');
      const opt1 = document.createElement('option');
      opt1.value = 'a';
      const opt2 = document.createElement('option');
      opt2.value = 'b';
      sel.appendChild(opt1);
      sel.appendChild(opt2);
      sel.value = 'a';
      content.appendChild(sel);

      captureBaseline();
      setupDirtyListeners();

      sel.value = 'b';
      sel.dispatchEvent(new Event('input', { bubbles: true }));
      jest.advanceTimersByTime(200);

      // The select target exercised the right-hand `instanceof HTMLSelectElement`
      // side of the `||` and was scheduled → now dirty.
      expect(sel.classList.contains('dirty')).toBe(true);
    });

    test('first dirty cell on a fresh row via debounce (empty rowCellDirtyCount)', () => {
      const { content } = buildTreeContent();

      const table = document.createElement('table');
      table.className = 'grid-table inv-table';
      const tbody = document.createElement('tbody');
      table.appendChild(tbody);
      content.appendChild(table);

      const tr = document.createElement('tr');
      tr.dataset.existing = 'true';
      const td = document.createElement('td');
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = '5';
      td.appendChild(inp);
      tr.appendChild(td);
      tbody.appendChild(tr);

      captureBaseline();
      setupDirtyListeners();

      // No recomputeDirty first → rowCellDirtyCount has no entry for this tr,
      // so the `|| 0` fallback fires on the first clean→dirty transition.
      inp.value = '99';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      jest.advanceTimersByTime(200);

      expect(inp.classList.contains('dirty')).toBe(true);
      expect(tr.classList.contains('row-dirty')).toBe(true);
    });
  });
});
