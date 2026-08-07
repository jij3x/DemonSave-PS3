/**
 * Programmatic DOM construction — builds the entire editor page
 * so index.html can remain a minimal bootstrap shell.
 */

/**
 * Create a DOM element with attributes and children.
 *
 * Supported special attribute keys:
 *   - `className`    → e.className
 *   - `textContent`  → e.textContent
 *   - `_trustedSVG`  → e.innerHTML (validated to start with `<svg`; XSS guard)
 *   - `hidden`       → e.hidden
 *   - `dataset`      → Object.assign(e.dataset, …)
 *   - `on<event>`    → e.addEventListener(event, value)
 *   - anything else  → e.setAttribute(key, value)
 *
 * String children become text nodes; null/undefined children are skipped.
 *
 * @param {string} tag      HTML tag name
 * @param {Record<string, any>} [attrs]  attribute object
 * @param {...(Node|string|null|undefined)} children
 * @returns {HTMLElement}
 */
function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (k === 'className') e.className = v;
    else if (k === 'textContent') e.textContent = v;
    else if (k === '_trustedSVG') {
      if (typeof v === 'string' && !v.trimStart().startsWith('<svg')) {
        throw new Error('_trustedSVG content must start with <svg>');
      }
      e.innerHTML = v;
    } else if (k === 'hidden') e.hidden = v;
    else if (k === 'dataset') Object.assign(e.dataset, v);
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  for (const c of children) {
    if (c == null) continue;
    if (typeof c === 'string') e.appendChild(document.createTextNode(c));
    else e.appendChild(c);
  }
  return e;
}

/* --- SVG line-art icons (monochrome, stroke = currentColor) --- */
const ICONS = {
  folderOpen:
    '<path d="M3 7v10a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H12L10 6H4a1 1 0 0 0-1 1z"/>',
  save: '<path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M8 3v5h7V3"/><path d="M8 14h8v6H8z"/>',
  download: '<path d="M12 3v12"/><path d="M7 11l5 4 5-4"/><path d="M5 19h14"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="1"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  unlock: '<rect x="5" y="11" width="14" height="9" rx="1"/><path d="M8 11V8a4 4 0 0 1 7-3"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  trash:
    '<path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M5 7l1 13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-13"/><path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/>',
  close: '<path d="M6 6l12 12"/><path d="M18 6L6 18"/>',
  restore: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v4h4"/>',
};

/**
 * Create an inline SVG icon span.
 * @param {string} name  key into ICONS
 * @returns {HTMLSpanElement|null}
 */
function icon(name) {
  const inner = ICONS[name];
  if (!inner) return null;
  return el('span', {
    className: 'icon',
    _trustedSVG:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      inner +
      '</svg>',
  });
}

import {
  getWeaponTypes,
  getGoodsTypes,
  isCountVisible,
  isDurabilityVisible,
  SELECT_WIDTHS,
} from './core/controls.js';
import { selectWidthKey } from './core/item-helpers.js';

export { icon, el };

/**
 * Resolve the pixel width for a category/type/deposit combination using the
 * shared `selectWidthKey()` helper from item-helpers.js.
 *
 * @param {string} category
 * @param {number|null} typeId
 * @param {boolean} isDeposit
 * @returns {number} pixel width
 */
function selectWidthFor(category, typeId, isDeposit = false) {
  const key = selectWidthKey(category, typeId, isDeposit);
  return SELECT_WIDTHS[key] || 180;
}

/* Min-widths for non-select columns (td padding 6px each side + input/button width). */
const COL_MIN_WIDTH_INPUT = 72; /* 60px input + 12px padding */
const COL_MIN_WIDTH_DELETE = 40; /* 28px button + 12px padding */

/**
 * Create a `<fieldset>` with a `<legend>` label.
 * @param {string|{text: string, tooltip?: string}} legendText  legend label, or an
 *   object with `text` and an optional `tooltip` (shown on hover via the unified
 *   tooltip system)
 * @param {...Node} children
 * @returns {HTMLFieldSetElement}
 */
function fieldset(legendText, ...children) {
  const isObj = typeof legendText === 'object' && legendText !== null;
  const text = isObj ? legendText.text : legendText;
  const legendAttrs = { textContent: text };
  if (isObj && legendText.tooltip) legendAttrs['data-tooltip'] = legendText.tooltip;
  return /** @type {HTMLFieldSetElement} */ (
    el('fieldset', {}, el('legend', legendAttrs), ...children)
  );
}

/**
 * Create a `<label>` wrapping a text label and an input/select element.
 *
 * @param {string} id          id for the label element (or '' to skip)
 * @param {string} labelText   text shown before the child element
 * @param {Node} child         the input/select/etc. element
 * @param {Object} [opts]      { hidden, 'data-tooltip' }
 * @returns {HTMLLabelElement}
 */
function label(id, labelText, child, opts = {}) {
  const attrs = {};
  if (id) attrs.id = id;
  if (opts.hidden) attrs.hidden = true;
  // Pass data-tooltip through so the unified tooltip system picks it up.
  if (opts['data-tooltip']) attrs['data-tooltip'] = opts['data-tooltip'];
  return /** @type {HTMLLabelElement} */ (el('label', attrs, labelText, child));
}

/**
 * Create a `<input type="number">` element.
 * @param {string} id
 * @param {Record<string, any>} [extraAttrs]  additional attributes merged in
 * @returns {HTMLInputElement}
 */
function numInput(id, extraAttrs = {}) {
  return /** @type {HTMLInputElement} */ (el('input', { id, type: 'number', ...extraAttrs }));
}

/**
 * Create a `<select>` element populated with `<option>` children.
 *
 * @param {string} id
 * @param {string|null} className  CSS class (or null for none)
 * @param {Array<[string, string]>|null} options  [value, text] pairs, or null for empty
 * @param {Record<string, any>} [extraAttrs]  additional attributes
 * @returns {HTMLSelectElement}
 */
