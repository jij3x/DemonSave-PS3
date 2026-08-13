/**
 * deposit-table.js — Deposit (Thomas Storage) table rendering, decomposed
 * weapon rows, upgrade-path selects, and collection.
 */

import * as db from '../../des-db/index.js';
import {
  getCategoryData,
  isCountVisible,
  isDurabilityVisible,
  COUNT_LIMITS,
  SELECT_WIDTHS,
  getBaseWeaponsForType,
  getPathsForBaseWeapon,
  getUpgradeRefForItemId,
  resolveItemIdFromRef,
} from '../core/controls.js';
import { getUpgradePathDef } from '../../des-db/index.js';
import { makeCountCell, makeNumCell, parseCountValue } from '../core/dom-helpers.js';
import {
  makeRowDeleteButton,
  prependPlaceholder,
  refreshFilteredOptionsInTable,
} from './select-helpers.js';
import {
  applyItemSelectWidth,
  findItemIndex,
  formatUnknownItem,
  getWeaponTypeId,
  getGoodsTypeId,
  lookupMaxDurability,
  getItemNote,
  updateSelectTooltip,
} from '../core/item-helpers.js';
import { registerChangeHandler, registerInputHandler } from '../core/event-dispatcher.js';
import { DEFAULT_DEPOSIT_FLAGS } from '../core/constants.js';

/**
 * @typedef {Object} DepositRecord
 * @property {string} category
 * @property {number} itemId
 * @property {number} count
 * @property {number} [durability]
 * @property {number} [unknown1]
 * @property {number} [sortOrder]
 * @property {number[]} [flags]
 */

/**
 * Weapon types that use the decomposed Base Weapon / Path / Level layout
 * in the deposit (Thomas's Storage) tab.
 */
const DECOMPOSED_WEAPON_TYPES = new Set([1, 2, 3]);

/**
 * Render deposit rows from the model into per-type sub-tab tables.
 *
 * For weapons and goods, records are distributed across multiple per-type
 * tables (same as inventory) based on each item's type.  Armor and rings
 * use a single table each.
 *
 * Weapon types 1/2/3 (Weapon/Shield/Bow) use the decomposed 5-column layout
 * (Base Weapon | Path | Level | Count | Durability | Del).  Non-upgradable
 * items (e.g. crossbows, whose base weapon has no upgrade paths) appear as
 * an extra option in the Base Weapon select; their Path and Level selects
 * stay empty.
 *
 * @param {DepositRecord[]} records  [{category, itemId, count, unknown1, sortOrder, flags}]
 */
export function renderDeposit(records) {
  // Clear all deposit tables (weapons and goods span multiple per-type tables).
  const allTbodies = document.querySelectorAll('table.dep-table tbody');
  for (const tbody of allTbodies) tbody.innerHTML = '';

  // Route each record to its correct type table
  for (const rec of records) {
    let tbody;
    let typeId = null;
    if (rec.category === 'weapons') {
      typeId = getWeaponTypeId(rec.itemId);
      tbody = document.querySelector(
        `table.dep-table[data-category="weapons"][data-weapon-type="${typeId}"] tbody`,
      );
      if (!tbody) {
        tbody = document.querySelector(
          'table.dep-table[data-category="weapons"][data-weapon-type="1"] tbody',
        );
      }
    } else if (rec.category === 'goods') {
      const gTypeId = getGoodsTypeId(rec.itemId);
      tbody = document.querySelector(
        `table.dep-table[data-category="goods"][data-goods-type="${gTypeId}"] tbody`,
      );
      if (!tbody) {
        tbody = document.querySelector(
          'table.dep-table[data-category="goods"][data-goods-type="9"] tbody',
        );
      }
    } else {
      tbody = document.querySelector(`table.dep-table[data-category="${rec.category}"] tbody`);
    }
    if (!tbody) continue;

    // Use decomposed weapon row for types 1/2/3 (Weapon/Shield/Bow).
    // makeDepositWeaponRow handles both upgradable and non-upgradable
    // items (e.g. crossbows whose base weapon has no upgrade paths —
    // Path/Level selects stay empty).
    if (rec.category === 'weapons' && typeId && DECOMPOSED_WEAPON_TYPES.has(typeId)) {
      tbody.appendChild(makeDepositWeaponRow(typeId, rec, true));
    } else {
      tbody.appendChild(makeDepositRow(rec.category, rec, true, typeId));
    }
  }
}

