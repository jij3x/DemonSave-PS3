/**
 * inventory-table.js — Inventory table rendering and collection.
 *
 * Handles populating inventory tables (weapons, armor, rings, goods) from
 * the save model, and collecting form values back into a model.
 */

import {
  getCategoryData,
  isCountVisible,
  isDurabilityVisible,
  COUNT_LIMITS,
} from '../core/controls.js';
import { makeCountCell, makeNumCell, parseCountValue } from '../core/dom-helpers.js';
import { makeRowDeleteButton, prependPlaceholder } from './select-helpers.js';
import {
  applyItemSelectWidth,
  findItemIndex,
  formatUnknownItem,
  getWeaponTypeId,
  getGoodsTypeId,
  getItemNote,
  updateSelectTooltip,
} from '../core/item-helpers.js';

/**
 * Per-category misc1 layout.
 * - 'split'  = weapons/armor: exposed as two inputs (hi-byte Class + lo-byte Class Idx)
 * - 'single' = rings/goods:  exposed as a single input (sort/category value)
 */
const MISC1_LAYOUT = {
  weapons: { split: true, hiClass: 'inv-misc1hi', loClass: 'inv-misc1lo' },
  armor: { split: true, hiClass: 'inv-misc1hi', loClass: 'inv-misc1lo' },
  rings: { visible: 'single', singleClass: 'inv-misc1val' },
  goods: { visible: 'single', singleClass: 'inv-misc1val' },
};

/**
 * Render inventory rows for a category.
 *
 * Weapons and goods are distributed across multiple per-type tables
 * based on each item's type.  All other categories use a single table.
 *
 * @param {'weapons'|'armor'|'rings'|'goods'} category
 * @param {Array} records
 * @param {Map<string, number>} [invIdxByRef]  display-only map from _ref → idx1
 */
export function renderInventory(category, records, invIdxByRef) {
  if (category === 'weapons') {
    // Clear all weapon-type body tables.
    const tbodies = document.querySelectorAll('table.inv-table[data-category="weapons"] tbody');
    for (const tbody of tbodies) tbody.innerHTML = '';

    // Distribute each record to its correct type table.
    for (const rec of records) {
      const typeId = getWeaponTypeId(rec.itemId);
      const tbody = document.querySelector(
        `table.inv-table[data-category="weapons"][data-weapon-type="${typeId}"] tbody`,
      );
      if (tbody) {
        tbody.appendChild(makeInventoryRow(category, rec, null, invIdxByRef));
      } else {
        // Fallback: type table not found — add to type 1
        const fallback = document.querySelector(
          'table.inv-table[data-category="weapons"][data-weapon-type="1"] tbody',
        );
        if (fallback) fallback.appendChild(makeInventoryRow(category, rec, null, invIdxByRef));
      }
    }
    return;
  }

  if (category === 'goods') {
    // Clear all goods-type body tables.
    const tbodies = document.querySelectorAll('table.inv-table[data-category="goods"] tbody');
    for (const tbody of tbodies) tbody.innerHTML = '';

    // Distribute each record to its correct type table.
    for (const rec of records) {
      const typeId = getGoodsTypeId(rec.itemId);
      const tbody = document.querySelector(
        `table.inv-table[data-category="goods"][data-goods-type="${typeId}"] tbody`,
      );
      if (tbody) {
        tbody.appendChild(makeInventoryRow(category, rec, null, invIdxByRef));
      } else {
        // Fallback: type table not found — add to type 9 (Ore)
        const fallback = document.querySelector(
          'table.inv-table[data-category="goods"][data-goods-type="9"] tbody',
        );
        if (fallback) fallback.appendChild(makeInventoryRow(category, rec, null, invIdxByRef));
      }
    }
    return;
  }

  const tbody = document.querySelector(`table.inv-table[data-category="${category}"] tbody`);
  if (!tbody) return;
  tbody.innerHTML = '';
  for (const rec of records) {
    tbody.appendChild(makeInventoryRow(category, rec, null, invIdxByRef));
  }
}

