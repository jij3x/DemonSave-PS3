/**
 * dom-helpers.js — Low-level DOM utilities, equipment display, and shared
 * table-cell builders.
 *
 * These are the foundational helpers used by all table-rendering and
 * form-handling modules.
 */

import * as db from '../../des-db/index.js';
import { registerChangeHandler } from './event-dispatcher.js';
import { formatUnknownItem } from './item-helpers.js';
import { COUNT_LIMITS } from './controls.js';

/**
 * Map an equipment element id to the des-db category used for name lookup.
 * @type {Record<string, string>}
 */
export const EQ_CATEGORY = {
  leftHand1: 'weapons',
  rightHand1: 'weapons',
  leftHand2: 'weapons',
  rightHand2: 'weapons',
  arrows: 'weapons',
  bolts: 'weapons',
  helmet: 'armor',
  chest: 'armor',
  gauntlets: 'armor',
  leggings: 'armor',
  ring1: 'rings',
  ring2: 'rings',
  quickSlot1: 'goods',
  quickSlot2: 'goods',
  quickSlot3: 'goods',
  quickSlot4: 'goods',
  quickSlot5: 'goods',
};

/**
 * All equipment slot element IDs.  Shared across modules to avoid
 * duplicating the list.
 */
export const EQ_IDS = [
  'leftHand1',
  'rightHand1',
  'leftHand2',
  'rightHand2',
  'arrows',
  'bolts',
  'helmet',
  'chest',
  'gauntlets',
  'leggings',
  'ring1',
  'ring2',
  'quickSlot1',
  'quickSlot2',
  'quickSlot3',
  'quickSlot4',
  'quickSlot5',
];

/* --- Basic DOM accessors --- */

/**
 * Shorthand for `document.getElementById(id)`.
 * @param {string} id
 * @returns {HTMLElement|null}
 */
export function $(id) {
  return document.getElementById(id);
}

/**
 * Set the value (or checked state for checkboxes) of an element by ID.
 * @param {string} id
 * @param {*} val
 */
export function setVal(id, val) {
  const el = $(id);
  if (!el) return;
  const input = /** @type {HTMLInputElement} */ (el);
  if (input.type === 'checkbox') input.checked = !!val;
  else input.value = String(val);
}

/**
 * Get the value (or checked state for checkboxes) of an element by ID.
 * @param {string} id
 * @returns {*}
 */
export function getVal(id) {
  const el = $(id);
  if (!el) return undefined;
  const input = /** @type {HTMLInputElement} */ (el);
  if (input.type === 'checkbox') return input.checked;
  return input.value;
}

/**
 * Get the numeric value of an element by ID.  Returns 0 for missing,
 * empty, or non-numeric values.
 * @param {string} id
 * @returns {number}
 */