function selectInput(id, className, options, extraAttrs = {}) {
  const s = /** @type {HTMLSelectElement} */ (
    el('select', { id, ...(className ? { className } : {}), ...extraAttrs })
  );
  if (options) {
    for (const [val, text] of options) {
      s.appendChild(el('option', { value: String(val) }, text));
    }
  }
  return s;
}

/**
 * Create a `<label class="checkbox">` wrapping a checkbox input and text.
 * @param {string} id
 * @param {string} labelText
 * @param {Object} [opts]  { 'data-tooltip' }
 * @returns {HTMLLabelElement}
 */
function checkboxInput(id, labelText, opts = {}) {
  const attrs = { className: 'checkbox' };
  if (opts['data-tooltip']) attrs['data-tooltip'] = opts['data-tooltip'];
  return /** @type {HTMLLabelElement} */ (
    el('label', attrs, el('input', { id, type: 'checkbox' }), labelText)
  );
}

/**
 * Create a WAI-ARIA tab button with roving tabindex and a dirty-dot span.
 *
 * @param {string} dataTab  value for the `data-tab` attribute
 * @param {string} text     visible tab label
 * @param {boolean} [active=false]  whether this tab is active by default
 * @returns {HTMLButtonElement}
 */
function tabButton(dataTab, text, active = false) {
  return /** @type {HTMLButtonElement} */ (
    el(
      'button',
      {
        type: 'button',
        role: 'tab',
        className: 'tab' + (active ? ' active' : ''),
        'data-tab': dataTab,
        'aria-selected': String(active),
        'aria-controls': `tabpanel-${dataTab}`,
        id: `tab-${dataTab}`,
        tabindex: active ? '0' : '-1',
      },
      text,
      el('span', { className: 'dirty-dot' }),
    )
  );
}

/**
 * Create a WAI-ARIA tabpanel `<div>` for tab content.
 *
 * @param {string} dataTab  value for the `data-tab` attribute
 * @param {boolean} [hidden=false]  whether the panel starts hidden
 * @param {...Node} children  content elements
 * @returns {HTMLDivElement}
 */
function tabContent(dataTab, hidden = false, ...children) {
  return /** @type {HTMLDivElement} */ (
    el(
      'div',
      {
        className: 'tab-content',
        role: 'tabpanel',
        'data-tab': dataTab,
        id: `tabpanel-${dataTab}`,
        'aria-labelledby': `tab-${dataTab}`,
        hidden,
      },
      ...children,
    )
  );
}

/**
 * Shared warning text for the Inventory tab — displayed right-aligned on
 * the same row as the Add button, truncated, with the full message
 * available via tooltip on hover.
 */
const INVENTORY_WARNING =
  '* Editing items directly in the Inventory tab is risky and can corrupt ' +
  'your save. These edits bypass the game\u2019s validation, so a single ' +
  'change can break weight limits, duplicate a unique item, misassign a ' +
  'category, set an invalid field value, or desync a hotbar slot \u2014 any ' +
  'of which may destabilize the game. Treat this tab as a sandbox, not a ' +
  'reliable workflow. To add items safely, use Thomas\u2019s Storage ' +
  'instead: its dropdowns only offer valid choices, and the native deposit ' +
  'path keeps the save consistent.';

/**
 * Build the flat inventory sub-tab group.
 *
 * Weapon types (Weapon=1, Shield=2, Bow=3, Ammo=4, Casting Tool=6) are
 * laid as peers alongside Armor, Rings, and Goods — no parent "Weapons"
 * tab.  Each tab has its own header+body table pair.
 */