/**
 * Create a <tr> for an inventory record.
 *
 * Visible columns vary by category:
 *   weapons: Name | Count | Class | Class Idx | Durability | Del
 *   armor:   Name | Count | Durability | Del
 *   goods:   Name | Count | Item Type | Durability | Del
 * (Rings use the same makeInventoryRow flow as other categories.)
 *
 * Hidden fields (misc1 for armor/rings, misc2 for all) are stored as data
 * attributes on the <tr> so they survive the DOM round-trip.  Weapons
 * expose misc1 as split Class hi-byte + Class Idx lo-byte.
 *
 * idx1/idx2 are NOT stored in the DOM — they are binary-internal fields
 * stripped by sanitizeModel and restored by mergeModel via _ref lookup.
 * New items added via the UI have no _ref → mergeModel leaves idx1/idx2
 * undefined → the writer assigns them (global max + 1).
 *
 * The `data-existing` attribute is set to "true" for items loaded from the
 * save file (have a `_ref`) and "false" for user-inserted items. This drives
 * the soft-delete vs. hard-delete behavior in the delete button.
 *
 * @param {'weapons'|'armor'|'rings'|'goods'} category
 * @param {Record<string, any>} rec  {itemId, count, misc1, misc2, durability}
 */
export function makeInventoryRow(category, rec, typeIdHint = null, invIdxByRef) {
  const { ids, names } = getCategoryData(category);
  const layout = MISC1_LAYOUT[category];
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

  // Store opaque _ref token for write-back matching
  tr.dataset.ref = rec._ref || '';
  // Track whether this row is an existing item (from save file) or a new
  // user-inserted item. Existing items have a non-empty _ref; new items
  // have _ref=''. This determines soft-delete vs. hard-delete behavior.
  const isExisting = !!rec._ref;
  tr.dataset.existing = String(isExisting);
  // Mark new rows with a distinct visual indicator (green left border)
  if (!isExisting) {
    tr.classList.add('row-added');
  }

  // Item name <select>
  const tdName = document.createElement('td');
  const sel = document.createElement('select');
  sel.className = 'inv-name';
  if (!isExisting) {
    prependPlaceholder(sel);
  }
  // Track previous item ID for equipment-slot live-sync (setupEquipmentSync).
  if (rec.itemId !== undefined) {
    sel.dataset.prevId = String(rec.itemId);
  }
  // Store instance index for deterministic equipment binding.
  // idx1 comes from display-only data (invIdxByRef), keyed by _ref.
  if (invIdxByRef && rec._ref) {
    const idx1 = invIdxByRef.get(rec._ref);
    if (idx1 !== undefined) {
      sel.dataset.roIdx1 = String(idx1);
    }
  }

  // Lazy-load: render only the currently-selected item's display option.
  // Full option list is populated on first user interaction (setupLazySelects).
  sel.dataset.lazyCat = category;

  // Set a fixed width so the select fits the longest item in its list,
  // even before the lazy-load fires.
  applyItemSelectWidth(sel, category, rowTypeId);

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
      sel.appendChild(opt);
      matched = true;
    }
  }

  // Handle unknown item IDs not in the database
  if (!matched && rec.itemId !== undefined && rec.itemId !== 0) {
    const opt = document.createElement('option');
    opt.value = rec.itemId;
    opt.textContent = formatUnknownItem(rec.itemId);
    opt.selected = true;
    sel.appendChild(opt);
  }

  // Set note-based tooltip for the currently-selected item.
  if (rec.itemId) {
    updateSelectTooltip(sel, getItemNote(category, rec.itemId));
  }

  tdName.appendChild(sel);
  tr.appendChild(tdName);

  // Weapons & Armor: full editable row — [Count], Class, Class Idx, DUR, Del
  // (misc2 hidden from UI — preserved via dataset for round-trip;
  //  idx1/idx2 are NOT in the DOM — restored by mergeModel via _ref)
  // Count is hidden for non-counted types (Weapon/Shield/Bow/Casting Tool/Armor).
  // The count is preserved losslessly via a hidden input so the writer still
  // receives the original value (typically 1).
  if (category === 'weapons' || category === 'armor') {
    tr.appendChild(makeCountCell('inv-count', rec.count, showCount, rowTypeId === 4));
    // Hidden field — preserved via dataset for round-trip fidelity
    tr.dataset.misc2 = String(rec.misc2 ?? 0);
    tr.appendChild(makeNumCell('inv-misc1hi', (rec.misc1 >> 8) & 0xff));
    tr.appendChild(makeNumCell('inv-misc1lo', rec.misc1 & 0xff));
    if (showDurability) {
      tr.appendChild(makeNumCell('inv-durability', rec.durability));
    } else {
      tr.dataset.durability = String(rec.durability ?? 0);
    }
    const tdDel = document.createElement('td');
    tdDel.appendChild(makeRowDeleteButton(tr));
    tr.appendChild(tdDel);
    return tr;
  }

  // Rings & Goods: full editable row — [Count], Ring Slot/Item Type, DUR, Del
  // (misc2 hidden from UI — preserved via dataset for round-trip;
  //  idx1/idx2 are NOT in the DOM — restored by mergeModel via _ref)
  // Count is hidden for non-counted types (Rings).
  if (category === 'rings' || category === 'goods') {
    tr.appendChild(makeCountCell('inv-count', rec.count, showCount, false));
    // Hidden field — preserved via dataset for round-trip fidelity
    tr.dataset.misc2 = String(rec.misc2 ?? 0);
    tr.appendChild(makeNumCell(layout.singleClass, rec.misc1));
    if (showDurability) {
      tr.appendChild(makeNumCell('inv-durability', rec.durability));
    } else {
      tr.dataset.durability = String(rec.durability ?? 0);
    }
    const tdDel = document.createElement('td');
    tdDel.appendChild(makeRowDeleteButton(tr));
    tr.appendChild(tdDel);
    return tr;
  }

  // Unknown category — programming error. All valid categories
  // (weapons, armor, rings, goods) are handled by the branches above.
  throw new Error(`makeInventoryRow: unsupported category "${category}"`);
}

