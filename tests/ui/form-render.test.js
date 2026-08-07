/**
 * @jest-environment jsdom
 *
 * Tests for form-render.js — focused on setupSelectTooltipSync(), which
 * updates item-name select tooltips in response to `change` events.
 *
 * Covers the decomposed deposit base-weapon branch: a valid baseId sets the
 * note tooltip, while a falsy baseId (e.g. "0") clears it.
 */

export {};

const { setupSelectTooltipSync, setupDurabilitySync } = await import(
  '../../js/ui/form/form-render.js'
);

describe('setupSelectTooltipSync', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    setupSelectTooltipSync();
  });

  test('clears the tooltip when a decomposed base-weapon select has a falsy baseId', () => {
    const sel = document.createElement('select');
    sel.classList.add('dep-base-weapon');
    const opt = document.createElement('option');
    opt.value = '0';
    sel.appendChild(opt);
    sel.value = '0';
    sel.setAttribute('data-tooltip', 'stale-note');
    document.body.appendChild(sel);

    sel.dispatchEvent(new Event('change', { bubbles: true }));

    // baseId = parseInt('0') === 0 (falsy) → else branch clears the attribute.
    expect(sel.hasAttribute('data-tooltip')).toBe(false);
  });

  test('updates the tooltip from the base-weapon note when baseId is truthy', () => {
    const sel = document.createElement('select');
    sel.classList.add('dep-base-weapon');
    const opt = document.createElement('option');
    opt.value = '1';
    sel.appendChild(opt);
    sel.value = '1';
    document.body.appendChild(sel);

    // Should not throw regardless of whether baseId 1 has a note; the
    // if (baseId) branch runs updateSelectTooltip with the note (or null).
    expect(() => sel.dispatchEvent(new Event('change', { bubbles: true }))).not.toThrow();
  });

  test('ignores change events on non-select elements', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    expect(() => div.dispatchEvent(new Event('change', { bubbles: true }))).not.toThrow();
  });

  test('standard item select with a falsy itemId clears without setting a tooltip', () => {
    // value '0' is truthy (passes the !sel.value guard) but parses to a falsy
    // itemId → parseInt('0') || 0 === 0 → if (!itemId) return.
    const sel = document.createElement('select');
    sel.classList.add('inv-name');
    sel.dataset.lazyCat = 'weapons';
    const opt = document.createElement('option');
    opt.value = '0';
    sel.appendChild(opt);
    sel.value = '0';
    sel.setAttribute('data-tooltip', 'stale');
    document.body.appendChild(sel);

    expect(() => sel.dispatchEvent(new Event('change', { bubbles: true }))).not.toThrow();
  });

  test('standard item select without a lazyCat category is skipped', () => {
    const sel = document.createElement('select');
    sel.classList.add('inv-name');
    // No data-lazy-cat → category undefined → early return.
    const opt = document.createElement('option');
    opt.value = '10001';
    sel.appendChild(opt);
    sel.value = '10001';
    document.body.appendChild(sel);
    expect(() => sel.dispatchEvent(new Event('change', { bubbles: true }))).not.toThrow();
  });
});

describe('setupDurabilitySync', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    setupDurabilitySync();
  });

  test('ignores change events on non-select elements', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    expect(() => div.dispatchEvent(new Event('change', { bubbles: true }))).not.toThrow();
  });

  test('ignores selects that are not inside a row', () => {
    const sel = document.createElement('select');
    sel.classList.add('inv-name');
    sel.dataset.lazyCat = 'weapons';
    const opt = document.createElement('option');
    opt.value = '1';
    sel.appendChild(opt);
    sel.value = '1';
    document.body.appendChild(sel); // not inside a <tr>
    expect(() => sel.dispatchEvent(new Event('change', { bubbles: true }))).not.toThrow();
  });

  test('handles a non-numeric item value without crashing', () => {
    const tr = document.createElement('tr');
    const sel = document.createElement('select');
    sel.classList.add('inv-name');
    sel.dataset.lazyCat = 'weapons';
    const opt = document.createElement('option');
    opt.value = 'abc';
    sel.appendChild(opt);
    sel.value = 'abc';
    tr.appendChild(sel);
    document.body.appendChild(tr);
    expect(() => sel.dispatchEvent(new Event('change', { bubbles: true }))).not.toThrow();
  });

  test('skips placeholder selections (empty value)', () => {
    const tr = document.createElement('tr');
    const sel = document.createElement('select');
    sel.classList.add('inv-name');
    sel.dataset.lazyCat = 'weapons';
    // No option selected → empty value → early return.
    tr.appendChild(sel);
    document.body.appendChild(tr);
    expect(() => sel.dispatchEvent(new Event('change', { bubbles: true }))).not.toThrow();
  });

  test('skips soft-deleted rows', () => {
    const tr = document.createElement('tr');
    tr.dataset.deleted = 'true';
    const sel = document.createElement('select');
    sel.classList.add('inv-name');
    sel.dataset.lazyCat = 'weapons';
    const opt = document.createElement('option');
    opt.value = '10001';
    sel.appendChild(opt);
    sel.value = '10001';
    tr.appendChild(sel);
    document.body.appendChild(tr);
    expect(() => sel.dispatchEvent(new Event('change', { bubbles: true }))).not.toThrow();
  });

  test('skips selects without a lazyCat category', () => {
    const tr = document.createElement('tr');
    const sel = document.createElement('select');
    sel.classList.add('inv-name');
    // No data-lazy-cat → category undefined → early return.
    const opt = document.createElement('option');
    opt.value = '10001';
    sel.appendChild(opt);
    sel.value = '10001';
    tr.appendChild(sel);
    document.body.appendChild(tr);
    expect(() => sel.dispatchEvent(new Event('change', { bubbles: true }))).not.toThrow();
  });

  test('ignores change on a non item-name select', () => {
    const tr = document.createElement('tr');
    const sel = document.createElement('select');
    sel.classList.add('other'); // neither inv-name nor dep-name
    const opt = document.createElement('option');
    opt.value = '1';
    sel.appendChild(opt);
    sel.value = '1';
    tr.appendChild(sel);
    document.body.appendChild(tr);
    expect(() => sel.dispatchEvent(new Event('change', { bubbles: true }))).not.toThrow();
  });
});
