/**
 * select-helpers.js — SVG icons, lazy-load dropdown population, duplicate
 * prevention filtering, and row delete/restore buttons.
 */

import {
  getCategoryData,
  getSpellData,
  getWeaponTypeData,
  getGoodsTypeData,
  getWeaponTypeDataForDeposit,
  isCountVisible,
} from '../core/controls.js';
import { onRowRemoved, onRowSoftDeleted, onRowUndeleted } from '../core/dirty.js';
import {
  setEquipmentText,
  EQ_CATEGORY,
  EQ_IDS,
  refreshEquipmentForItems,
} from '../core/dom-helpers.js';

/* --- SVG icons --- */

/**
 * Create a trash icon SVG element for row delete buttons.
 * @returns {SVGSVGElement}
 */
export function trashIconSvg() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.5');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  const paths = [
    'M4 7h16',
    'M10 11v6',
    'M14 11v6',
    'M5 7l1 13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-13',
    'M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3',
  ];
  for (const d of paths) {
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', d);
    svg.appendChild(path);
  }
  return svg;
}

/**
 * Create a restore (undo) icon SVG element for row undelete buttons.
 * @returns {SVGSVGElement}
 */
export function restoreIconSvg() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.5');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  const paths = ['M3 12a9 9 0 1 0 3-6.7', 'M3 4v4h4'];
  for (const d of paths) {
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', d);
    svg.appendChild(path);
  }
  return svg;
}

/**
 * Create a dismiss (✕) icon SVG element for new-row delete buttons.
 *
 * Visually distinct from the trash can — signals that the action is a
 * permanent discard (hard delete) with no recovery, as opposed to the
 * recoverable soft-delete on existing rows.
 * @returns {SVGSVGElement}
 */
export function dismissIconSvg() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.5');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  const paths = ['M6 6l12 12', 'M18 6L6 18'];
  for (const d of paths) {
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', d);
    svg.appendChild(path);
  }
  return svg;
}

/* --- Placeholder + lazy-load dropdown population --- */

/**
 * Prepend a placeholder option to a <select> for new (user-inserted) rows.
 *
 * The placeholder has an empty value so collectForm can detect and skip
 * unselected rows. It is disabled + hidden so users can't re-select it
 * after choosing a real item, and it doesn't clutter the dropdown list.
 *
 * @param {HTMLSelectElement} sel
 */
export function prependPlaceholder(sel) {
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = '— Select —';
  placeholder.disabled = true;
  placeholder.hidden = true;
  placeholder.selected = true;
  sel.appendChild(placeholder);
}

/**
 * CSS classes that identify lazy-loadable selects in right-side tab groups.
 * (Left-panel selects — hairstyle, startClass, warpLocation — are small and
 * populated eagerly by populateCombos().)
 */
const LAZY_SELECT_CLASSES = ['inv-name', 'dep-name', 'spell-name'];

/**
 * Fully populate a lazy-load <select> with all item options.
 *
 * Right-side tab-group selects (inventory, spells, deposit) render only the
 * currently-selected item's <option> at row-creation time.  This function
 * fills in the complete option list on the first user interaction (mousedown
 * or focus), then sets a flag so subsequent triggers are no-ops.
 *
 * Preserves the current selection, placeholder (for new rows), and any
 * "Unknown (0x…)" option for item IDs not present in the game database.
 *
 * @param {HTMLSelectElement} sel
 */