/**
 * Create a <tr> for a deposit record in a fixed category table.
 *
 * Standard (non-decomposed) layout: Item | Count | Durability | Del
 * Used for Ammo (4), Casting Tool (6), Armor, Rings, Goods.
 *
 * @param {string} category  'weapons'|'armor'|'rings'|'goods'
 * @param {Record<string, any>} rec  {itemId, count, unknown1, sortOrder, flags}
 * @param {boolean} [isExisting=true]  true if loaded from save file,
 *   false if user-inserted via the Add button. Determines soft vs. hard
 *   delete behavior.
 * @param {number|null} [typeIdHint=null]  optional type hint for new rows
 * @returns {HTMLTableRowElement}
 */
export function makeDepositRow(category, rec, isExisting = true, typeIdHint = null) {
  const { ids, names } = getCategoryData(category);
  const tr = document.createElement('tr');

  // Determine type ID for count-visibility checks.
  // Prefer the explicit hint (from add-button handlers, where itemId is
  // undefined for new rows and the DB lookup would return the wrong type).
  let rowTypeId = typeIdHint;
  if (rowTypeId === null) {
    if (category === 'weapons') {
      rowTypeId = getWeaponTypeId(rec.itemId);
    } else if (category === 'goods') {
      rowTypeId = getGoodsTypeId(rec.itemId);
    }
  }
  const showCount = isCountVisible(category, rowTypeId);
  const showDurability = isDurabilityVisible(category, rowTypeId);

  // Track existing vs. new for delete behavior
  tr.dataset.existing = String(isExisting);
  if (!isExisting) {
    tr.classList.add('row-added');
  }

  // Store binary fields as hidden dataset attributes — the data travels
  // with the row, so reordering is safe (no _ref → index lookup needed).
  tr.dataset.unknown1 = rec.unknown1 !== undefined ? String(rec.unknown1) : '';
  tr.dataset.sortOrder = rec.sortOrder !== undefined ? String(rec.sortOrder) : '';
  tr.dataset.flags = Array.isArray(rec.flags) ? JSON.stringify(rec.flags) : '';

  // Item name <select>
  const tdName = document.createElement('td');
  const itemSel = document.createElement('select');
  itemSel.className = 'dep-name';
  if (!isExisting) prependPlaceholder(itemSel);

  // Lazy-load: render only the currently-selected item's display option.
  // Full option list is populated on first user interaction (setupLazySelects).
  itemSel.dataset.lazyCat = category;

  // Set a fixed width so the select fits the longest item in its list,
  // even before the lazy-load fires.
  applyItemSelectWidth(itemSel, category, rowTypeId, true);

  // NOTE: data-weapon-type / data-goods-type are NOT set here because the
  // <tr> hasn't been appended to the DOM yet — closest('table[...]') would
  // return null.  The fallback in ensureSelectPopulated() handles this by
  // looking up the parent table at interaction time (first mousedown/focus).

  let matched = false;
  if (rec.itemId !== undefined && rec.itemId !== 0) {
    const idx = findItemIndex(ids, rec.itemId);
    if (idx >= 0) {
      const opt = document.createElement('option');
      opt.value = String(ids[idx]);
      opt.textContent = names[idx];
      opt.selected = true;
      itemSel.appendChild(opt);
      matched = true;
    }
  }

  // Handle unknown item IDs not in the database
  if (!matched && rec.itemId !== undefined && rec.itemId !== 0) {
    const opt = document.createElement('option');
    opt.value = rec.itemId;
    opt.textContent = formatUnknownItem(rec.itemId);
    opt.selected = true;
    itemSel.appendChild(opt);
  }

  // Set note-based tooltip for the currently-selected item.
  if (rec.itemId) {
    updateSelectTooltip(itemSel, getItemNote(category, rec.itemId));
  }

  tdName.appendChild(itemSel);
  tr.appendChild(tdName);

  // Count (hidden for non-counted types; value preserved via the hidden input)
  // Ammo (weapons type 4) uses a wider range (1–999) than other countable
  // items (1–99).
  tr.appendChild(makeCountCell('dep-count', rec.count ?? 1, showCount, rowTypeId === 4));

  // Durability (hidden for non-durability types; value preserved via dataset)
  if (showDurability) {
    tr.appendChild(makeNumCell('inv-dep-durability', rec.durability ?? 0));
  } else {
    tr.dataset.durability = String(rec.durability ?? 0);
  }

  // Delete button
  const tdDel = document.createElement('td');
  tdDel.appendChild(makeRowDeleteButton(tr));
  tr.appendChild(tdDel);

  return tr;
}

