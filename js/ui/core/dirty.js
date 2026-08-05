/**
 * dirty.js — Hierarchical dirty-state tracking for the editor UI.
 *
 * Uses an in-memory counter tree mirroring the tab hierarchy:
 *   root (slot-level)
 *   ├── charPanel tabs (Char., World, Warp)
 *   ├── editor tabs (Build, Inventory, Spells, Deposit)
 *   │   └── sub-tabs (Weapon, Shield, …, Armor, Ring)
 *   └── toolbar (profileNum, accountId — no tab indicator)
 *
 * Each user edit triggers O(1) inc/dec on ≤3 nodes. Only 0↔non-0
 * transitions toggle the CSS dirty dot on the corresponding tab button.
 * The dot is always present in the DOM (opacity-toggled), so there is
 * no layout shift or jitter.
 *
 * Visual indicators:
 *   - Dirty dot on sub-tab / top-level tab button (`.dirty` class)
 *   - Dirty dot on slot section (managed by app.js)
 *   - `.dirty` on changed scalar inputs / table-row cells (orange border)
 *   - `.row-dirty` on changed existing table rows
 *   - `.row-deleted` on soft-deleted rows (greyed out)
 *   - `.row-added` on new rows (green left border)
 *
 * Lifecycle:
 *   1. `buildPage()` creates the DOM (including `.dirty-dot` spans).
 *   2. `buildDirtyTree()` links tab buttons to DirtyNode indicators.
 *   3. `populateForm()` renders the model into the DOM.
 *   4. `captureBaseline()` stores each element's value in `data-orig`,
 *      resets the tree, and marks all elements as clean.
 *   5. On user input (debounced), only changed elements are checked.
 *      Dirty transitions bump the corresponding tree node ±1.
 *   6. Row lifecycle hooks (onRowAdded, onRowRemoved, onRowSoftDeleted,
 *      onRowUndeleted) keep the tree in sync with structural changes.
 *   7. After a successful save, `purgeDeletedRows()` + `captureBaseline()`
 *      + `clearDirtyMarks()` resets the state.
 */

import { registerChangeHandler, registerInputHandler } from './event-dispatcher.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Element IDs that are NOT per-slot model fields and should be excluded
 * from dirty tracking.
 */
const SKIP_IDS = new Set([
  'warpLocation', // tool that sets position fields, not a model field itself
  'saveSlot', // slot selector (navigation)
]);

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

/** Root of the dirty counter tree (slot-level). */
let dirtyRoot = null;

/** Maps tab-content DOM elements → DirtyNode (for element→node lookup). */
const contentToNode = new WeakMap();

/** Tracks each element's current dirty state (element → boolean). */
const elementDirty = new WeakMap();

/** Tracks the number of dirty cells in each table row (tr → count). */
const rowCellDirtyCount = new WeakMap();

/** Tracks whether a soft-deleted row contributes to the dirty count. */
const rowSoftDeletedDirty = new WeakMap();

/** Tracks whether a new (user-inserted) row contributes to the dirty count. */
const newRowContributesDirty = new WeakMap();

/** Callback fired after each debounced dirty flush. */
let onFormDirtyChange = null;

/**
 * Tracks whether the enc/dec toggle switch is in a dirty (mismatched) state.
 *
 * The toggle is a <button role="switch">, not an <input>/<select>, so it
 * can't be tracked via the normal element-level machinery.  Instead,
 * `setEncToggleDirty()` directly bumps the toolbar DirtyNode.
 */
let encToggleDirty = false;

// ---------------------------------------------------------------------------
// DirtyNode — tree node with count and CSS indicator
// ---------------------------------------------------------------------------

class DirtyNode {
  /**
   * @param {string} key  unique identifier (e.g. 'editor:inventory:weapon-1')
   */
  constructor(key) {
    this.key = key;
    this.count = 0;
    /** @type {HTMLElement|null} Tab-button element to toggle `.dirty` on. */
    this.indicatorEl = null;
    /** @type {DirtyNode|null} */
    this.parent = null;
    /** @type {Map<string, DirtyNode>} */
    this.children = new Map();
  }