export function getNum(id) {
  const v = getVal(id);
  if (v === undefined || v === '') return 0;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

/**
 * Read the raw unsigned 32-bit item ID from an equipment text span's
 * data-id attribute.  Returns 0 if the element or attribute is missing.
 * @param {string} id  element id of the <span>
 * @returns {number}
 */
export function getEqId(id) {
  const span = $(id);
  if (!span) return 0;
  const raw = parseInt(span.dataset.id ?? '', 10);
  return isNaN(raw) ? 0 : raw >>> 0;
}

/* --- Equipment display --- */

/**
 * Set an equipment read-only text span to a raw item ID.
 *
 * Displays the item's human-readable name from the des-db, while storing
 * the raw unsigned 32-bit ID in a `data-id` attribute for write-back.
 * Unrecognised values render as:
 *
 *   0xFFFFFFFF  → "(none)"
 *   other       → "Unknown (0xNNNNNNNN)"
 *
 * (Equipment is display-only — the raw ID is the only thing that needs to
 * survive the round-trip.)
 *
 * @param {string} id       element id of the <span>
 * @param {number} val      raw item id (unsigned 32-bit)
 * @param {string} category des-db category for name lookup
 * @param {boolean} [resetOrig]  when true, re-capture data-orig-id from
 *   this value (used by populateForm on slot switch so origId is not
 *   left stale from a previous slot)
 */
export function setEquipmentText(id, val, category, resetOrig = false) {
  const span = $(id);
  if (!span) return;
  const raw = val >>> 0;
  span.dataset.id = String(raw);
  // Track the original ID so refreshEquipmentDisplay() can restore
  // equipment slots after an undelete (item returns to inventory).
  // On slot switch (resetOrig=true) the baseline must be re-captured,
  // otherwise origId would be left stale from the previous slot.
  if (resetOrig || span.dataset.origId === undefined) {
    span.dataset.origId = String(raw);
  }
  let text;
  if (raw === 0xffffffff) {
    text = '(none)';
  } else if (db.hasItem(category, raw)) {
    text = db.getItem(category, raw).name;
  } else {
    text = formatUnknownItem(raw);
  }
  span.textContent = text;
  // Show a tooltip with the full text, but ONLY when the text is visually
  // truncated (overflowing the span's width).  The tooltip system checks
  // scrollWidth > clientWidth on hover before showing.
  span.setAttribute('data-tooltip', text);
  span.setAttribute('data-tooltip-if-truncated', 'true');
}

/**
 * Refresh equipment slot displays based on current inventory state.
 *
 * Scans all inventory tables for active (non-deleted, non-placeholder)
 * item IDs.  Then syncs each equipment span:
 *
 *   - data-id is in the inventory set    → keep as-is (item still exists)
 *   - data-id is NOT in the set          → clear to "(none)" (item deleted)
 *   - data-id is "(none)" but origId is
 *     back in the inventory              → restore (undelete)
 *
 * Called after soft-delete and undelete in the delete-button handler.
 *
 * **Debounced**: multiple calls within REFRESH_DEBOUNCE_MS (~1 frame at
 * 60fps) are coalesced into a single scan, avoiding redundant DOM queries
 * when delete/undelete/duplicate-resolution triggers fire in rapid
 * succession.  Use `.flush()` to force immediate execution (needed in
 * synchronous tests), or `.cancel()` to discard a pending call (used by
 * destroyApp).
 *
 * Performance: The underlying scan is O(rows + slots) — first scans all
 * inventory rows to build an ID set, then iterates 17 equipment slots.
 * For typical saves (~200 inventory items, 17 equipment slots), each scan
 * completes in microseconds.
 */
const REFRESH_DEBOUNCE_MS = 16; // ~1 frame at 60fps
/** @type {ReturnType<typeof setTimeout>|null} */
let _refreshTimer = null;

export function refreshEquipmentDisplay() {
  if (_refreshTimer !== null) clearTimeout(_refreshTimer);
  _refreshTimer = setTimeout(() => {
    _refreshTimer = null;
    _refreshEquipmentDisplayNow();
  }, REFRESH_DEBOUNCE_MS);
}

/**
 * Force immediate execution of any pending debounced refresh.
 * If no refresh is pending, this is a no-op.
 */
refreshEquipmentDisplay.flush = function flush() {
  if (_refreshTimer !== null) {
    clearTimeout(_refreshTimer);
    _refreshTimer = null;
    _refreshEquipmentDisplayNow();
  }
};

/**
 * Cancel any pending debounced refresh without executing it.
 * Called by destroyApp() to prevent stale timer callbacks after teardown.
 */
refreshEquipmentDisplay.cancel = function cancel() {
  if (_refreshTimer !== null) {
    clearTimeout(_refreshTimer);
    _refreshTimer = null;
  }
};

/**
 * Check whether a specific (itemId, idx1) pair still exists in a
 * non-deleted inventory row.
 *
 * Used by {@link refreshEquipmentForItems} to determine whether an
 * equipped item is still available after a soft-delete.
 *
 * @param {string} itemId  item ID string (from dataset/select value)
 * @param {string|null} [idx1]  instance index, or null for ID-only match
 * @returns {boolean}
 */
function isItemStillInInventory(itemId, idx1) {
  const invRows = /** @type {NodeListOf<HTMLElement>} */ (
    document.querySelectorAll('table.inv-table tbody tr')
  );
  for (const tr of invRows) {
    if (tr.dataset.deleted === 'true') continue;
    const sel = /** @type {HTMLSelectElement|null} */ (tr.querySelector('.inv-name'));
    if (!sel || sel.value !== itemId) continue;
    if (!idx1) return true; // ID-only match
    if (sel.dataset.roIdx1 === idx1) return true; // pair match
  }
  return false;
}

/**
 * Targeted equipment refresh — only check slots affected by the given
 * item changes, avoiding a full inventory scan.
 *
 * For each changed item, checks only the equipment slots that may be
 * affected (matching by itemId, and optionally by idx1 for instance-
 * specific binding).  This is O(changedItems × 17 slots) instead of
 * O(allRows + 17 slots).
 *
 * When an equipped item is actually deleted (a slot matches the deleted
 * item), a narrow scan is performed via {@link isItemStillInInventory}
 * to check whether a duplicate of the same item still exists.
 *
 * @param {Array<{itemId: string, idx1?: string|null, action: 'delete'|'undelete'}>} changedItems
 */
export function refreshEquipmentForItems(changedItems) {
  for (const { itemId, idx1, action } of changedItems) {
    for (const eqId of EQ_IDS) {
      const span = document.getElementById(eqId);
      if (!span) continue;

      if (action === 'delete') {
        // Check if this slot currently shows the deleted item.
        const curId = span.dataset.id;
        if (!curId || curId === '4294967295') continue;
        if (curId !== itemId) continue;
        // If idx1 is set, match by pair; else match by ID only.
        const curIdx1 = span.dataset.roIdx1;
        if (idx1 && curIdx1 && curIdx1 !== idx1) continue;
        // Verify the item is truly gone (no other non-deleted row has it).
        if (!isItemStillInInventory(itemId, idx1 || null)) {
          span.dataset.id = String(0xffffffff);
          span.textContent = '(none)';
          span.setAttribute('data-tooltip', '(none)');
        }
      } else {
        // action === 'undelete' — check if a "(none)" slot's original
        // item matches the one being restored.
        if (span.dataset.id !== '4294967295') continue;
        const origId = span.dataset.origId;
        if (!origId || origId === '4294967295' || origId !== itemId) continue;
        const origIdx1 = span.dataset.roIdx1;
        if (idx1 && origIdx1 && origIdx1 !== idx1) continue;
        // Restore the slot from the original item.
        const cat = EQ_CATEGORY[eqId];
        const raw = parseInt(origId, 10);
        span.dataset.id = origId;
        let text;
        if (db.hasItem(cat, raw)) {
          text = db.getItem(cat, raw).name;
        } else {
          text = formatUnknownItem(raw);
        }
        span.textContent = text;
        span.setAttribute('data-tooltip', text);
      }
    }
  }
}

function _refreshEquipmentDisplayNow() {
  // Collect all active (itemId, idx1) pairs from inventory tables.
  //
  // IMPORTANT: Item ID comparison is string-based throughout this function.
  // The save format uses unsigned 32-bit IDs (0 to 0xFFFFFFFF), but
  // JavaScript numbers are IEEE-754 doubles.  IDs ≥ 0x80000000 (2^31)
  // would sign-flip if parsed as signed 32-bit integers.  By comparing
  // the raw string representation (from select.value / dataset.id),
  // we avoid any parseInt sign-flip issues.  Do NOT convert these to
  // numbers for comparison purposes.
  const inventoryPairs = new Set(); // "itemId|idx1" strings
  const inventoryIds = new Set(); // itemId-only (fallback for rows without idx1)
  // Scan all inventory tables uniformly (weapons span multiple per-type tables).
  const invRows = /** @type {NodeListOf<HTMLElement>} */ (
    document.querySelectorAll('table.inv-table tbody tr')
  );
  for (const tr of invRows) {
    if (tr.dataset.deleted === 'true') continue;
    const sel = /** @type {HTMLSelectElement|null} */ (tr.querySelector('.inv-name'));
    if (!sel || !sel.value) continue; // skip placeholder rows
    inventoryIds.add(sel.value);
    const idx1 = sel.dataset.roIdx1;
    if (idx1) inventoryPairs.add(`${sel.value}|${idx1}`);
  }

  // Sync each equipment span.
  for (const eqId of EQ_IDS) {
    const span = document.getElementById(eqId);
    if (!span) continue;
    const curId = span.dataset.id;
    const origId = span.dataset.origId;

    if (curId && curId !== '4294967295') {
      // Currently showing an item — check if it's still in inventory.
      // Match by (itemId, idx1) pair when possible, else by itemId only.
      const curIdx1 = span.dataset.roIdx1;
      const pairKey = curIdx1 ? `${curId}|${curIdx1}` : null;
      const stillExists = pairKey ? inventoryPairs.has(pairKey) : inventoryIds.has(curId);
      if (!stillExists) {
        // Item was deleted or changed — clear the slot.
        span.dataset.id = String(0xffffffff);
        span.textContent = '(none)';
        span.setAttribute('data-tooltip', '(none)');
      }
    } else {
      // Currently "(none)" — check if the original item came back (undelete).
      const origIdx1 = span.dataset.roIdx1;
      const origPairKey = origIdx1 ? `${origId}|${origIdx1}` : null;
      const origStillExists = origPairKey
        ? inventoryPairs.has(origPairKey)
        : inventoryIds.has(origId);
      if (origId && origId !== '4294967295' && origStillExists) {
        const cat = EQ_CATEGORY[eqId];
        const raw = parseInt(origId, 10);
        span.dataset.id = origId;
        let text;
        if (db.hasItem(cat, raw)) {
          text = db.getItem(cat, raw).name;
        } else {
          text = formatUnknownItem(raw);
        }
        span.textContent = text;
        span.setAttribute('data-tooltip', text);
      }
    }
  }
}

/**
 * Attach a delegated change listener for inventory/spell item selects.
 *
 * When a user changes the item type in an inventory row, update any
 * equipment slot that was displaying the old item to show the new item.
 * Uses `data-prev-id` on each select to track the previous value.
 */
export function setupEquipmentSync() {
  registerChangeHandler((e) => {
    const sel = e.target;
    if (!(sel instanceof HTMLSelectElement)) return;
    if (!sel.classList.contains('inv-name')) return;

    const oldId = sel.dataset.prevId || '';
    const newId = sel.value;
    const rowIdx1 = sel.dataset.roIdx1 || '';
    sel.dataset.prevId = newId;

    // If old and new are the same (or old was empty), nothing to update.
    if (!oldId || oldId === newId) return;

    // Rows without roIdx1 (new user-added rows) can never be equipped,
    // so changing their item should never affect equipment slots.
    if (!rowIdx1) return;

    // Find equipment slots bound to THIS specific instance (by idx1)
    // showing the old item, and update them to show the new item.
    // Uses deterministic (itemId, idx1) pair matching — critical when
    // duplicate items exist (e.g. two Kilijs equipped in different slots).
    for (const eqId of EQ_IDS) {
      const span = document.getElementById(eqId);
      if (!span) continue;
      // Match by (itemId, idx1) pair — only update if both match.
      const matchesById = span.dataset.id === oldId;
      const matchesByIdx1 = span.dataset.roIdx1 === rowIdx1;
      if (matchesById && matchesByIdx1) {
        const cat = EQ_CATEGORY[eqId];
        const raw = parseInt(newId, 10) >>> 0;
        setEquipmentText(eqId, raw, cat);
      }
    }
  });
}

/* --- Shared table-cell builders --- */

/**
 * Helper: create a <td> containing a number <input> for the count field.
 *
 * When `visible` is false, the <td> is hidden (display:none via the hidden
 * attribute + CSS class) and its input is kept in the DOM so the writer
 * still receives the count value (lossless round-trip for non-counted types
 * like Weapon/Armor/Ring whose count is always 1 in practice).
 *
 * @param {string} cls  CSS class suffix (appended to 'inv-')
 * @param {number} val
 * @param {boolean} visible  whether the count cell should be visible
 * @param {boolean} [isAmmo=false]  when true, use the Ammo count range
 *   (1–999) instead of the default range for all other countable items
 *   (1–99).
 * @returns {HTMLTableCellElement}
 */
export function makeCountCell(cls, val, visible, isAmmo = false) {
  // NOTE: uses the exact class name (no 'inv-' prefix) so callers pass the
  // full class that collectInventory/collectDeposit query (e.g. 'inv-count'
  // or 'dep-count').
  const td = document.createElement('td');
  const inp = document.createElement('input');
  inp.type = 'number';
  inp.value = String(val ?? 0);
  inp.className = cls;
  // Set native min/max so the browser's number-input validation also
  // respects the limits (belt-and-suspenders alongside the JS clamp handler
  // in setupCountAndDuplicateSync). The JS handler still fires on 'input'
  // for immediate clamping during typing.
  //
  // Ammo (arrows/bolts) stacks up to 999; all other countable items
  // (Ore, Consumables, Souls, Key Items) are limited to 1–99.
  const isDeposit = cls.includes('dep');
  const limits = isAmmo
    ? COUNT_LIMITS.ammo
    : isDeposit
      ? COUNT_LIMITS.deposit
      : COUNT_LIMITS.inventory;
  inp.min = String(limits.min);
  inp.max = String(limits.max);
  td.appendChild(inp);
  if (!visible) {
    td.hidden = true;
    td.classList.add('count-hidden');
  }
  return td;
}

/**
 * Parse a count input's value, defaulting to 1 when the input is missing
 * (hidden count cell for non-counted types) or empty/invalid.
 *
 * @param {HTMLInputElement|null} inp
 * @param {number} defaultVal  fallback when the input is absent/empty
 * @returns {number}
 */
export function parseCountValue(inp, defaultVal) {
  if (!inp) return defaultVal;
  const raw = parseInt(inp.value, 10);
  if (isNaN(raw)) return defaultVal;
  return raw;
}

/**
 * Helper: create a <td> containing a number <input>.
 * @param {string} cls  full CSS class name (e.g. 'inv-durability')
 * @param {number} val
 * @returns {HTMLTableCellElement}
 */
export function makeNumCell(cls, val) {
  const td = document.createElement('td');
  const inp = document.createElement('input');
  inp.type = 'number';
  inp.value = String(val ?? 0);
  inp.className = cls;
  td.appendChild(inp);
  return td;
}