export function ensureSelectPopulated(sel) {
  if (sel.dataset.lazyLoaded === 'true') return;
  sel.dataset.lazyLoaded = 'true';

  // Determine the data source from the select's class / dataset.
  let ids, names;
  if (sel.classList.contains('spell-name')) {
    ({ ids, names } = getSpellData());
  } else if (sel.dataset.lazyCat === 'weapons') {
    // Weapon selects are type-filtered.  The weapon type may be stored
    // directly on the select (data-weapon-type) or inherited from the
    // parent table element (looked up at interaction time, since the
    // select may not have been in the DOM during row creation).
    let weaponTypeId = sel.dataset.weaponType;
    if (!weaponTypeId) {
      const parentTable = /** @type {HTMLElement|null} */ (sel.closest('table[data-weapon-type]'));
      weaponTypeId = parentTable?.dataset.weaponType;
    }
    if (weaponTypeId) {
      // Deposit dropdowns exclude sub_type 0 ("Experimental") items.
      const dataGetter = sel.classList.contains('dep-name')
        ? getWeaponTypeDataForDeposit
        : getWeaponTypeData;
      ({ ids, names } = dataGetter(Number(weaponTypeId)));
    } else {
      ({ ids, names } = getCategoryData('weapons'));
    }
  } else if (sel.dataset.lazyCat === 'goods') {
    // Goods selects are type-filtered (same pattern as weapons).
    let goodsTypeId = sel.dataset.goodsType;
    if (!goodsTypeId) {
      const parentTable = /** @type {HTMLElement|null} */ (sel.closest('table[data-goods-type]'));
      goodsTypeId = parentTable?.dataset.goodsType;
    }
    if (goodsTypeId) {
      ({ ids, names } = getGoodsTypeData(Number(goodsTypeId)));
    } else {
      ({ ids, names } = getCategoryData('goods'));
    }
  } else {
    ({ ids, names } = getCategoryData(sel.dataset.lazyCat || ''));
  }

  // Preserve current value and its display text (for unknown items).
  const currentValue = sel.value;
  const prevSelectedOpt = sel.selectedOptions[0];
  const prevText = prevSelectedOpt?.textContent;

  // Preserve placeholder if present (new rows with no selection yet).
  const placeholder = sel.querySelector('option[value=""]');

  // Rebuild the full option list.
  sel.innerHTML = '';
  if (placeholder) sel.appendChild(placeholder);
  for (let i = 0; i < names.length; i++) {
    const opt = document.createElement('option');
    opt.value = String(ids[i]);
    opt.textContent = names[i];
    sel.appendChild(opt);
  }

  // If the current value is not among the standard options (unknown item),
  // re-add the preserved option so the selection survives.
  if (currentValue && !Array.from(sel.options).some((o) => o.value === currentValue)) {
    const opt = document.createElement('option');
    opt.value = currentValue;
    opt.textContent =
      prevText || `Unknown (0x${(parseInt(currentValue, 10) >>> 0).toString(16).toUpperCase()})`;
    sel.appendChild(opt);
  }

  // Restore selection.
  sel.value = currentValue;
}

/* --- Duplicate-prevention filtering --- */

/**
 * Collect the set of item IDs already used by rows in the same table as
 * the given select — including soft-deleted rows.
 *
 * For show-count types (Ammo, Ore, Consumables, Souls, Key Items), these
 * IDs are excluded from the dropdown to prevent duplicate entries.
 * Soft-deleted rows are included so their items stay hidden from sibling
 * dropdowns — the user should undelete (cancel) rather than re-add.
 *
 * @param {HTMLSelectElement} sel  the item-name select being filtered
 * @returns {Set<string>}  set of used item ID strings
 */
export function getActiveItemIdsInTable(sel) {
  const tbody = sel.closest('tbody');
  if (!tbody) return new Set();
  const usedIds = new Set();
  for (const tr of tbody.querySelectorAll('tr')) {
    // Find the item-name select in this row.
    const rowSel = /** @type {HTMLSelectElement|null} */ (tr.querySelector('.inv-name, .dep-name'));
    if (!rowSel) continue;
    // Skip placeholder rows (no selection yet).
    if (!rowSel.value) continue;
    // Skip the select's own row — the currently-selected item should
    // always remain visible in its own dropdown.
    if (rowSel === sel) continue;
    // Include soft-deleted rows — their items should NOT be re-addable.
    usedIds.add(rowSel.value);
  }
  return usedIds;
}