  /**
   * Adjust this node's count by delta. On a 0↔non-0 transition:
   *   - Toggle `.dirty` class on the indicator element.
   *   - Propagate a ±1 adjustment to the parent.
   *
   * @param {number} delta  +1 (newly dirty) or -1 (newly clean)
   */
  bump(delta) {
    const wasDirty = this.count > 0;
    this.count += delta;
    if (this.count < 0) this.count = 0; // clamp (safety)
    const isDirty = this.count > 0;

    if (wasDirty !== isDirty) {
      if (this.indicatorEl) {
        this.indicatorEl.classList.toggle('dirty', isDirty);
      }
      if (this.parent) {
        this.parent.bump(isDirty ? 1 : -1);
      }
    }
  }

  /**
   * Reset this node and all descendants to a clean state (count = 0,
   * indicator cleared).
   */
  reset() {
    this.count = 0;
    if (this.indicatorEl) {
      this.indicatorEl.classList.remove('dirty');
    }
    for (const child of this.children.values()) {
      child.reset();
    }
  }
}

// ---------------------------------------------------------------------------
// DOM query helpers (typed wrappers for compound selectors)
// ---------------------------------------------------------------------------

/**
 * Query for all editable elements (inputs + selects) within a root.
 * @param {ParentNode} root
 * @returns {NodeListOf<HTMLInputElement | HTMLSelectElement>}
 */
function queryEditables(root) {
  return /** @type {NodeListOf<HTMLInputElement | HTMLSelectElement>} */ (
    root.querySelectorAll('input, select')
  );
}

/**
 * Query for all table rows in grid tables.
 * @param {ParentNode} root
 * @returns {NodeListOf<HTMLTableRowElement>}
 */
function queryGridRows(root) {
  return /** @type {NodeListOf<HTMLTableRowElement>} */ (
    root.querySelectorAll('.grid-table tbody tr')
  );
}

// ---------------------------------------------------------------------------
// Tree construction
// ---------------------------------------------------------------------------

/**
 * Recursively process a tab-group, creating DirtyNodes for each tab
 * and linking them to their tab-button indicators.
 *
 * @param {HTMLElement} tabGroupEl  the `.tab-group` element
 * @param {DirtyNode} parentNode    parent node in the dirty tree
 * @param {string} prefix           key prefix (e.g. 'editor:inventory')
 */
function processTabGroup(tabGroupEl, parentNode, prefix) {
  const tabButtons = /** @type {NodeListOf<HTMLElement>} */ (
    tabGroupEl.querySelectorAll(':scope > .tabs > .tab')
  );
  const tabContents = /** @type {NodeListOf<HTMLElement>} */ (
    tabGroupEl.querySelectorAll(':scope > .tab-content')
  );

  // Build data-tab → button map
  const buttonMap = new Map();
  for (const btn of tabButtons) {
    buttonMap.set(btn.dataset.tab, btn);
  }

  for (const content of tabContents) {
    const tabKey = content.dataset.tab;
    if (!tabKey) continue;

    const nodeKey = `${prefix}:${tabKey}`;
    const btn = buttonMap.get(tabKey);

    const node = new DirtyNode(nodeKey);
    node.indicatorEl = btn || null;
    node.parent = parentNode;
    parentNode.children.set(nodeKey, node);

    // Map content element → node (used by getNodeForElement)
    contentToNode.set(content, node);

    // Recurse into nested sub-tab groups (inside .sub-tab-container)
    const nestedGroups = /** @type {NodeListOf<HTMLElement>} */ (
      content.querySelectorAll(':scope > .sub-tab-container > .tab-group')
    );
    for (const nestedGroup of nestedGroups) {
      processTabGroup(nestedGroup, node, nodeKey);
    }
  }
}

/**
 * Build the dirty counter tree by scanning the DOM for tab buttons and
 * their content panels. Must be called AFTER `buildPage()` and BEFORE
 * the first `captureBaseline()`.
 */
