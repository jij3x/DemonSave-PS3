/**
 * @jest-environment jsdom
 *
 * Tests for the programmatic DOM construction module (dom.js).
 *
 * Covers: el() helper (all attribute types), icon() helper, and
 * buildPage() structural output.
 *
 * Uses the real des-db (not mocked) so that controls.js type/width
 * lookups work correctly.
 */

import { jest } from '@jest/globals';

const { el, icon, buildPage } = await import('../../js/ui/dom.js');
const { APP_VERSION } = await import('../../js/version.js');

// --- el() helper ---
describe('el()', () => {
  test('creates a simple element with tag name', () => {
    const div = el('div', {});
    expect(div.tagName).toBe('DIV');
  });

  test('sets className via "className" attribute', () => {
    const div = el('div', { className: 'my-class' });
    expect(div.className).toBe('my-class');
  });

  test('sets textContent via "textContent" attribute', () => {
    const span = el('span', { textContent: 'Hello World' });
    expect(span.textContent).toBe('Hello World');
  });

  test('sets hidden property via "hidden" attribute', () => {
    const div = el('div', { hidden: true });
    expect(div.hidden).toBe(true);

    const visible = el('div', { hidden: false });
    expect(visible.hidden).toBe(false);
  });

  test('sets dataset properties via "dataset" attribute', () => {
    const div = el('div', { dataset: { category: 'weapons', ref: 'inv:0' } });
    expect(div.dataset.category).toBe('weapons');
    expect(div.dataset.ref).toBe('inv:0');
  });

  test('sets regular attributes via setAttribute', () => {
    const input = el('input', { type: 'number', min: '0', max: '99', value: '50' });
    expect(input.getAttribute('type')).toBe('number');
    expect(input.getAttribute('min')).toBe('0');
    expect(input.getAttribute('max')).toBe('99');
    expect(input.getAttribute('value')).toBe('50');
  });

  test('attaches event listeners via "on*" attributes', () => {
    const handler = jest.fn();
    const btn = el('button', { onclick: handler });
    btn.click();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('appends string children as text nodes', () => {
    const p = el('p', {}, 'Hello', ' ', 'World');
    expect(p.textContent).toBe('Hello World');
  });

  test('appends element children', () => {
    const child = el('span', { textContent: 'child' });
    const div = el('div', {}, child);
    expect(div.children[0]).toBe(child);
  });

  test('skips null and undefined children', () => {
    const div = el('div', {}, null, undefined, 'text', null);
    expect(div.textContent).toBe('text');
    expect(div.childNodes.length).toBe(1);
  });

  test('sets innerHTML via _trustedSVG (valid SVG)', () => {
    const span = el('span', {
      _trustedSVG: '<svg viewBox="0 0 24 24"><path d="M0 0"/></svg>',
    });
    expect(span.innerHTML).toContain('<svg');
    expect(span.innerHTML).toContain('<path');
  });

  test('throws when _trustedSVG does not start with <svg', () => {
    expect(() => el('span', { _trustedSVG: '<div>not svg</div>' })).toThrow(
      '_trustedSVG content must start with <svg',
    );
  });

  test('throws when _trustedSVG is empty string', () => {
    expect(() => el('span', { _trustedSVG: '' })).toThrow();
  });

  test('handles empty attrs (null/undefined)', () => {
    const div1 = el('div', /** @type {Record<string, any>} */ (/** @type {unknown} */ (null)));
    const div2 = el('div', undefined);
    expect(div1.tagName).toBe('DIV');
    expect(div2.tagName).toBe('DIV');
  });

  test('handles no children', () => {
    const div = el('div', {});
    expect(div.children.length).toBe(0);
  });
});

// --- icon() helper ---
describe('icon()', () => {
  test('returns a span with icon class for valid icon name', () => {
    const result = /** @type {HTMLSpanElement} */ (icon('folderOpen'));
    expect(result).not.toBeNull();
    expect(result.className).toBe('icon');
  });

  test('contains inline SVG markup', () => {
    const result = /** @type {HTMLSpanElement} */ (icon('save'));
    expect(result.innerHTML).toContain('<svg');
  });

  test('returns null for unknown icon name', () => {
    const result = icon('nonExistentIcon');
    expect(result).toBeNull();
  });

  test('all defined icons produce valid SVG spans', () => {
    const names = [
      'folderOpen',
      'save',
      'download',
      'lock',
      'unlock',
      'plus',
      'trash',
      'close',
      'restore',
    ];
    for (const name of names) {
      const result = /** @type {HTMLSpanElement} */ (icon(name));
      expect(result).not.toBeNull();
      expect(result.className).toBe('icon');
      expect(result.innerHTML).toContain('<svg');
    }
  });
});

// --- buildPage() ---
describe('buildPage()', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  test('returns early when #app element does not exist', () => {
    // No #app element
    document.body.innerHTML = '';
    expect(() => buildPage()).not.toThrow();
  });

  test('creates the full editor DOM inside #app', () => {
    const app = document.createElement('div');
    app.id = 'app';
    document.body.appendChild(app);

    buildPage();

    // Header
    expect(/** @type {HTMLElement} */ (app.querySelector('header h1')).textContent).toContain(
      'DemonSave',
    );
    expect(/** @type {HTMLElement} */ (app.querySelector('header .app-version')).textContent).toBe(
      `v${APP_VERSION}`,
    );

    // Status element
    expect(app.querySelector('#status')).not.toBeNull();

    // Toolbar buttons
    expect(app.querySelector('#btnOpen')).not.toBeNull();
    expect(app.querySelector('#btnSave')).not.toBeNull();
    expect(app.querySelector('#btnExport')).not.toBeNull();
    expect(app.querySelector('#btnClose')).not.toBeNull();
    expect(app.querySelector('#btnToggleEncrypt')).not.toBeNull();

    // Slot selector
    expect(app.querySelector('#saveSlot')).not.toBeNull();
    expect(app.querySelector('#slotSection')).not.toBeNull();

    // Profile number and account ID
    expect(app.querySelector('#profileNum')).not.toBeNull();
    expect(app.querySelector('#accountId')).not.toBeNull();

    // Content area
    expect(app.querySelector('#contentArea')).not.toBeNull();
    expect(app.querySelector('#charPanel')).not.toBeNull();
    expect(app.querySelector('#editor')).not.toBeNull();

    // Character tab fields
    expect(app.querySelector('#name')).not.toBeNull();
    expect(app.querySelector('#gender')).not.toBeNull();
    expect(app.querySelector('#startClass')).not.toBeNull();
    expect(app.querySelector('#phantomType')).not.toBeNull();
    expect(app.querySelector('#clearCount')).not.toBeNull();

    // Vital/stat fields
    expect(app.querySelector('#currHP')).not.toBeNull();
    expect(app.querySelector('#vit')).not.toBeNull();
    expect(app.querySelector('#souls')).not.toBeNull();

    // Equipment spans
    expect(app.querySelector('#leftHand1')).not.toBeNull();
    expect(app.querySelector('#helmet')).not.toBeNull();
    expect(app.querySelector('#ring1')).not.toBeNull();

    // Inventory sub-tabs (weapon types)
    const weaponTabs = app.querySelectorAll('table.inv-table[data-category="weapons"]');
    expect(weaponTabs.length).toBeGreaterThan(0);

    // Deposit sub-tabs
    const depTables = app.querySelectorAll('table.dep-table[data-category="weapons"]');
    expect(depTables.length).toBeGreaterThan(0);

    // Spells table
    expect(app.querySelector('#spellsTableBody')).not.toBeNull();

    // Landing page
    expect(app.querySelector('#landingPage')).not.toBeNull();

    // Drop overlay
    expect(app.querySelector('#dropOverlay')).not.toBeNull();
  });

  test('clears #app innerHTML before building', () => {
    const app = document.createElement('div');
    app.id = 'app';
    const existing = document.createElement('div');
    existing.id = 'existing-content';
    app.appendChild(existing);
    document.body.appendChild(app);

    buildPage();

    expect(app.querySelector('#existing-content')).toBeNull();
  });

  test('sets up warp tab fields', () => {
    const app = document.createElement('div');
    app.id = 'app';
    document.body.appendChild(app);

    buildPage();

    expect(app.querySelector('#warpLocation')).not.toBeNull();
    expect(app.querySelector('#world')).not.toBeNull();
    expect(app.querySelector('#xpos')).not.toBeNull();
    expect(app.querySelector('#rot')).not.toBeNull();
    expect(app.querySelector('#worldName')).not.toBeNull();
  });

  test('sets up world tendency fields', () => {
    const app = document.createElement('div');
    app.id = 'app';
    document.body.appendChild(app);

    buildPage();

    expect(app.querySelector('#charTendency')).not.toBeNull();
    expect(app.querySelector('#w1Tendency')).not.toBeNull();
    expect(app.querySelector('#w5Tendency')).not.toBeNull();
  });

  test('sets up NPC state selects', () => {
    const app = document.createElement('div');
    app.id = 'app';
    document.body.appendChild(app);

    buildPage();

    expect(app.querySelector('#sageFreke')).not.toBeNull();
    expect(app.querySelector('#thomas')).not.toBeNull();
    expect(app.querySelector('#boldwin')).not.toBeNull();
  });

  test('sets up hair color fields', () => {
    const app = document.createElement('div');
    app.id = 'app';
    document.body.appendChild(app);

    buildPage();

    expect(app.querySelector('#hairstyle')).not.toBeNull();
    expect(app.querySelector('#hairR')).not.toBeNull();
    expect(app.querySelector('#hairG')).not.toBeNull();
    expect(app.querySelector('#hairB')).not.toBeNull();
    expect(app.querySelector('#hairColorSample')).not.toBeNull();
  });

  test('creates add buttons for inventory and deposit tabs', () => {
    const app = document.createElement('div');
    app.id = 'app';
    document.body.appendChild(app);

    buildPage();

    const invAddBtns = app.querySelectorAll('button.inv-add');
    expect(invAddBtns.length).toBeGreaterThan(0);

    const depAddBtns = app.querySelectorAll('button.dep-add');
    expect(depAddBtns.length).toBeGreaterThan(0);

    // Spell add button
    expect(app.querySelector('#addSpell')).not.toBeNull();
  });

  test('landing page has drag-and-drop dropzone', () => {
    const app = document.createElement('div');
    app.id = 'app';
    document.body.appendChild(app);

    buildPage();

    const dropzone = /** @type {HTMLElement} */ (app.querySelector('.landing-dropzone'));
    expect(dropzone).not.toBeNull();
    expect(/** @type {HTMLElement} */ (dropzone.querySelector('h2')).textContent).toContain(
      'Drag and drop',
    );
  });
});