/**
 * Determine the des-db category and type ID for a given select element.
 *
 * @param {HTMLSelectElement} sel
 * @returns {{category: string|null, typeId: number|null}}
 */
export function getSelectCategoryAndType(sel) {
  const category = sel.dataset.lazyCat || null;
  if (!category) return { category: null, typeId: null };
  let typeId = null;
  // Check data-weapon-type on the select itself or its parent table.
  let rawType = sel.dataset.weaponType;
  if (!rawType) {
    const tbl = /** @type {HTMLElement|null} */ (sel.closest('table[data-weapon-type]'));
    rawType = tbl?.dataset.weaponType;
  }
  if (rawType) typeId = Number(rawType);
  // Check data-goods-type on the select itself or its parent table.
  if (typeId === null || isNaN(typeId)) {
    rawType = sel.dataset.goodsType;
    if (!rawType) {
      const tbl = /** @type {HTMLElement|null} */ (sel.closest('table[data-goods-type]'));
      rawType = tbl?.dataset.goodsType;
    }
    if (rawType) typeId = Number(rawType);
  }
  return { category, typeId: typeId != null && !isNaN(typeId) ? typeId : null };
}

/**
 * Toggle `disabled` on options in a select based on whether their item
 * IDs are already used by other active rows in the same table.
 *
 * Used items are greyed out (disabled) rather than removed from the
 * dropdown.  This keeps them visible so users can see what's already
 * owned — consistent behavior across Chrome (Blink) and Linux Tauri
 * (WebKitGTK).  The `hidden` attribute is intentionally NOT used
 * because WebKitGTK's native select popup ignores it, which would
 * cause cross-platform inconsistency.
 *
 * Called after lazy-load population and after any item selection change
 * in a show-count type table, keeping all sibling dropdowns in sync.
 *
 * @param {HTMLSelectElement} sel  the item-name select to filter
 */
export function refreshFilteredOptions(sel) {
  // Only filter selects that belong to show-count types.
  const { category, typeId } = getSelectCategoryAndType(sel);
  if (category === null) return;
  if (isCountVisible(category, typeId)) {
    const usedIds = getActiveItemIdsInTable(sel);
    for (const opt of sel.options) {
      // Never disable the placeholder (empty value) or the currently-selected option.
      if (!opt.value) continue;
      if (opt.value === sel.value) {
        opt.disabled = false;
        continue;
      }
      opt.disabled = usedIds.has(opt.value);
    }
  }
}

/**
 * Refresh filtered options for all item-name selects in the same table
 * as the given select.  Called after a selection changes so sibling
 * dropdowns immediately reflect the newly-used (or freed) item ID.
 *
 * @param {HTMLSelectElement} changedSel
 */
export function refreshFilteredOptionsInTable(changedSel) {
  const tbody = changedSel.closest('tbody');
  if (!tbody) return;
  for (const s of /** @type {NodeListOf<HTMLSelectElement>} */ (
    tbody.querySelectorAll('select.inv-name, select.dep-name')
  )) {
    if (s.dataset.lazyLoaded === 'true') {
      refreshFilteredOptions(s);
    }
  }
}

/**
 * Resolve duplicate items that arise when undeleting a counted-type row.
 *
 * When a row is soft-deleted, its item select reverts to the original value.
 * If another row (new or existing) was edited to the same item ID while the
 * original was changed or deleted, undeleting creates a duplicate.
 *
 * This function finds active rows in the same table whose item ID matches
 * the just-undeleted row and resolves them:
 *   - New row (data-existing="false")    → hard-delete (remove from DOM)
 *   - Existing row (data-existing="true") → auto soft-delete via
 *     softDeleteRow(), which reverts fields and updates dirty/equipment state
 *
 * Only applies to counted types (Ammo, Ore, Consumables, Souls, Key Items)
 * where duplicates are disallowed.  Non-counted types (Weapon, Shield, Bow,
 * Casting Tool, Armor, Ring) allow duplicates by design.
 *
 * @param {HTMLTableRowElement} undeletedTr  the row that was just undeleted
 * @returns {boolean}  true if any rows were removed or soft-deleted
 */