export function buildDirtyTree() {
  dirtyRoot = new DirtyNode('root');

  // Left panel (#charPanel is itself a .tab-group.top-level)
  const charPanel = document.getElementById('charPanel');
  if (charPanel) {
    processTabGroup(charPanel, dirtyRoot, 'charPanel');
  }

  // Right panel (main#editor > .tab-group.top-level)
  const editorGroup = /** @type {HTMLElement|null} */ (
    document.querySelector('main#editor > .tab-group')
  );
  if (editorGroup) {
    processTabGroup(editorGroup, dirtyRoot, 'editor');
  }

  // Toolbar node (accountId etc. — no tab indicator)
  const toolbarNode = new DirtyNode('toolbar');
  toolbarNode.parent = dirtyRoot;
  dirtyRoot.children.set('toolbar', toolbarNode);
}

/**
 * Look up the DirtyNode for a given DOM element by finding the closest
 * `.tab-content` ancestor and checking the contentToNode map.
 *
 * @param {HTMLElement} el
 * @returns {DirtyNode|null}
 */
function getNodeForElement(el) {
  const content = el.closest('.tab-content');
  if (content && contentToNode.has(content)) {
    return contentToNode.get(content);
  }
  // Fallback: toolbar node (elements outside any .tab-content)
  return dirtyRoot?.children.get('toolbar') || null;
}

// ---------------------------------------------------------------------------
// Callback registration
// ---------------------------------------------------------------------------

/**
 * Register a callback fired after each debounced dirty flush.
 * The callback receives `true` if the form is currently dirty.
 *
 * @param {(isDirty: boolean) => void} cb
 */
export function setDirtyCallback(cb) {
  onFormDirtyChange = cb;
}

// ---------------------------------------------------------------------------
// Element dirty checking
// ---------------------------------------------------------------------------

/**
 * Check if an editable element's current value differs from its baseline.
 *
 * For number inputs, comparison is numeric (so "50" matches "50.0").
 * For checkboxes, boolean comparison is used.
 * For everything else, string comparison.
 *
 * @param {HTMLInputElement|HTMLSelectElement} el
 * @returns {boolean}
 */
export function isElementDirty(el) {
  if (el.dataset.orig === undefined) return false;
  if (el.type === 'checkbox') {
    return el.checked !== (el.dataset.orig === 'true');
  }
  if (el.type === 'number') {
    const cur = parseFloat(el.value);
    const orig = parseFloat(el.dataset.orig);
    if (isNaN(cur) && isNaN(orig)) return false;
    if (isNaN(cur) || isNaN(orig)) return true;
    return Math.abs(cur - orig) > 1e-9;
  }
  return el.value !== el.dataset.orig;
}

// ---------------------------------------------------------------------------
// Baseline capture
// ---------------------------------------------------------------------------

/**
 * Capture the current form state as the dirty-tracking baseline.
 *
 * Walks all editable elements, stores their current value in a
 * `data-orig` attribute, resets the dirty tree, and marks all elements
 * as clean.
 *
 * Call AFTER `populateForm()` completes (so the DOM reflects the model)
 * and BEFORE the user starts editing.
 *
 * @internal Production code uses {@link resetAndCaptureBaseline} instead.
 *   This function is retained as a public test utility for granular
 *   baseline capture without clearing dirty marks.
 */
export function captureBaseline() {
  const root = document.getElementById('app') || document.body;

  for (const el of queryEditables(root)) {
    if (SKIP_IDS.has(el.id)) continue;
    if (el.disabled) continue; // skip disabled (e.g. in deleted rows)

    if (el.type === 'checkbox') {
      el.dataset.orig = String(el.checked);
    } else {
      el.dataset.orig = el.value;
    }

    // Mark element as clean
    el.classList.remove('dirty');
    elementDirty.set(el, false);
  }

  // Reset the dirty tree (all counts to 0, all indicators cleared)
  if (dirtyRoot) dirtyRoot.reset();

  // Re-apply enc toggle dirty (app-level state survives baseline reset)
  reapplyEncToggleDirty();
}

// ---------------------------------------------------------------------------
// Dirty mark clearing
// ---------------------------------------------------------------------------

/**
 * Remove all dirty visual marks from the DOM and reset the tree.
 *
 * Called after `captureBaseline()` on save or slot switch to clear
 * stale indicators from a previous editing session.
 *
 * Does NOT remove `.row-added` or `.row-deleted` — those represent
 * structural state, not transient dirty marks.
 *
 * @internal Production code uses {@link resetAndCaptureBaseline} instead.
 *   This function is retained as a public test utility.
 */