/**
 * Populate the path <select> with paths available for a given base weapon.
 * @param {HTMLSelectElement} pathSel
 * @param {number} baseId
 * @param {number|null} [selectedPathId]  path to pre-select
 */
function populatePathSelect(pathSel, baseId, selectedPathId) {
  const paths = getPathsForBaseWeapon(baseId);
  pathSel.innerHTML = '';
  for (const { pathId, name } of paths) {
    const opt = document.createElement('option');
    opt.value = String(pathId);
    opt.textContent = name;
    if (selectedPathId != null && pathId === selectedPathId) opt.selected = true;
    pathSel.appendChild(opt);
  }
}

/**
 * Populate the level <select> with valid levels for a given upgrade path.
 * @param {HTMLSelectElement} levelSel
 * @param {number|null} pathId
 * @param {number|null} [selectedLevel]  level to pre-select
 */
function populateLevelSelect(levelSel, pathId, selectedLevel) {
  levelSel.innerHTML = '';
  if (!pathId) return; // no path selected (e.g., new row placeholder)
  let def;
  try {
    def = getUpgradePathDef(pathId);
  } catch {
    return; // unknown path
  }
  if (def) {
    for (const lvl of def.levels) {
      const opt = document.createElement('option');
      opt.value = String(lvl);
      opt.textContent = '+' + lvl;
      if (selectedLevel != null && lvl === selectedLevel) opt.selected = true;
      levelSel.appendChild(opt);
    }
  }
}

/**
 * Create a <tr> for a decomposed deposit weapon/shield/bow record.
 *
 * Layout: Base Weapon | Path | Level | Count | Durability | Del
 *
 * The three selects are interlinked: changing Base Weapon repopulates Path
 * (filtered for that base), and changing Path repopulates Level (filtered
 * for that path).  The resolved itemId is stored in a hidden input
 * (.dep-item-id) for collectDeposit() to read.
 *
 * @param {number} typeId  1=Weapon, 2=Shield, 3=Bow
 * @param {Record<string, any>} rec  {itemId, count, unknown1, sortOrder, flags}
 * @param {boolean} [isExisting=true]
 * @returns {HTMLTableRowElement}
 */