function invSubTabs(addBtnClass) {
  const tabsDiv = el('div', { className: 'tabs' });
  const contents = [];

  // Column headers for weapons are type-dependent (Count shown for Ammo,
  // DUR hidden for Ammo).  Build 4 variants to cover all combinations.
  const weaponDurTooltip = {
    text: 'DUR',
    tooltip:
      'Durability — current condition of the weapon. Stored in a parallel table indexed by the item\u2019s Dur Idx (hidden).',
  };
  const weaponClassTooltip = {
    text: 'Class',
    tooltip:
      'Weapon category for inventory sorting (hi-byte of sort ID). Groups weapons by type (e.g. 0x0f=curved swords, 0x10=straight swords, 0x36=bows, 0x3f=shields). When adding an item, copy this from an existing weapon of the same type.',
  };
  const weaponClassIdxTooltip = {
    text: 'Class Idx',
    tooltip:
      'Item-within-class ordering (lo-byte of sort ID). Controls the display order of weapons within the same category.',
  };

  // Weapon-type tabs (Weapon, Shield, Bow, Ammo, Casting Tool)
  const types = getWeaponTypes();
  for (let i = 0; i < types.length; i++) {
    const { typeId, name } = types[i];
    const tabName = 'weapon-' + typeId;
    const showCount = isCountVisible('weapons', typeId);
    const showDur = isDurabilityVisible('weapons', typeId);
    // Build column headers dynamically: [Count?] Class, Class Idx, [DUR?], ''
    const weaponColumns = [];
    if (showCount) weaponColumns.push('Count');
    weaponColumns.push(weaponClassTooltip, weaponClassIdxTooltip);
    if (showDur) weaponColumns.push(weaponDurTooltip);
    weaponColumns.push('');
    tabsDiv.appendChild(tabButton(tabName, name, i === 0));
    contents.push(
      invCategoryTab('weapons', 'inv', true, name, weaponColumns, {
        tabName,
        weaponType: typeId,
        noCount: !showCount,
      }),
    );
  }

  // Goods-type tabs (Ore, Consumables, Souls, Key Items) — always show count,
  // never show durability (goods don't have durability).
  const goodsTypes = getGoodsTypes();
  const goodsColumnHeaders = [
    'Count',
    {
      text: 'Item Type',
      tooltip:
        'Goods family/tier for inventory grouping. Items sharing this value are the same type and appear adjacent in-game (e.g. 0x01=basic grass/hardstone, 0x65\u20130x6A=soldier/hero souls, 0xC9\u20130xD3=demon\u2019s souls).',
    },
    '',
  ];
  for (const { typeId, name } of goodsTypes) {
    const tabName = 'goods-' + typeId;
    tabsDiv.appendChild(tabButton(tabName, name));
    contents.push(
      invCategoryTab('goods', 'inv', true, name, goodsColumnHeaders, {
        tabName,
        goodsType: typeId,
      }),
    );
  }

  // Armor, Rings tabs (no count column)
  tabsDiv.appendChild(tabButton('armor', 'Armor'));
  tabsDiv.appendChild(tabButton('rings', 'Ring'));

  contents.push(
    invCategoryTab(
      'armor',
      'inv',
      true,
      'Armor',
      [
        {
          text: 'Slot',
          tooltip:
            'Armor slot type for inventory sorting (hi-byte of sort ID). Determines which body slot the armor sorts under: 0\u2013999=head, 1000\u20131999=chest, 2000\u20132999=gauntlets, 3000\u20133999=leggings.',
        },
        {
          text: 'Slot Idx',
          tooltip:
            'Item-within-slot ordering (lo-byte of sort ID). Controls display order of armor within the same body slot.',
        },
        {
          text: 'DUR',
          tooltip:
            'Durability — current condition of the armor. Stored in a parallel table indexed by the item\u2019s Dur Idx (hidden).',
        },
        '',
      ],
      { tabName: 'armor', noCount: true },
    ),
  );
  contents.push(
    invCategoryTab(
      'rings',
      'inv',
      true,
      'Ring',
      [
        {
          text: 'Ring Slot',
          tooltip:
            'Ring sort index for inventory ordering. Sequential ring number (e.g. Ring of Great Strength=0x01, Cling Ring=0x13, Thief\u2019s Ring=0x16).',
        },
        '',
      ],
      { tabName: 'rings', noCount: true },
    ),
  );

  const tabGroup = el('div', { className: 'tab-group' }, tabsDiv, ...contents);

  // Add buttons — one per tab, shown/hidden based on active sub-tab.
  const actionsDiv = el('div', { className: 'sub-tab-actions' });
  // Weapon-type add buttons (first one visible by default — matches active tab)
  for (let i = 0; i < types.length; i++) {
    const { typeId, name } = types[i];
    const tabName = 'weapon-' + typeId;
    actionsDiv.appendChild(
      el(
        'button',
        {
          type: 'button',
          className: 'row-add ' + addBtnClass,
          'data-tab': tabName,
          'data-category': 'weapons',
          'data-weapon-type': String(typeId),
          hidden: i !== 0,
        },
        `Add ${name}`,
      ),
    );
  }
  // Goods-type add buttons
  for (const { typeId, name } of goodsTypes) {
    const tabName = 'goods-' + typeId;
    actionsDiv.appendChild(
      el(
        'button',
        {
          type: 'button',
          className: 'row-add ' + addBtnClass,
          'data-tab': tabName,
          'data-category': 'goods',
          'data-goods-type': String(typeId),
          hidden: true,
        },
        `Add ${name}`,
      ),
    );
  }
  // Armor, Rings add buttons
  for (const [tab, label] of [
    ['armor', 'Armor'],
    ['rings', 'Ring'],
  ]) {
    actionsDiv.appendChild(
      el(
        'button',
        {
          type: 'button',
          className: 'row-add ' + addBtnClass,
          'data-tab': tab,
          'data-category': tab,
          hidden: true,
        },
        `Add ${label}`,
      ),
    );
  }

  // Warning — right-aligned on the same line as the Add button, truncated;
  // full text shown in tooltip on hover.
  actionsDiv.appendChild(
    el('span', {
      className: 'inv-warning',
      textContent: INVENTORY_WARNING,
      'data-tooltip': INVENTORY_WARNING,
      'data-tooltip-if-truncated': 'true',
    }),
  );

  return el('div', { className: 'sub-tab-container' }, tabGroup, actionsDiv);
}

/**
 * Build the flat deposit sub-tab group.
 *
 * Mirrors invSubTabs() — 11 flat tabs (Weapon=1, Shield=2, Bow=3, Ammo=4,
 * Casting Tool=6, Ore=9, Consum.=10, Soul=11, Key Item=12, Armor, Ring).
 * Each tab has its own header+body table pair with dep-table class.
 */