export function resolveDuplicateOnUndelete(undeletedTr) {
  const sel = /** @type {HTMLSelectElement|null} */ (
    undeletedTr.querySelector('.inv-name, .dep-name')
  );
  if (!sel || !sel.value) return false;

  // Only apply duplicate resolution for counted types
  const { category, typeId } = getSelectCategoryAndType(sel);
  if (category === null) return false;
  if (!isCountVisible(category, typeId)) return false;

  const itemId = sel.value;
  const tbody = undeletedTr.closest('tbody');
  if (!tbody) return false;

  let changed = false;
  for (const otherTr of tbody.querySelectorAll('tr')) {
    if (otherTr === undeletedTr) continue;
    // Skip already-deleted rows
    if (otherTr.dataset.deleted === 'true') continue;
    const otherSel = /** @type {HTMLSelectElement|null} */ (
      otherTr.querySelector('.inv-name, .dep-name')
    );
    if (!otherSel || !otherSel.value) continue; // skip placeholder
    if (otherSel.value !== itemId) continue; // not a duplicate

    // Duplicate found — resolve based on row type
    if (otherTr.dataset.existing === 'false') {
      // New (user-inserted) row — hard delete, no on-disk counterpart
      onRowRemoved(otherTr);
      otherTr.remove();
    } else {
      // Existing row — auto soft-delete (reuses the full soft-delete logic:
      // field reversion, dirty tracking, equipment and dropdown refresh).
      softDeleteRow(otherTr);
    }
    changed = true;
  }
  return changed;
}

/**
 * Attach delegated listeners that trigger lazy population of right-side
 * tab-group selects on first user interaction.
 *
 * Uses both `mousedown` (primary — fires before the dropdown opens on click)
 * and `focusin` (fallback — for keyboard Tab navigation; `focusin` bubbles,
 * unlike `focus`, so delegated listening works).  Event delegation
 * on `#app` ensures dynamically-created rows are covered.
 *
 * After population, applies duplicate-prevention filtering for show-count
 * types (hides already-used item IDs from the dropdown).
 */
export function setupLazySelects() {
  const root = document.getElementById('app') || document.body;

  // Guard against double-init: mark the #app element itself.  In
  // production, #app persists across buildPage() calls (only innerHTML
  // is cleared, not attributes), so the marker prevents stacked
  // listeners.  In tests, a fresh #app element won't have the marker,
  // so listeners attach correctly each time.
  if (root.dataset.lazySelectsInit === 'true') return;
  root.dataset.lazySelectsInit = 'true';

  /** @param {Event} e */
  const handler = (e) => {
    const sel = e.target;
    if (!(sel instanceof HTMLSelectElement)) return;
    for (const cls of LAZY_SELECT_CLASSES) {
      if (sel.classList.contains(cls)) {
        ensureSelectPopulated(sel);
        // Apply duplicate-prevention filtering after population.
        refreshFilteredOptions(sel);
        return;
      }
    }
  };

  root.addEventListener('mousedown', handler);
  root.addEventListener('focusin', handler);
}

/* --- Row delete / restore button --- */

/**
 * Soft-delete an existing table row.
 *
 * Reverts all editable fields to their baseline (data-orig), disables
 * inputs, updates visual state (greyed out + restore icon), notifies the
 * dirty tracker, syncs equipment slots, and refreshes sibling dropdowns.
 *
 * Called directly by resolveDuplicateOnUndelete to reuse the full
 * soft-delete logic without simulating a DOM click.
 *
 * @param {HTMLTableRowElement} tr  the row to soft-delete
 */