export function clearDirtyMarks() {
  const root = document.getElementById('app') || document.body;
  root.querySelectorAll('.dirty').forEach((el) => el.classList.remove('dirty'));
  root.querySelectorAll('.row-dirty').forEach((el) => el.classList.remove('row-dirty'));
  // Reset tree (clears .dirty from tab buttons + resets counts)
  if (dirtyRoot) dirtyRoot.reset();
}

/**
 * Combined clear-dirty-marks + capture-baseline in a single DOM walk.
 *
 * Minimizes DOM traversals for better performance on large forms by
 * combining both operations into a single pass:
 *
 * - Resets the dirty tree once (clears all counts and CSS indicators).
 * - Removes `.dirty` and `.row-dirty` classes via a single selector.
 * - Walks all editable elements once to set `data-orig` and mark them clean,
 *   also stripping `.dirty` from those elements during the same pass.
 */
export function resetAndCaptureBaseline() {
  // Performance: This is O(n) where n = total editable elements.  For typical
  // saves (~200 elements) it completes in microseconds.  Called on slot switch
  // and after save.  If performance becomes a concern for very large saves,
  // consider diffing only changed elements.
  // Cancel any pending debounced dirty flush and clear the pending set.
  // This prevents a stale flush from firing after a slot switch — which
  // would check elements that now belong to a different slot against
  // baselines from the old slot, causing spurious dirty marks or missed
  // transitions.
  pendingElements.clear();
  clearTimeout(dirtyTimer);

  // Reset the dirty tree once (clears all counts + tab-button indicators)
  if (dirtyRoot) dirtyRoot.reset();

  const root = document.getElementById('app') || document.body;

  // Single pass: remove dirty CSS classes from non-input elements
  // (tab buttons, rows, etc.).  Input-level .dirty is handled below.
  root
    .querySelectorAll('.dirty:not(input):not(select)')
    .forEach((el) => el.classList.remove('dirty'));
  root.querySelectorAll('.row-dirty').forEach((el) => el.classList.remove('row-dirty'));

  // Single walk: set data-orig baseline, mark clean, and strip .dirty
  for (const el of queryEditables(root)) {
    if (SKIP_IDS.has(el.id)) continue;
    if (el.disabled) continue; // skip disabled (e.g. in deleted rows)

    if (el.type === 'checkbox') {
      el.dataset.orig = String(el.checked);
    } else {
      el.dataset.orig = el.value;
    }

    el.classList.remove('dirty');
    elementDirty.set(el, false);
  }

  // Re-apply enc toggle dirty (app-level state survives baseline reset)
  reapplyEncToggleDirty();
}

// ---------------------------------------------------------------------------
// Deleted row purging
// ---------------------------------------------------------------------------

/**
 * Physically remove all soft-deleted rows from the DOM.
 *
 * Called after a successful save — the deleted items have been written
 * out (their slots cleared by the writer), so the rows are no longer
 * needed. Removing them keeps the DOM in sync with the saved state.
 */
export function purgeDeletedRows() {
  document
    .querySelectorAll('.grid-table tbody tr[data-deleted="true"]')
    .forEach((tr) => tr.remove());
}

// ---------------------------------------------------------------------------
// Per-element dirty update (O(1) per element)
// ---------------------------------------------------------------------------

/**
 * Check a single element for a dirty-state transition and update the
 * tree counter + visual indicators accordingly.
 *
 * @param {HTMLInputElement|HTMLSelectElement} el
 */
function updateElementDirty(el) {
  if (el.dataset.orig === undefined) return;

  // Skip elements in new rows (tracked at row level via onRowAdded)
  // and soft-deleted rows (tracked via onRowSoftDeleted).
  const tr = el.closest('tr');
  if (tr) {
    if (tr.dataset.existing === 'false') return;
    if (tr.dataset.deleted === 'true') return;
  }

  const isDirty = isElementDirty(el);
  const wasDirty = elementDirty.get(el) || false;
  if (isDirty === wasDirty) return; // no transition

  // Update tracked state
  elementDirty.set(el, isDirty);

  // Bump tree counter
  const node = getNodeForElement(el);
  if (node) node.bump(isDirty ? 1 : -1);

  // Update visual indicator on the element
  el.classList.toggle('dirty', isDirty);

  // For row cells, update row-level tracking
  if (tr) {
    const count = (rowCellDirtyCount.get(tr) || 0) + (isDirty ? 1 : -1);
    rowCellDirtyCount.set(tr, Math.max(0, count));
    tr.classList.toggle('row-dirty', count > 0);
  }
}