export function makeDepositWeaponRow(typeId, rec, isExisting = true) {
  const tr = document.createElement('tr');
  // Decomposed weapon rows are always Weapon/Shield/Bow (types 1/2/3),
  // which are non-counted types — count is hidden.
  const showCount = isCountVisible('weapons', typeId);
  tr.dataset.decomposed = 'true';
  tr.dataset.existing = String(isExisting);
  if (!isExisting) {
    tr.classList.add('row-added');
  }

  // Store binary fields as hidden dataset attributes
  tr.dataset.unknown1 = rec.unknown1 !== undefined ? String(rec.unknown1) : '';
  tr.dataset.sortOrder = rec.sortOrder !== undefined ? String(rec.sortOrder) : '';
  tr.dataset.flags = Array.isArray(rec.flags) ? JSON.stringify(rec.flags) : '';

  // Decompose itemId → [baseId, pathId, level]
  const ref = getUpgradeRefForItemId(rec.itemId);
  const baseId = ref ? ref[0] : 0;
  const pathId = ref ? ref[1] : 0;
  const level = ref ? ref[2] : 0;

  // Hidden input to store the recomposed itemId
  const hiddenItemId = document.createElement('input');
  hiddenItemId.type = 'hidden';
  hiddenItemId.className = 'dep-item-id';
  hiddenItemId.value = rec.itemId != null ? String(rec.itemId) : '';

  // Base Weapon select — populated eagerly (list is small enough)
  const tdBase = document.createElement('td');
  const baseSel = document.createElement('select');
  baseSel.className = 'dep-name dep-base-weapon';
  if (!isExisting) prependPlaceholder(baseSel);

  const baseWeapons = getBaseWeaponsForType(typeId);
  // Fixed width fits the longest base weapon name (pre-computed at load).
  baseSel.style.width = `${/** @type {Record<string, number>} */ (SELECT_WIDTHS)[`base-weapons-${typeId}`]}px`;
  // Track which base IDs are already in the dropdown.
  const seenBaseIds = new Set();
  for (const { baseId: bid, name } of baseWeapons) {
    const opt = document.createElement('option');
    opt.value = String(bid);
    opt.textContent = name;
    if (bid === baseId) opt.selected = true;
    baseSel.appendChild(opt);
    seenBaseIds.add(bid);
  }
  // If the item's baseId is not in the standard base weapons list (e.g.
  // crossbows whose base weapon has no upgrade paths), add it as an extra
  // option using the item's own name from the des-db.  The Path and Level
  // selects will stay empty since the base weapon has no upgrade paths.
  if (baseId && !seenBaseIds.has(baseId)) {
    let itemName;
    try {
      itemName = db.getItem('weapons', rec.itemId).name;
    } catch {
      itemName = formatUnknownItem(rec.itemId);
    }
    const opt = document.createElement('option');
    opt.value = String(baseId);
    opt.textContent = itemName;
    opt.selected = true;
    baseSel.appendChild(opt);
  }
  // Mark as already populated so the lazy-load system (which triggers on
  // any .dep-name select) doesn't wipe the eagerly-populated base weapon
  // options and replace them with the full weapon item list.
  baseSel.dataset.lazyLoaded = 'true';

  // Set note-based tooltip for the base weapon.
  // For decomposed rows, the base weapon's note is the most relevant info.
  if (baseId) {
    let baseNote = null;
    try {
      baseNote = db.getBaseWeapon(baseId)?.note ?? null;
    } catch {
      /* no note */
    }
    updateSelectTooltip(baseSel, baseNote);
  }

  tdBase.appendChild(baseSel);
  tr.appendChild(tdBase);

  // Path select — fixed width so empty selects (non-upgradable weapons)
  // match populated ones for consistent appearance.
  const tdPath = document.createElement('td');
  const pathSel = document.createElement('select');
  pathSel.className = 'dep-path';
  pathSel.style.width = `${SELECT_WIDTHS.path}px`;
  populatePathSelect(pathSel, baseId, pathId);
  // Set note-based tooltip for the upgrade path.
  if (pathId) {
    try {
      updateSelectTooltip(pathSel, getUpgradePathDef(pathId)?.note ?? null);
    } catch {
      /* no note */
    }
  }
  tdPath.appendChild(pathSel);
  tr.appendChild(tdPath);

  // Level select — fixed width so empty selects (non-upgradable weapons)
  // match populated ones for consistent appearance.
  const tdLevel = document.createElement('td');
  const levelSel = document.createElement('select');
  levelSel.className = 'dep-level';
  levelSel.style.width = `${SELECT_WIDTHS.level}px`;
  populateLevelSelect(levelSel, pathId, level);
  tdLevel.appendChild(levelSel);
  tr.appendChild(tdLevel);

  // Count (hidden for decomposed weapon types 1/2/3 — always count=1).
  // Decomposed rows are only Weapon/Shield/Bow (types 1/2/3) — never Ammo.
  tr.appendChild(makeCountCell('dep-count', rec.count ?? 1, showCount, false));

  // Durability
  tr.appendChild(makeNumCell('inv-dep-durability', rec.durability ?? 0));

  // Delete button
  const tdDel = document.createElement('td');
  tdDel.appendChild(makeRowDeleteButton(tr));
  tr.appendChild(tdDel);

  // Append hidden input at the end
  tr.appendChild(hiddenItemId);

  return tr;
}

/**
 * Recompose the itemId from a decomposed deposit weapon row's three selects.
 * Updates the hidden .dep-item-id input in place.
 * @param {HTMLTableRowElement} tr
 * @returns {number|null}  resolved itemId, or null if not found
 */
function recomposeDepositWeaponItemId(tr) {
  const baseSel = /** @type {HTMLSelectElement|null} */ (tr.querySelector('.dep-base-weapon'));
  const pathSel = /** @type {HTMLSelectElement|null} */ (tr.querySelector('.dep-path'));
  const levelSel = /** @type {HTMLSelectElement|null} */ (tr.querySelector('.dep-level'));
  if (!baseSel || !pathSel || !levelSel) return null;
  if (!baseSel.value) return null; // placeholder still active

  const baseId = parseInt(baseSel.value, 10);
  // Non-upgradable weapons (e.g. Club, Crossbows) have no path/level — their
  // selects are empty.  Use null so the index key is "baseId:null:null".
  const pathId = pathSel.value ? parseInt(pathSel.value, 10) : null;
  const level = levelSel.value ? parseInt(levelSel.value, 10) : null;

  const itemId = resolveItemIdFromRef(baseId, pathId, level);
  const hiddenInput = /** @type {HTMLInputElement|null} */ (tr.querySelector('.dep-item-id'));
  if (hiddenInput && itemId != null) {
    hiddenInput.value = String(itemId);
  }
  return itemId;
}