function depSubTabs() {
  const tabsDiv = el('div', { className: 'tabs' });
  const contents = [];

  // Standard columns for non-decomposable types with count but no durability (Ammo, Goods)
  const columnHeadersWithCount = ['Count', ''];
  // Standard columns for non-decomposable types without count (Casting Tool, Armor — have durability)
  const columnHeadersNoCount = ['DUR', ''];
  // Rings: no count, no durability
  const columnHeadersNoCountNoDur = [''];

  // Extended columns for Weapon (1), Shield (2), Bow (3) — no count column
  // (decomposed weapon types are always count=1).
  const weaponColumnHeadersNoCount = ['Path', 'Level', 'DUR', ''];
  // Extended columns for Ammo (4) — non-decomposed, has count.
  // (Uses the standard columnHeadersWithCount above.)

  // Weapon-type tabs (Weapon, Shield, Bow, Ammo, Casting Tool)
  const types = getWeaponTypes();
  for (let i = 0; i < types.length; i++) {
    const { typeId, name } = types[i];
    const tabName = 'weapon-' + typeId;
    tabsDiv.appendChild(tabButton(tabName, name, i === 0));
    // Types 1/2/3 (Weapon/Shield/Bow) use the decomposed layout (no count).
    // Type 4 (Ammo) uses standard layout WITH count.
    // Type 6 (Casting Tool) uses standard layout WITHOUT count.
    const isDecomposable = typeId === 1 || typeId === 2 || typeId === 3;
    const showCount = isCountVisible('weapons', typeId);
    let headers;
    let noCount;
    if (isDecomposable) {
      headers = weaponColumnHeadersNoCount;
      noCount = true;
    } else if (showCount) {
      headers = columnHeadersWithCount;
      noCount = false;
    } else {
      headers = columnHeadersNoCount;
      noCount = true;
    }
    contents.push(
      invCategoryTab('weapons', 'dep', false, name, headers, {
        tabName,
        weaponType: typeId,
        decomposed: isDecomposable,
        noCount,
      }),
    );
  }

  // Goods-type tabs (Ore, Consum., Soul, Key Item) — always show count
  const goodsTypes = getGoodsTypes();
  for (const { typeId, name } of goodsTypes) {
    const tabName = 'goods-' + typeId;
    tabsDiv.appendChild(tabButton(tabName, name));
    contents.push(
      invCategoryTab('goods', 'dep', false, name, columnHeadersWithCount, {
        tabName,
        goodsType: typeId,
      }),
    );
  }

  // Armor, Rings tabs (no count column)
  tabsDiv.appendChild(tabButton('armor', 'Armor'));
  tabsDiv.appendChild(tabButton('rings', 'Ring'));

  contents.push(
    invCategoryTab('armor', 'dep', false, 'Armor', columnHeadersNoCount, {
      tabName: 'armor',
      noCount: true,
    }),
  );
  contents.push(
    invCategoryTab('rings', 'dep', false, 'Ring', columnHeadersNoCountNoDur, {
      tabName: 'rings',
      noCount: true,
    }),
  );

  const tabGroup = el('div', { className: 'tab-group' }, tabsDiv, ...contents);

  // Add buttons — one per tab, shown/hidden based on active sub-tab.
  const actionsDiv = el('div', { className: 'sub-tab-actions' });
  // Weapon-type add buttons (first one visible by default — matches active tab)
  for (let i = 0; i < types.length; i++) {
    const { typeId, name } = types[i];
    const tabName = 'weapon-' + typeId;
    actionsDiv.appendChild(
      el(
        'button',
        {
          type: 'button',
          className: 'row-add dep-add',
          'data-tab': tabName,
          'data-category': 'weapons',
          'data-weapon-type': String(typeId),
          hidden: i !== 0,
        },
        `Add ${name}`,
      ),
    );
  }
  // Goods-type add buttons
  for (const { typeId, name } of goodsTypes) {
    const tabName = 'goods-' + typeId;
    actionsDiv.appendChild(
      el(
        'button',
        {
          type: 'button',
          className: 'row-add dep-add',
          'data-tab': tabName,
          'data-category': 'goods',
          'data-goods-type': String(typeId),
          hidden: true,
        },
        `Add ${name}`,
      ),
    );
  }
  // Armor, Rings add buttons
  for (const [tab, label] of [
    ['armor', 'Armor'],
    ['rings', 'Ring'],
  ]) {
    actionsDiv.appendChild(
      el(
        'button',
        {
          type: 'button',
          className: 'row-add dep-add',
          'data-tab': tab,
          'data-category': tab,
          hidden: true,
        },
        `Add ${label}`,
      ),
    );
  }

  return el('div', { className: 'sub-tab-container' }, tabGroup, actionsDiv);
}

function invCategoryTab(category, tablePrefix, hasMisc1, itemLabel, columnHeaders, opts = {}) {
  const tabName = opts.tabName || category;
  const weaponType = opts.weaponType;
  const goodsType = opts.goodsType;
  const isDeposit = tablePrefix === 'dep';
  const isDecomposed = opts.decomposed === true;

  // Compute per-column min-widths so columns are pre-sized even when
  // the <tbody> is empty (prevents header shift when first row is added).
  const colWidths = [];

  // First column: item select (or base-weapon select for decomposed deposit)
  if (isDecomposed && weaponType != null) {
    colWidths.push(SELECT_WIDTHS[`base-weapons-${weaponType}`] + 12);
  } else {
    colWidths.push(selectWidthFor(category, weaponType ?? goodsType, isDeposit) + 12);
  }

  // Remaining columns
  for (let i = 0; i < columnHeaders.length; i++) {
    const h = columnHeaders[i];
    const isLast = i === columnHeaders.length - 1;
    const text = typeof h === 'string' ? h : h.text;
    if (isLast && text === '') {
      // Delete button column
      colWidths.push(COL_MIN_WIDTH_DELETE);
    } else if (isDecomposed) {
      // Path → select, Level → select, DUR → input
      if (text === 'Path') {
        colWidths.push(SELECT_WIDTHS.path + 12);
      } else if (text === 'Level') {
        colWidths.push(SELECT_WIDTHS.level + 12);
      } else {
        colWidths.push(COL_MIN_WIDTH_INPUT);
      }
    } else {
      // Standard: all middle columns are numeric inputs
      colWidths.push(COL_MIN_WIDTH_INPUT);
    }
  }

  const ths = [el('th', { textContent: itemLabel, style: `min-width:${colWidths[0]}px` })];
  for (let i = 0; i < columnHeaders.length; i++) {
    const h = columnHeaders[i];
    const mw = `min-width:${colWidths[i + 1]}px`;
    if (typeof h === 'string') {
      ths.push(el('th', { textContent: h, style: mw }));
    } else {
      ths.push(el('th', { textContent: h.text, 'data-tooltip': h.tooltip, style: mw }));
    }
  }
  // Single table with thead+tbody so columns auto-align.
  // Sticky <th> (CSS position:sticky; top:0) keeps the header visible
  // while the .sub-tab-table-body container scrolls.
  const noCount = opts.noCount === true;
  const baseClassName = `grid-table ${tablePrefix}-table${noCount ? ' no-count' : ''}`;
  const tableAttrs =
    weaponType != null
      ? { 'data-category': category, 'data-weapon-type': String(weaponType) }
      : goodsType != null
        ? { 'data-category': category, 'data-goods-type': String(goodsType) }
        : { 'data-category': category };
  const table = el(
    'table',
    { className: baseClassName, ...tableAttrs },
    el('thead', {}, el('tr', {}, ...ths)),
    el('tbody', {}),
  );
  // First weapon-type tab (weapon-1) is visible by default
  return el(
    'div',
    { className: 'tab-content', 'data-tab': tabName, hidden: tabName !== 'weapon-1' },
    el('div', { className: 'sub-tab-table-body' }, table),
  );
}