function softDeleteRow(tr) {
  tr.dataset.deleted = 'true';
  tr.classList.add('row-deleted');
  // Swap the delete button to a restore icon.
  const btn = tr.querySelector('.row-del');
  if (btn) {
    btn.classList.add('row-restore');
    btn.setAttribute('aria-label', 'Undo delete');
    btn.replaceChildren(restoreIconSvg());
  }
  // Restore original values + clear dirty marks + disable.
  // The data-orig baseline is captured by captureBaseline() right
  // after populateForm(), so this reverts any pre-delete edits.
  /** @type {NodeListOf<HTMLInputElement | HTMLSelectElement>} */ (
    tr.querySelectorAll('input, select')
  ).forEach((el) => {
    if (el.dataset.orig !== undefined) {
      if (el.type === 'checkbox') {
        el.checked = el.dataset.orig === 'true';
      } else {
        el.value = el.dataset.orig;
      }
      // Keep data-prev-id in sync for the equipment change-listener.
      if (el.classList.contains('inv-name')) {
        el.dataset.prevId = el.dataset.orig;
      }
    }
    el.classList.remove('dirty');
    el.disabled = true;
  });

  // Revert equipment spans that the change-listener may have updated.
  // When the user changed the item type before deleting, the listener
  // updated matching equipment spans to the new item.  Now that we've
  // reverted the inventory select to its original, we must also revert
  // those spans so refreshEquipmentDisplay() sees the correct state.
  const _origSel = /** @type {HTMLSelectElement|null} */ (tr.querySelector('.inv-name'));
  const _origItemId = _origSel?.dataset.orig;
  const _origIdx1 = _origSel?.dataset.roIdx1;
  if (_origItemId) {
    for (const eqId of EQ_IDS) {
      const span = document.getElementById(eqId);
      if (!span) continue;
      // Match by (origId, origIdx1) pair when possible, else by origId only.
      // If this span's original matches the inventory item's original
      // instance, but its current id was changed to something else.
      const origMatches = _origIdx1
        ? span.dataset.origId === _origItemId && span.dataset.roIdx1 === _origIdx1
        : span.dataset.origId === _origItemId;
      if (origMatches && span.dataset.id !== _origItemId) {
        setEquipmentText(
          eqId,
          parseInt(_origItemId, 10),
          /** @type {Record<string, string>} */ (EQ_CATEGORY)[eqId],
        );
      }
    }
  }

  // Notify dirty tracker: row soft-deleted (after cell values reverted)
  onRowSoftDeleted(tr);
  // Sync equipment slots — use targeted refresh (only checks slots that
  // may show this item) instead of a full inventory scan.
  const _delSel = /** @type {HTMLSelectElement|null} */ (tr.querySelector('.inv-name'));
  const _delItemId = _delSel?.dataset.orig || _delSel?.value;
  const _delIdx1 = _delSel?.dataset.roIdx1 || null;
  if (_delItemId) {
    refreshEquipmentForItems([{ itemId: _delItemId, idx1: _delIdx1, action: 'delete' }]);
  }
  // Refresh sibling dropdowns — soft-deleted items stay hidden from
  // dropdowns (included in used-IDs set) so they can't be re-added.
  const _deleteSel = /** @type {HTMLSelectElement|null} */ (
    tr.querySelector('.inv-name, .dep-name')
  );
  if (_deleteSel) refreshFilteredOptionsInTable(_deleteSel);
}

/**
 * Create a delete/restore toggle button for a table row.
 *
 * Behavior depends on whether the row is an existing item or a new
 * (user-inserted) one, determined from `tr.dataset.existing`:
 *
 *   - Existing row: click soft-deletes the row (greyed out, inputs
 *     disabled). Clicking again (on the restore icon) undeletes it.
 *     Soft-deleted rows are skipped by collectForm() and cleared by
 *     the writer via deletedSlots.  Shows a **trash** icon (recoverable).
 *
 *   - New row: click removes the row entirely (hard delete). New
 *     items have no on-disk counterpart, so there is nothing to
 *     recover — clean removal is safe.  Shows a **dismiss (✕)** icon
 *     (permanent discard) to distinguish from the recoverable trash.
 *
 * @param {HTMLTableRowElement} tr  the row this button belongs to
 * @returns {HTMLButtonElement}
 */