/**
 * Attach delegated change listeners for decomposed deposit weapon rows.
 *
 * When Base Weapon changes → repopulate Path select (filtered), auto-select
 * first path, repopulate Level select, recompose itemId.
 * When Path changes → repopulate Level select, recompose itemId.
 * When Level changes → recompose itemId.
 *
 * Also updates the durability field when Base Weapon or Path changes.
 */
export function setupDepositWeaponSync() {
  registerChangeHandler((e) => {
    const sel = e.target;
    if (!(sel instanceof HTMLSelectElement)) return;

    const tr = sel.closest('tr');
    if (!tr) return;
    if (tr.dataset.decomposed !== 'true') return;

    // Base Weapon changed
    if (sel.classList.contains('dep-base-weapon')) {
      if (!sel.value) return; // placeholder
      const baseId = parseInt(sel.value, 10);
      const pathSel = /** @type {HTMLSelectElement|null} */ (tr.querySelector('.dep-path'));
      const levelSel = /** @type {HTMLSelectElement|null} */ (tr.querySelector('.dep-level'));
      if (!pathSel || !levelSel) return;

      // Repopulate paths for the new base weapon
      populatePathSelect(pathSel, baseId, null);

      // Non-upgradable weapons (no path_ids) leave the path select empty.
      // In that case, also clear the level select and skip path-based logic.
      const firstPathId = pathSel.value ? parseInt(pathSel.value, 10) : null;

      // Update path tooltip for the auto-selected first path.
      if (firstPathId) {
        try {
          updateSelectTooltip(pathSel, getUpgradePathDef(firstPathId)?.note ?? null);
        } catch {
          /* no note */
        }
      } else {
        pathSel.removeAttribute('data-tooltip');
      }
      if (firstPathId != null) {
        // Upgradable weapon — populate levels for the first path
        populateLevelSelect(levelSel, firstPathId, null);
      } else {
        // Non-upgradable weapon — clear levels (no upgrades available)
        populateLevelSelect(levelSel, null, null);
      }

      // Recompose itemId (handles both upgradable and non-upgradable)
      const itemId = recomposeDepositWeaponItemId(tr);

      // Update durability
      if (itemId != null) {
        const maxDur = lookupMaxDurability('weapons', itemId);
        const durInput = /** @type {HTMLInputElement|null} */ (
          tr.querySelector('.inv-dep-durability')
        );
        if (durInput) durInput.value = String(maxDur);
      }
      return;
    }

    // Path changed
    if (sel.classList.contains('dep-path')) {
      const levelSel = /** @type {HTMLSelectElement|null} */ (tr.querySelector('.dep-level'));
      const pathId = parseInt(sel.value, 10);
      if (!levelSel) return;
      populateLevelSelect(levelSel, pathId, null);

      // Update path tooltip for the newly-selected path.
      if (pathId) {
        try {
          updateSelectTooltip(sel, getUpgradePathDef(pathId)?.note ?? null);
        } catch {
          /* no note */
        }
      } else {
        sel.removeAttribute('data-tooltip');
      }

      // Recompose itemId
      recomposeDepositWeaponItemId(tr);
      return;
    }

    // Level changed
    if (sel.classList.contains('dep-level')) {
      recomposeDepositWeaponItemId(tr);
      return;
    }
  });
}

/**
 * Collect deposit records from all per-category tables.
 *
 * Soft-deleted rows (data-deleted="true") are skipped.
 *
 * @returns {DepositRecord[]}
 */