/**
 * Collect inventory records from a category table.
 *
 * Soft-deleted rows (data-deleted="true") are skipped — their data is
 * excluded from the model so the writer clears their physical slots.
 *
 * Reassembles misc1 from visible inputs or hidden data attributes.
 * @param {'weapons'|'armor'|'rings'|'goods'} category
 * @returns {Array}
 */
export function collectInventory(category) {
  // Weapons and goods span multiple per-type tables — collect from all of them.
  // Other categories use a single table.
  const tbodies =
    category === 'weapons' || category === 'goods'
      ? document.querySelectorAll(`table.inv-table[data-category="${category}"] tbody`)
      : [document.querySelector(`table.inv-table[data-category="${category}"] tbody`)];
  const layout = MISC1_LAYOUT[category];
  const records = [];
  for (const tbody of tbodies) {
    if (!tbody) continue;
    for (const tr of tbody.querySelectorAll('tr')) {
      // Skip soft-deleted rows — they are excluded from the saved model
      if (tr.dataset.deleted === 'true') continue;

      // Cache DOM lookups per row to avoid repeated querySelector calls
      const nameSel = /** @type {HTMLSelectElement|null} */ (tr.querySelector('.inv-name'));
      // Skip unselected new rows (placeholder still active)
      if (!nameSel?.value) continue;

      // Cache DOM lookups per row to avoid repeated querySelector calls
      let misc1;
      if (layout.split) {
        const hiInput = /** @type {HTMLInputElement|null} */ (
          tr.querySelector(`.${layout.hiClass}`)
        );
        const loInput = /** @type {HTMLInputElement|null} */ (
          tr.querySelector(`.${layout.loClass}`)
        );
        const hi = parseInt(hiInput?.value ?? '', 10) || 0;
        const lo = parseInt(loInput?.value ?? '', 10) || 0;
        misc1 = ((hi & 0xff) << 8) | (lo & 0xff);
      } else {
        // 'single' layout (rings/goods)
        const misc1Input = /** @type {HTMLInputElement|null} */ (
          tr.querySelector(`.${layout.singleClass}`)
        );
        misc1 = parseInt(misc1Input?.value ?? '', 10) || 0;
      }
      const durInput = /** @type {HTMLInputElement|null} */ (tr.querySelector('.inv-durability'));
      const countInput = /** @type {HTMLInputElement|null} */ (tr.querySelector('.inv-count'));
      const rec = {
        _ref: tr.dataset.ref || '',
        itemId: parseInt(nameSel.value, 10) || 0,
        // Count may be hidden (non-counted types) — default to 1 when absent.
        count: parseCountValue(countInput, COUNT_LIMITS.inventory.min),
        misc1,
        durability: parseInt(durInput?.value ?? tr.dataset.durability, 10) || 0,
      };
      // misc2 is hidden (read from dataset).  idx1/idx2 are NOT collected
      // here — they are binary-internal, restored by mergeModel via _ref.
      rec.misc2 = parseInt(tr.dataset.misc2, 10) || 0;
      records.push(rec);
    }
  }
  return records;
}