// ---------------------------------------------------------------------------
// Full recompute (compatibility / fallback)
// ---------------------------------------------------------------------------

/**
 * Full-sync recomputation of all dirty marks.
 *
 * Resets the tree and walks all elements/rows to rebuild the dirty state
 * from scratch. This is O(n) and should only be used for initial sync,
 * debugging, or as a fallback.
 *
 * @internal Production code uses incremental O(1) dirty tracking via
 *   {@link setupDirtyListeners} and the DirtyNode tree.  This function
 *   is retained as a public test utility for verifying state after
 *   batch operations.
 */
export function recomputeDirty() {
  // If tree exists, reset it; otherwise skip tree operations.
  if (dirtyRoot) dirtyRoot.reset();

  const root = document.getElementById('app') || document.body;

  // Clear element dirty state
  for (const el of queryEditables(root)) {
    elementDirty.set(el, false);
  }

  // --- Scalars (inputs/selects NOT inside table rows) ---
  for (const el of queryEditables(root)) {
    if (SKIP_IDS.has(el.id)) continue;
    if (el.dataset.orig === undefined) continue;
    if (el.closest('tr')) continue; // handled in row loop

    const dirty = isElementDirty(el);
    el.classList.toggle('dirty', dirty);
    if (dirty) {
      elementDirty.set(el, true);
      if (dirtyRoot) {
        const node = getNodeForElement(el);
        if (node) node.bump(1);
      }
    }
  }

  // --- Table rows ---
  for (const tr of queryGridRows(root)) {
    // New rows: skip per-cell dirty (tracked at row level)
    if (tr.dataset.existing === 'false') continue;

    // Soft-deleted rows: always dirty
    if (tr.dataset.deleted === 'true') {
      rowSoftDeletedDirty.set(tr, true);
      tr.classList.add('row-dirty');
      if (dirtyRoot) {
        const node = getNodeForElement(tr);
        if (node) node.bump(1);
      }
      continue;
    }

    // Existing rows: check each cell
    let cellCount = 0;
    for (const el of queryEditables(tr)) {
      if (el.dataset.orig === undefined) continue;
      const dirty = isElementDirty(el);
      el.classList.toggle('dirty', dirty);
      if (dirty) {
        elementDirty.set(el, true);
        cellCount++;
        if (dirtyRoot) {
          const node = getNodeForElement(el);
          if (node) node.bump(1);
        }
      }
    }
    if (cellCount > 0) {
      rowCellDirtyCount.set(tr, cellCount);
      tr.classList.add('row-dirty');
    }
  }
}

// ---------------------------------------------------------------------------
// Row lifecycle hooks
// ---------------------------------------------------------------------------

/**
 * Fire the dirty-change callback if registered.
 * Called after each structural change (row add/remove/delete/undelete)
 * so the slot-level dirty indicator stays in sync immediately, without
 * waiting for the next debounced input flush.
 */
function notifyDirtyChange() {
  if (onFormDirtyChange) {
    onFormDirtyChange(dirtyRoot ? dirtyRoot.count > 0 : false);
  }
}

/**
 * Notify the dirty system that a new row was added to a table.
 * New rows contribute +1 to the dirty count (they are unsaved additions).
 *
 * @param {HTMLTableRowElement} tr
 */
export function onRowAdded(tr) {
  if (!dirtyRoot) return;
  if (newRowContributesDirty.get(tr)) return; // already counted
  newRowContributesDirty.set(tr, true);
  const node = getNodeForElement(tr);
  if (node) node.bump(1);
  notifyDirtyChange();
}

/**
 * Notify the dirty system that a new row is being removed (hard delete).
 * Undoes the +1 from onRowAdded.
 *
 * @param {HTMLTableRowElement} tr
 */