/**
 * Build the entire editor page programmatically.
 *
 * This is a large declarative function that constructs all DOM elements.
 * It is organized into clearly-marked sections:
 *   1. Header (title + status bar)
 *   2. Toolbar (Open/Save/Export/Close buttons, slot/profile/account fields)
 *   3. Left Sidebar (Character / World / Warp tabs)
 *   4. Content Area (charPanel + main editor)
 *   5. Main Editor (Build / Inventory / Spells / Deposit tabs)
 *   6. Landing Page + Drag-Drop Overlay
 *
 * Each section is marked with a === separator comment for easy navigation.
 */
export function buildPage() {
  const app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = '';

  // ================================================================
  // Header
  // ================================================================
  app.appendChild(
    el(
      'header',
      {},
      el('h1', { textContent: 'DemonSave-PS3' }),
      el(
        'div',
        { className: 'status-container' },
        el('div', {
          id: 'status',
          className: 'status',
          textContent: 'No save loaded.',
          'aria-live': 'polite',
        }),
      ),
    ),
  );

  // ================================================================
  // Toolbar — action buttons, slot selector, profile/account fields
  // ================================================================
  app.appendChild(
    el(
      'div',
      { className: 'toolbar' },
      el('button', { id: 'btnOpen', type: 'button' }, icon('folderOpen'), 'Open'),
      el(
        'button',
        {
          id: 'btnToggleEncrypt',
          type: 'button',
          role: 'switch',
          disabled: true,
          'aria-checked': 'true',
          'data-tooltip': 'Encryption: ON (click to toggle)',
        },
        el(
          'span',
          { className: 'toggle-switch-track' },
          el('span', { className: 'toggle-switch-thumb' }),
        ),
        el('span', { className: 'toggle-switch-label' }, 'ENC'),
      ),
      el(
        'button',
        {
          id: 'btnSave',
          type: 'button',
          disabled: true,
          'data-tooltip': 'Overwrite save folder (Chromium-based browsers only)',
        },
        icon('save'),
        'Save',
      ),
      el(
        'button',
        { id: 'btnExport', type: 'button', disabled: true, 'data-tooltip': 'Download as ZIP' },
        icon('download'),
        'Export',
      ),
      label(
        'slotSection',
        'Slot: ',
        el(
          'div',
          { className: 'slot-wrapper' },
          selectInput('saveSlot', null, null),
          el('span', { className: 'dirty-dot' }),
        ),
        { hidden: true },
      ),
      label(
        'profileNumLabel',
        'Profile: ',
        numInput('profileNum', { value: '0', min: '0', max: '255' }),
        {
          'data-tooltip':
            "Internal metadata byte (0x570 in PARAM.SFO) used by the game's save manager.\n\u2022 Real PS3: validates the save folder \u2014 wrong value may make it unrecognized\n\u2022 RPCS3: no visible effect\n\u2022 No gameplay impact \u2014 generally leave unchanged",
        },
      ),
      label(
        'accountIdLabel',
        'Account ID: ',
        el('input', {
          id: 'accountId',
          type: 'text',
          value: '',
          maxlength: '32',
          size: '34',
          pattern: '[0-9a-fA-F]{0,32}',
          spellcheck: 'false',
          'data-tooltip':
            'PSN ACCOUNT_ID — 16-byte identifier (32 hex chars) that binds the save to a PSN account.\n\u2022 Real PS3: must match your account or the save will not load. Copy it from one of your own saves.\n\u2022 RPCS3: typically all-zeros (0000\u20260000) — leave as-is.\n\u2022 Encrypted export: the value here is written into PARAM.SFO before building PARAM.PFD.',
        }),
      ),
      // Close button — release current save and return to landing page.
      // Right-aligned via margin-left:auto in CSS. Directory info + encryption
      // state are shown in its tooltip (set dynamically in app.js).
      el(
        'button',
        {
          id: 'btnClose',
          type: 'button',
          'data-tooltip':
            'Close current save and return to landing page — all unsaved changes will be discarded',
        },
        icon('close'),
        'Close',
      ),
    ),
  );

  // ================================================================
  // Left Sidebar — Character / World / Warp tabs
  // ================================================================
  const charPanel = el(
    'div',
    { id: 'charPanel', className: 'tab-group top-level' },
    el(
      'div',
      { className: 'tabs' },
      el(
        'button',
        { type: 'button', className: 'tab active', 'data-tab': 'character' },
        'Char.',
        el('span', { className: 'dirty-dot' }),
      ),
      el(
        'button',
        { type: 'button', className: 'tab', 'data-tab': 'world' },
        'World',
        el('span', { className: 'dirty-dot' }),
      ),
      el(
        'button',
        { type: 'button', className: 'tab', 'data-tab': 'warp' },
        'Warp',
        el('span', { className: 'dirty-dot' }),
      ),
    ),
    // Character tab
    el(
      'div',
      { className: 'tab-content', 'data-tab': 'character' },
      el(
        'div',
        { className: 'grid' },
        label('nameLabel', 'Name: ', el('input', { id: 'name', type: 'text', maxlength: '16' })),
        label(
          'genderLabel',
          'Gender: ',
          selectInput('gender', null, [
            ['0', 'Female'],
            ['1', 'Male'],
          ]),
        ),
        label('startClassLabel', 'Starting Class: ', selectInput('startClass', null, null)),
        label('phantomTypeLabel', 'Phantom Type: ', numInput('phantomType', { value: '0' }), {
          'data-tooltip':
            'Character form state when loading the save (single byte).\n\u2022 0 = Body form (alive) \u2014 full HP, can summon/invasion is enabled\n\u2022 1 = Soul form (dead) \u2014 reduced HP (~50%, ~75% with Cling Ring)\n\u2022 2+ = phantom colors used during online multiplayer (blue=co-op, red/black=invasion)\n\u2022 Offline: affects HP and whether you start alive or dead\n\u2022 Online: also determines your phantom color to other players\n\u2022 Practical use: set to 0 to revive without consuming a Stone of Ephemeral Eyes',
        }),
        label('clearCountLabel', 'Clear Count: ', numInput('clearCount', { value: '0' }), {
          'data-tooltip':
            'New Game+ cycle counter (0\u2013255). Number of times the game has been completed.\n\u2022 0 = first playthrough (NG)\n\u2022 1 = NG+, 2 = NG++, etc.\n\u2022 Higher = harder enemies. Edit to jump to a higher difficulty cycle.',
        }),
      ),
      el(
        'div',
        { className: 'hair-row' },
        label('hairstyleLabel', 'Hair Style: ', selectInput('hairstyle', 'hairstyle-select', null)),
        fieldset(
          'Hair Color (RGB 0\u20131)',
          el(
            'div',
            { className: 'grid hair-color-grid' },
            label('hairRLabel', 'R: ', numInput('hairR', { step: '0.001', min: '0', max: '1' })),
            label('hairGLabel', 'G: ', numInput('hairG', { step: '0.001', min: '0', max: '1' })),
            label('hairBLabel', 'B: ', numInput('hairB', { step: '0.001', min: '0', max: '1' })),
            el('div', { id: 'hairColorSample', className: 'color-sample' }),
          ),
        ),
      ),
    ),
    // World State tab
    el(
      'div',
      { className: 'tab-content', 'data-tab': 'world', hidden: true },
      fieldset(
        {
          text: 'Character Tendency',
          tooltip:
            'Character Tendency \u2014 your personal karma (Pure White \u2194 Pure Black), shown as the statue\u2019s hue in the status menu. Pure White: +20% Soul Form attack & the Friend\u2019s Ring from the Monumental. Pure Black: lowers Soul Form HP & unlocks Mephistopheles\u2019 quests. Shifts white by killing Black Phantoms; black by invading hosts or killing NPCs.',
        },
        el(
          'div',
          { className: 'grid' },
          label('charTendencyLabel', 'Character: ', numInput('charTendency', { step: '0.001' })),
        ),
      ),
      fieldset(
        {
          text: 'World Tendency',
          tooltip:
            'World Tendency \u2014 each world\u2019s alignment (+200 Pure White \u2194 \u2212200 Pure Black), shown by the Archstone\u2019s hue on the status menu. Shifts White by killing that world\u2019s bosses (+60/+90); Black by dying in Body Form there (\u221260) or killing NPCs. Changes register only when you return to the Nexus and carry into New Game+. Pure White: weaker enemies & +10\u201320% Soul Form attack. Pure Black: tougher enemies, better/rarer drops, plus Black Phantoms & Primeval Demons that unlock unique gear & events.',
        },
        el(
          'div',
          { className: 'grid' },
          label('nexusTendencyLabel', 'Nexus: ', numInput('nexusTendency', { step: '0.001' })),
          label('w1TendencyLabel', 'W1 (Boletaria): ', numInput('w1Tendency', { step: '0.001' })),
          label('w2TendencyLabel', 'W2 (Stonefang): ', numInput('w2Tendency', { step: '0.001' })),
          label('w3TendencyLabel', 'W3 (Shrine): ', numInput('w3Tendency', { step: '0.001' })),
          label('w4TendencyLabel', 'W4 (Latria): ', numInput('w4Tendency', { step: '0.001' })),
          label('w5TendencyLabel', 'W5 (Defilement): ', numInput('w5Tendency', { step: '0.001' })),
        ),
      ),
      el(
        'div',
        { className: 'world-section-separator' },
        checkboxInput('archSealed', 'Archdemon Sealed', {
          'data-tooltip':
            'Archdemon Sealed \u2014 the central Nexus seal guarding the path to the Old One (the end-game). Checked = sealed shut, meaning you haven\u2019t yet defeated all five Archdemons (each world\u2019s final boss). Once the last Archdemon falls the seal opens, the Maiden in Black escorts you to the Old One, and she stops offering level-ups.',
        }),
      ),
      fieldset(
        'NPC State',
        el(
          'div',
          { className: 'grid npc-state-grid' },
          el('span', { className: 'npc-name' }, 'Sage Freke'),
          selectInput('sageFreke', 'npc-state-select', [
            ['friendly', 'Friendly'],
            ['hostile', 'Hostile'],
            ['dead', 'Dead'],
          ]),
          el('span', { className: 'npc-name' }, 'Thomas'),
          selectInput('thomas', 'npc-state-select', [
            ['friendly', 'Friendly'],
            ['hostile', 'Hostile'],
            ['dead', 'Dead'],
          ]),
          el('span', { className: 'npc-name' }, 'Boldwin'),
          selectInput('boldwin', 'npc-state-select', [
            ['friendly', 'Friendly'],
            ['hostile', 'Hostile'],
            ['dead', 'Dead'],
          ]),
        ),
      ),
    ),
    // Warp tab
    el(
      'div',
      { className: 'tab-content', 'data-tab': 'warp', hidden: true },
      el(
        'div',
        { className: 'grid' },
        label('warpLocationLabel', 'Location: ', selectInput('warpLocation', null, null)),
        label('worldLabel', 'World: ', numInput('world')),
        label('blockLabel', 'Block: ', numInput('block')),
        label('xposLabel', 'X: ', numInput('xpos', { step: '0.001' })),
        label('yposLabel', 'Y: ', numInput('ypos', { step: '0.001' })),
        label('zposLabel', 'Z: ', numInput('zpos', { step: '0.001' })),
        label('rotLabel', 'Rotation: ', numInput('rot', { step: '0.001' })),
      ),
      el(
        'div',
        { className: 'warp-world-name-container' },
        el('span', { id: 'worldName', className: 'warp-world-name' }),
      ),
    ),
  );

  // ================================================================
  // Content Area — charPanel (left) + editor (right)
  // ================================================================
  const contentArea = el('div', { id: 'contentArea' });
  contentArea.appendChild(charPanel);

  // ================================================================
  // Main Editor — Build / Inventory / Spells / Deposit tabs
  // ================================================================
  contentArea.appendChild(
    el(
      'main',
      { id: 'editor' },
      el(
        'div',
        { className: 'tab-group top-level' },
        // Tabs bar
        el(
          'div',
          { className: 'tabs' },
          tabButton('character', 'Build', true),
          tabButton('inventory', 'Inventory'),
          tabButton('spells', 'Spells'),
          tabButton('deposit', "Thomas's Storage"),
        ),

        // Build tab
        tabContent(
          'character',
          false,
          fieldset(
            'Vitals',
            el(
              'div',
              { className: 'vitals-grid' },
              // Row 1: current values (HP | MP | Stamina)
              label('currHPLabel', 'Current HP: ', numInput('currHP')),
              label('currMPLabel', 'Current MP: ', numInput('currMP')),
              label('currStamLabel', 'Current Stamina: ', numInput('currStam')),
              // Row 2: current (buffed) maxima
              label('currMaxHPLabel', 'Current Max HP: ', numInput('currMaxHP')),
              label('currMaxMPLabel', 'Current Max MP: ', numInput('currMaxMP')),
              label('currMaxStamLabel', 'Current Max Stamina: ', numInput('currMaxStam')),
              // Row 3: base maxima
              label('maxHPLabel', 'Max HP: ', numInput('maxHP')),
              label('maxMPLabel', 'Max MP: ', numInput('maxMP')),
              label('maxStamLabel', 'Max Stamina: ', numInput('maxStam')),
            ),
          ),
          fieldset(
            'Stats',
            // Upper grid: 8 primary stats in a 5-column layout
            el(
              'div',
              { className: 'stats-grid' },
              label('vitLabel', 'VIT: ', numInput('vit', { min: '0', max: '99' })),
              label('intLabel', 'INT: ', numInput('int', { min: '0', max: '99' })),
              label('endLabel', 'END: ', numInput('end', { min: '0', max: '99' })),
              label('strLabel', 'STR: ', numInput('str', { min: '0', max: '99' })),
              label('dexLabel', 'DEX: ', numInput('dex', { min: '0', max: '99' })),
              label('magicLabel', 'Magic: ', numInput('magic', { min: '0', max: '99' })),
              label('faithLabel', 'Faith: ', numInput('faith', { min: '0', max: '99' })),
              label('luckLabel', 'Luck: ', numInput('luck', { min: '0', max: '99' })),
            ),
            // Separator between primary stats and Souls row
            el('div', { className: 'equipment-separator' }),
            // Souls row: not constrained to 5 columns; all textboxes same width
            el(
              'div',
              { className: 'stats-souls' },
              label('soulsLabel', 'Souls: ', numInput('souls', { min: '0', max: '999999999' })),
              label(
                'soulMemLabel',
                'Soul Memory: ',
                numInput('soulMem', { min: '0', max: '999999999' }),
                {
                  'data-tooltip':
                    'Cumulative total of all souls ever earned (kills, bosses, consumed soul items).\n\u2022 Unlike \u201CSouls\u201D, this value never decreases when you spend or lose souls\n\u2022 Used by the game for online multiplayer matchmaking (co-op summon and invasion ranges)\n\u2022 Editing it shifts your online pairing pool without changing your actual level or stats\n\u2022 Lowering it may help you co-op with earlier-game players; raising it pushes you into later-game pools',
                },
              ),
              label(
                'levelsPurchasedLabel',
                'Levels Purchased: ',
                numInput('levelsPurchased', { min: '0', max: '712' }),
                {
                  'data-tooltip':
                    'Total stat levels purchased via leveling (equivalent to Soul Level minus Starting Class base level).\n\u2022 VIT, INT, END, STR, DEX, Magic, Faith, Luck — the sum of your investment across all stats\n\u2022 Keep this consistent with the individual stat values to avoid in-game desync\n\u2022 Max is 712 (Soul Level cap in Demon\u2019s Souls)',
                },
              ),
            ),
          ),
          fieldset(
            'Equipment',
            // Upper grid (rows 1-4): hands, projectiles, rings, armor.
            // Label columns use max-content so short labels don't waste space,
            // giving the textboxes more room to display item names.
            el(
              'div',
              { className: 'equipment-grid' },
              // Row 1
              label(
                'leftHand1Label',
                'Left Hand 1:',
                el('span', { id: 'leftHand1', className: 'eq-text' }),
              ),
              label('arrowsLabel', 'Arrows:', el('span', { id: 'arrows', className: 'eq-text' })),
              label('helmetLabel', 'Helmet:', el('span', { id: 'helmet', className: 'eq-text' })),
              // Row 2
              label(
                'leftHand2Label',
                'Left Hand 2:',
                el('span', { id: 'leftHand2', className: 'eq-text' }),
              ),
              label('boltsLabel', 'Bolts:', el('span', { id: 'bolts', className: 'eq-text' })),
              label('chestLabel', 'Chest:', el('span', { id: 'chest', className: 'eq-text' })),
              // Row 3
              label(
                'rightHand1Label',
                'Right Hand 1:',
                el('span', { id: 'rightHand1', className: 'eq-text' }),
              ),
              label('ring1Label', 'Ring 1:', el('span', { id: 'ring1', className: 'eq-text' })),
              label(
                'gauntletsLabel',
                'Gauntlets:',
                el('span', { id: 'gauntlets', className: 'eq-text' }),
              ),
              // Row 4
              label(
                'rightHand2Label',
                'Right Hand 2:',
                el('span', { id: 'rightHand2', className: 'eq-text' }),
              ),
              label('ring2Label', 'Ring 2:', el('span', { id: 'ring2', className: 'eq-text' })),
              label(
                'leggingsLabel',
                'Leggings:',
                el('span', { id: 'leggings', className: 'eq-text' }),
              ),
            ),
            // Separator between upper grid and Quick Slots
            el('div', { className: 'equipment-separator' }),
            // Quick Slots grid (rows 5-6): keeps fixed 80px label column.
            el(
              'div',
              { className: 'equipment-grid equipment-quick' },
              // Row 5
              label(
                'quickSlot1Label',
                'Quick Slot 1:',
                el('span', { id: 'quickSlot1', className: 'eq-text' }),
              ),
              label(
                'quickSlot2Label',
                'Quick Slot 2:',
                el('span', { id: 'quickSlot2', className: 'eq-text' }),
              ),
              label(
                'quickSlot3Label',
                'Quick Slot 3:',
                el('span', { id: 'quickSlot3', className: 'eq-text' }),
              ),
              // Row 6
              label(
                'quickSlot4Label',
                'Quick Slot 4:',
                el('span', { id: 'quickSlot4', className: 'eq-text' }),
              ),
              label(
                'quickSlot5Label',
                'Quick Slot 5:',
                el('span', { id: 'quickSlot5', className: 'eq-text' }),
              ),
            ),
          ),
          // Info line — explains what is editable in the Build tab
          el('div', {
            className: 'build-info',
            textContent:
              '* Edit with caution. HP, MP, and Stamina depend on your stats and gear \u2014 changing them directly can cause unexpected behavior. Editing Levels Purchased can desync your soul record. The hotbar isn\u2019t editable here (switch items in-game). Only change values you fully understand.',
            'data-tooltip':
              '* Edit with caution. HP, MP, and Stamina depend on your stats and gear \u2014 changing them directly can cause unexpected behavior. Editing Levels Purchased can desync your soul record. The hotbar isn\u2019t editable here (switch items in-game). Only change values you fully understand.',
            'data-tooltip-if-truncated': 'true',
          }),
        ),

        // Inventory tab
        tabContent('inventory', true, invSubTabs('inv-add')),

        // Spells tab — fixed slots row + scrollable spell list + pinned Add button.
        // Single table (thead+tbody) inside .sub-tab-table-body so columns
        // auto-align and the header stays sticky during scroll.
        tabContent(
          'spells',
          true,
          el(
            'div',
            { className: 'sub-tab-table-header' },
            el(
              'div',
              { className: 'grid' },
              label('spellSlotsLabel', 'Spell Slots: ', numInput('spellSlots', { min: '0' })),
              label('miracleSlotsLabel', 'Miracle Slots: ', numInput('miracleSlots', { min: '0' })),
            ),
            el('div', { className: 'equipment-separator' }),
          ),
          el(
            'div',
            { className: 'sub-tab-table-body' },
            el(
              'table',
              { id: 'spellsTableBody', className: 'grid-table' },
              el(
                'thead',
                {},
                el(
                  'tr',
                  {},
                  el('th', {
                    textContent: 'Spell / Miracle',
                    style: `min-width:${SELECT_WIDTHS.spells + 12}px`,
                  }),
                  el('th', {
                    textContent: 'Status',
                    style: `min-width:${SELECT_WIDTHS['spell-status'] ?? 90}px`,
                  }),
                  el('th', {
                    textContent: 'Misc1',
                    style: `min-width:${COL_MIN_WIDTH_INPUT}px`,
                    'data-tooltip':
                      'Sort/category ID that controls how the spell is ordered and grouped in the in-game magic menu. The tens digit groups spells by category (0=basic/utility, 1=fire, 3=defensive, 5=utility). Miracles use low values (1–8).\n\u2022 Setting it to 0 is safe — the spell still works, it just appears at the top of the list instead of its natural category position.\n\u2022 When adding a new spell, copy this value from an existing spell of the same type so it sorts correctly.',
                  }),
                  // Misc2 — purpose unknown (always 0 in observed saves); hidden
                  // from UI. Uncomment to re-expose if its function is determined.
                  // el('th', { textContent: 'Misc2' }),
                  el('th', { style: `min-width:${COL_MIN_WIDTH_DELETE}px` }),
                ),
              ),
              el('tbody', {}),
            ),
          ),
          el(
            'div',
            { className: 'sub-tab-actions' },
            el(
              'button',
              { id: 'addSpell', type: 'button', className: 'row-add', 'aria-label': 'Add spell' },
              icon('plus'),
              'Add Spell',
            ),
          ),
        ),

        // Thomas's Storage tab
        tabContent('deposit', true, depSubTabs()),
      ),
    ),
  );

  app.appendChild(contentArea);

  // ================================================================
  // Landing Page + Drag-Drop Overlay (also visible drop zone)
  // ================================================================
  app.appendChild(
    el(
      'div',
      { id: 'landingPage', className: 'landing-page' },
      el(
        'div',
        { className: 'landing-dropzone' },
        el('div', {
          className: 'landing-icon',
          _trustedSVG:
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" ' +
            'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
            '<path d="M3 7v10a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H12L10 6H4a1 1 0 0 0-1 1z"/>' +
            '</svg>',
        }),
        el('h2', { textContent: 'Drag and drop your PS3 save folder here' }),
        el(
          'p',
          { className: 'landing-hint' },
          'Drop the folder containing PARAM.SFO and USER.DAT files.',
        ),
        el(
          'p',
          { className: 'landing-hint landing-hint-sub' },
          'Example: BLES01389SAVE, BLES01390SAVE, BLUS30443SAVE, etc.',
        ),
        el(
          'p',
          { className: 'landing-hint' },
          el(
            'a',
            { id: 'landingBrowse', href: '#', className: 'landing-browse' },
            '…or click to browse (Chromium-based browser)',
          ),
        ),
      ),
    ),
  );

  // Drag-and-drop overlay — shown when a folder is dragged over the page
  app.appendChild(
    el(
      'div',
      { id: 'dropOverlay', className: 'drop-overlay', hidden: true },
      el(
        'div',
        { className: 'drop-overlay-content' },
        el('div', {
          className: 'drop-overlay-icon',
          _trustedSVG:
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" ' +
            'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
            '<path d="M3 7v10a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H12L10 6H4a1 1 0 0 0-1 1z"/>' +
            '</svg>',
        }),
        el('div', { className: 'drop-overlay-text' }, 'Drop your PS3 save folder here'),
      ),
    ),
  );
}