export function collectDeposit() {
  const records = [];
  for (const category of ['weapons', 'armor', 'rings', 'goods']) {
    // Weapons and goods span multiple per-type tables — collect from all of them.
    const tbodies =
      category === 'weapons' || category === 'goods'
        ? document.querySelectorAll(`table.dep-table[data-category="${category}"] tbody`)
        : [document.querySelector(`table.dep-table[data-category="${category}"] tbody`)];
    for (const tbody of tbodies) {
      if (!tbody) continue;
      for (const tr of tbody.querySelectorAll('tr')) {
        // Skip soft-deleted rows
        if (tr.dataset.deleted === 'true') continue;

        // Cache the dep-name select per row to avoid repeated querySelector calls
        const nameSel = /** @type {HTMLSelectElement|null} */ (tr.querySelector('.dep-name'));
        // Skip unselected new rows (placeholder still active)
        if (!nameSel?.value) continue;

        // For decomposed weapon rows, recompose itemId from the 3 selects
        let itemId;
        if (tr.dataset.decomposed === 'true') {
          recomposeDepositWeaponItemId(tr);
          const hiddenInput = /** @type {HTMLInputElement|null} */ (
            tr.querySelector('.dep-item-id')
          );
          itemId = parseInt(hiddenInput?.value ?? '', 10) || 0;
        } else {
          itemId = parseInt(nameSel.value, 10) || 0;
        }

        // Cache DOM lookups per row to avoid repeated querySelector calls
        const countInput = /** @type {HTMLInputElement|null} */ (tr.querySelector('.dep-count'));
        const durInput = /** @type {HTMLInputElement|null} */ (
          tr.querySelector('.inv-dep-durability')
        );
        const count = parseCountValue(countInput, COUNT_LIMITS.deposit.min);
        const durVal = parseInt(durInput?.value ?? tr.dataset.durability ?? '', 10);

        // Read binary fields from hidden dataset attributes.
        // New items added via the UI leave these empty; mergeModel assigns
        // structural defaults for them.
        /** @type {DepositRecord} */
        const rec = {
          category,
          itemId,
          count,
          durability: isNaN(durVal) ? undefined : durVal,
        };
        if (tr.dataset.unknown1 !== '') {
          rec.unknown1 = parseInt(tr.dataset.unknown1 ?? '', 10) || 0;
        }
        if (tr.dataset.sortOrder !== '') {
          rec.sortOrder = parseInt(tr.dataset.sortOrder ?? '', 10) || 0;
        }
        if (tr.dataset.flags !== '') {
          try {
            rec.flags = JSON.parse(tr.dataset.flags ?? '');
          } catch {
            rec.flags = [...DEFAULT_DEPOSIT_FLAGS];
          }
        }
        records.push(rec);
      }
    }
  }
  return records;
}

/**
 * Attach delegated listeners for count clamping and sibling-dropdown
 * duplicate-prevention refresh.
 *
 * - Count clamping: when a visible count input changes, clamp it to the
 *   valid range for that row.  The range is set per-input by makeCountCell
 *   (Ammo rows: 1–999, all other countable items: 1–99) and read from the
 *   input's own min/max attributes here.  Prevents the user from
 *   decreasing below 1 or exceeding the type-specific maximum.
 *
 * - Duplicate-prevention refresh: when a show-count item select changes,
 *   refresh the filtered options in all sibling selects in the same table
 *   so the newly-used (or freed) item ID immediately disappears (or
 *   reappears) in their dropdowns.
 */
export function setupCountAndDuplicateSync() {
  // Count clamping — fires on 'input' so the clamp is immediate.
  // Reads the per-input min/max attributes set by makeCountCell so that
  // Ammo rows (1–999) are clamped differently from other countable items
  // (1–99), regardless of whether the row is in inventory or deposit.
  registerInputHandler((e) => {
    const inp = e.target;
    if (!(inp instanceof HTMLInputElement)) return;
    if (inp.type !== 'number') return;
    if (!inp.classList.contains('inv-count') && !inp.classList.contains('dep-count')) return;

    const min = parseInt(inp.min, 10);
    const max = parseInt(inp.max, 10);
    const raw = parseInt(inp.value, 10);
    if (isNaN(raw)) return; // let the user finish typing
    if (!isNaN(min) && raw < min) inp.value = String(min);
    if (!isNaN(max) && raw > max) inp.value = String(max);
  });

  // Sibling-dropdown refresh + deferred-dirty integration — fires on 'change'
  // (after the user commits a selection).  Also applied to count changes via
  // a separate change listener below.
  registerChangeHandler((e) => {
    const sel = e.target;
    if (!(sel instanceof HTMLSelectElement)) return;
    if (!sel.classList.contains('inv-name') && !sel.classList.contains('dep-name')) return;

    // Refresh sibling dropdowns so duplicate-prevention stays in sync.
    refreshFilteredOptionsInTable(sel);
  });
}

export { DECOMPOSED_WEAPON_TYPES };