export function onRowRemoved(tr) {
  if (!dirtyRoot) return;
  if (!newRowContributesDirty.get(tr)) return; // wasn't counted
  newRowContributesDirty.set(tr, false);
  const node = getNodeForElement(tr);
  if (node) node.bump(-1);
  notifyDirtyChange();
}

/**
 * Notify the dirty system that an existing row was soft-deleted.
 *
 * Clears per-cell dirty contributions (cells are reverted to baseline),
 * then adds +1 for the deletion itself.
 *
 * Must be called AFTER cell values have been reverted to baseline.
 *
 * @param {HTMLTableRowElement} tr
 */
export function onRowSoftDeleted(tr) {
  if (!dirtyRoot) return;

  // Clear per-cell dirty contributions (cells were reverted to baseline)
  let dirtyCellCount = 0;
  for (const el of queryEditables(tr)) {
    if (elementDirty.get(el)) {
      elementDirty.set(el, false);
      el.classList.remove('dirty');
      dirtyCellCount++;
    }
  }
  if (dirtyCellCount > 0) {
    const node = getNodeForElement(tr);
    if (node) node.bump(-dirtyCellCount);
    rowCellDirtyCount.set(tr, 0);
  }

  // Add +1 for the deletion itself
  rowSoftDeletedDirty.set(tr, true);
  tr.classList.add('row-dirty');
  const node = getNodeForElement(tr);
  if (node) node.bump(1);
  notifyDirtyChange();
}

/**
 * Notify the dirty system that a soft-deleted row was restored (undeleted).
 *
 * Removes the +1 from the soft-delete. Cells are at baseline (reverted
 * during soft-delete), so no per-cell adjustment is needed.
 *
 * @param {HTMLTableRowElement} tr
 */
export function onRowUndeleted(tr) {
  if (!dirtyRoot) return;
  if (!rowSoftDeletedDirty.get(tr)) return; // wasn't soft-deleted
  rowSoftDeletedDirty.set(tr, false);
  tr.classList.remove('row-dirty');
  const node = getNodeForElement(tr);
  if (node) node.bump(-1);
  notifyDirtyChange();
}

// ---------------------------------------------------------------------------
// Enc/dec toggle dirty tracking
// ---------------------------------------------------------------------------

/**
 * Set the dirty state of the enc/dec toggle switch.
 *
 * The toggle is a `<button role="switch">`, not an `<input>/<select>`,
 * so it can't be tracked via the normal element-level machinery.  This
 * function provides a dedicated API for app.js to report mismatch state.
 *
 * Bumps the toolbar DirtyNode ±1 on a true↔false transition and fires
 * the dirty-change callback so the slot indicator stays in sync.
 *
 * @param {boolean} isDirty  whether the toggle is in a mismatched state
 */
export function setEncToggleDirty(isDirty) {
  if (encToggleDirty === isDirty) return; // no transition
  encToggleDirty = isDirty;
  if (dirtyRoot) {
    const toolbar = dirtyRoot.children.get('toolbar');
    if (toolbar) toolbar.bump(isDirty ? 1 : -1);
  }
  notifyDirtyChange();
}

/**
 * Re-apply the enc toggle dirty contribution after a tree reset.
 *
 * Called from `captureBaseline()` and `resetAndCaptureBaseline()` because
 * those functions reset all tree counts to 0.  Since the enc toggle state
 * is app-level (not per-slot), it must survive slot switches and save
 * refreshes.
 */
function reapplyEncToggleDirty() {
  if (encToggleDirty && dirtyRoot) {
    const toolbar = dirtyRoot.children.get('toolbar');
    if (toolbar) toolbar.bump(1);
  }
}

// ---------------------------------------------------------------------------
// Unsaved changes check
// ---------------------------------------------------------------------------

/**
 * Check if there are per-slot changes (excluding toolbar/folder-level fields).
 *
 * The dirty tree has a toolbar child node for folder-level fields
 * (profileNum, accountId, enc toggle).  This function checks whether the
 * root count minus the toolbar count is > 0 — i.e. whether any per-slot
 * model fields (stats, inventory, etc.) have changed.
 *
 * Used by app.js to avoid marking the current slot dirty when only
 * folder-level toolbar fields changed.
 *
 * @returns {boolean}
 */