/**
 * Idempotent guard for the delegated row-delete click handler.
 * Set to true after the listener is attached to prevent duplicates.
 */
let _rowDeleteHandlerInit = false;

/**
 * Attach a single delegated click listener on `document` for all `.row-del`
 * buttons.  A single handler reads row context at event time, instead of
 * per-row closures (~200 for a typical save).
 *
 * Called lazily from `makeRowDeleteButton()` — the guard ensures the
 * listener is attached exactly once.
 */
function setupRowDeleteHandler() {
  if (_rowDeleteHandlerInit) return;
  _rowDeleteHandlerInit = true;

  document.addEventListener('click', (e) => {
    const btn = /** @type {Element} */ (e.target).closest('.row-del');
    if (!btn) return;

    const tr = btn.closest('tr');
    if (!tr) return;

    const isExisting = tr.dataset.existing === 'true';

    if (!isExisting) {
      // New (inserted) row — hard delete (no recovery needed)
      onRowRemoved(tr);
      tr.remove();
      return;
    }

    // Existing row — toggle soft-delete state
    const isDeleted = tr.dataset.deleted === 'true';
    if (isDeleted) {
      // Undelete: restore editability and visual state
      delete tr.dataset.deleted;
      tr.classList.remove('row-deleted');
      btn.classList.remove('row-restore');
      btn.setAttribute('aria-label', 'Delete row');
      btn.replaceChildren(trashIconSvg());
      // Re-enable all editable elements in the row
      /** @type {NodeListOf<HTMLInputElement | HTMLSelectElement>} */ (
        tr.querySelectorAll('input, select')
      ).forEach((el) => {
        el.disabled = false;
      });
      // Notify dirty tracker: row restored
      onRowUndeleted(tr);
      // Sync equipment slots — use targeted refresh for the undeleted item
      // instead of a full inventory scan.
      const _undSel = /** @type {HTMLSelectElement|null} */ (tr.querySelector('.inv-name'));
      const _undItemId = _undSel?.dataset.orig || _undSel?.value;
      const _undIdx1 = _undSel?.dataset.roIdx1 || null;
      if (_undItemId) {
        refreshEquipmentForItems([{ itemId: _undItemId, idx1: _undIdx1, action: 'undelete' }]);
      }
      // Refresh sibling dropdowns — the undeleted row's item is now "used"
      // again and should be hidden from other rows' dropdowns.
      const _undeleteSel = /** @type {HTMLSelectElement|null} */ (
        tr.querySelector('.inv-name, .dep-name')
      );
      if (_undeleteSel) refreshFilteredOptionsInTable(_undeleteSel);
      // Resolve duplicates: soft-delete reverts the item select to its
      // original value. If another row was edited to the same item ID while
      // this row was changed/deleted, undeleting creates a duplicate.
      // Hard-delete new rows; auto soft-delete existing rows.
      if (resolveDuplicateOnUndelete(tr)) {
        // Rows were removed or soft-deleted — softDeleteRow already
        // called refreshEquipmentForItems internally, so just refresh
        // the dropdowns to reflect the updated table state.
        if (_undeleteSel) refreshFilteredOptionsInTable(_undeleteSel);
      }
    } else {
      // Soft-delete the row (reverts fields, disables inputs, syncs state).
      softDeleteRow(tr);
    }
  });
}

/**
 * @param {HTMLTableRowElement} tr  the row this button belongs to
 * @returns {HTMLButtonElement}
 */
export function makeRowDeleteButton(tr) {
  // Ensure the delegated click handler is attached (idempotent).
  setupRowDeleteHandler();

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'row-del';
  const isExisting = tr.dataset.existing === 'true';
  btn.setAttribute('aria-label', isExisting ? 'Delete row' : 'Discard new row');
  btn.appendChild(isExisting ? trashIconSvg() : dismissIconSvg());

  return btn;
}