export function hasSlotChanges() {
  if (!dirtyRoot) return false;
  const toolbar = dirtyRoot.children.get('toolbar');
  return dirtyRoot.count - (toolbar?.count || 0) > 0;
}

/**
 * Check if the current slot has any unsaved changes (scalars or rows).
 *
 * With the dirty tree, this is O(1) — just checks the root count.
 * Falls back to a full scan if the tree is not built.
 *
 * @returns {boolean}
 */
export function hasUnsavedChanges() {
  if (dirtyRoot) return dirtyRoot.count > 0;

  // Fallback: scan-based check (if tree not built)
  const root = document.getElementById('app') || document.body;

  for (const el of queryEditables(root)) {
    if (SKIP_IDS.has(el.id)) continue;
    if (el.dataset.orig === undefined) continue;
    if (isElementDirty(el)) return true;
  }

  for (const tr of queryGridRows(root)) {
    // New rows with a selected item count as unsaved changes.
    // New rows with no selection (placeholder still active) are not yet
    // committed and do not count.
    if (tr.dataset.existing === 'false') {
      const sel = /** @type {HTMLSelectElement|null} */ (
        tr.querySelector('.inv-name, .dep-name, .spell-name')
      );
      if (sel?.value) return true;
      continue;
    }
    if (tr.dataset.deleted === 'true') return true;
    for (const el of queryEditables(tr)) {
      if (el.dataset.orig !== undefined && isElementDirty(el)) return true;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Debounced dirty listener setup
// ---------------------------------------------------------------------------

/** Elements changed since the last flush (collected for batch processing). */
let pendingElements = new Set();

let dirtyTimer = null;

/**
 * Debounced flush: check only the elements that changed since the last flush.
 */
function flushDirty() {
  for (const el of pendingElements) {
    updateElementDirty(el);
  }
  pendingElements.clear();

  // Notify callback
  if (onFormDirtyChange) {
    onFormDirtyChange(dirtyRoot ? dirtyRoot.count > 0 : false);
  }
}

/**
 * Add an element to the pending set and schedule a flush.
 *
 * @param {HTMLInputElement|HTMLSelectElement} el
 */
function scheduleDirtyCheck(el) {
  pendingElements.add(el);
  clearTimeout(dirtyTimer);
  dirtyTimer = setTimeout(flushDirty, 150);
}

/**
 * Reset all module-level dirty state to a clean baseline.
 *
 * Called by `destroyApp()` so a subsequent `initApp()` starts fresh
 * instead of inheriting stale tree state, pending elements, or timers
 * from a previous session.  The WeakMaps (elementDirty, rowCellDirtyCount,
 * etc.) are GC-managed and auto-clear when DOM elements are removed, so
 * they don't need explicit clearing here.
 *
 * After calling this, `buildDirtyTree()` must be called again before the
 * dirty tracker can function.
 */
export function resetDirtyState() {
  // Cancel any pending debounced flush
  clearTimeout(dirtyTimer);
  dirtyTimer = null;
  // Clear the pending set (replaces it with a fresh empty Set so any
  // references held by scheduled callbacks are detached)
  pendingElements = new Set();
  // Reset the tree (clears all counts + tab-button indicators)
  if (dirtyRoot) dirtyRoot.reset();
  // Clear the enc toggle dirty flag (app-level teardown)
  encToggleDirty = false;
  // Clear the callback so it doesn't fire during teardown
  onFormDirtyChange = null;
}

/**
 * Register delegated `input` and `change` handlers for dirty tracking.
 *
 * Handlers are registered with the centralized event dispatcher, which
 * attaches a single listener per event type on `#app`. Only changed
 * elements are checked during the debounced flush — no full DOM scan.
 *
 * Should be called once during UI initialization.
 */
export function setupDirtyListeners() {
  registerInputHandler((e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) {
      if (SKIP_IDS.has(e.target.id)) return;
      scheduleDirtyCheck(e.target);
    }
  });
  registerChangeHandler((e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) {
      if (SKIP_IDS.has(e.target.id)) return;
      scheduleDirtyCheck(e.target);
    }
  });
}
