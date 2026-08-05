/**
 * Entry point: wires UI events to the savefile gateway API.
 *
 * Multi-slot flow (all character slots loaded/saved together):
 *
 * Open flow:
 *   1. User selects save folder via directory picker
 *   2. Call saveApi.openSave(rawFiles) → { slots, profileNumber, encrypted }
 *      (all existing slots are decrypted and parsed upfront)
 *   3. Slot selector is populated and first slot's model is displayed
 *
 * Slot switching:
 *   - Instant: reads the in-memory model, no re-decryption
 *   - Current editor values are committed to the model before switching
 *
 * Save flow:
 *   1. Collect current slot's form → update its model in the slots array
 *   2. Call saveApi.writeSaveData(slots, profileNumber) or
 *      saveApi.exportEncryptedSave(slots, profileNumber)
 *   3. Write/download all files at once
 */

import {
  openSave,
  writeSaveData,
  exportEncryptedSave,
  updateSessionAfterWrite,
  reloadSlotModels,
} from '../des-savefile/save-api.js';
import { buildPage } from './dom.js';
import { initTooltips } from './widgets/tooltips.js';
import { populateCombos } from './core/controls.js';
import {
  populateForm,
  collectForm,
  collectFolderFields,
  setupWarpAndWorld,
  setupTabs,
  setupAddRowButtons,
  setupHairColorSample,
  setupDirtyListeners,
  setupEquipmentSync,
  setupLazySelects,
  setupDurabilitySync,
  setupDepositWeaponSync,
  setupCountAndDuplicateSync,
  setupSelectTooltipSync,
} from './events.js';
import {
  purgeDeletedRows,
  buildDirtyTree,
  setDirtyCallback,
  hasUnsavedChanges,
  hasSlotChanges,
  resetDirtyState,
  setEncToggleDirty,
} from './core/dirty.js';
import { showConfirm } from './widgets/modal.js';
import {
  readFilesFromDataTransfer,
  openDirectoryViaFSAccess,
  writeFilesToDirectory,
  downloadFilesAsZip,
  deleteFilesFromDirectory,
  canWriteInPlace,
  canChooseSaveLocation,
  pickZipFile,
  writeZipToHandle,
} from './io.js';
import { refreshEquipmentDisplay } from './core/dom-helpers.js';
import { resetDispatcher } from './core/event-dispatcher.js';

/**
 * Create a fresh initial state object.
 *
 * Used for both the initial module load and the close-button reset,
 * so there is a single source of truth for default state — adding a new
 * field here automatically resets it on close.
 *
 * @returns {Object}
 */
function createInitialState() {
  return {
    slots: [], // [{ slot, session, model }] from openSave
    failedSlots: [], // [{ slot, error }] for slots that failed to load
    currentSlot: 0, // index into slots array
    profileNumber: 0, // SFO profile number (folder-level)
    accountId: '', // PSN account ID (folder-level, 32 hex chars or empty)
    sourceEncrypted: undefined, // original encryption state (never changes after load)
    encryptMode: false, // user toggle: true=encrypted output, false=decrypted output
    dirHandle: null, // FileSystemDirectoryHandle for write-back (Chromium)
    dirName: '', // save folder name (for tooltip + ZIP filename)
    loaded: false, // true after first slot has been rendered
    fileCount: 0, // number of files loaded (used in close button tooltip)
    busy: false, // true during async save/export (write-lock)
    sfoFingerprint: null, // PARAM.SFO bytes from open — used to verify folder identity on Save
  };
}

// App state
let state = createInitialState();

/** Guard flag: prevents double-init (HMR, tests) from stacking listeners. */
let isInitialized = false;

/** Guard flag: prevents drag-and-drop listeners from stacking on re-init. */
let dragDropInitialized = false;

/** Stored beforeunload handler for cleanup in destroyApp(). */
let beforeUnloadHandler = null;

/**
 * Update the slot section's dirty dot and dirty slot option labels.
 *
 * - Toggles the dirty dot on the slot section label (current slot).
 * - Appends ` * ` to dirty slots' option text in the dropdown so the user
 *   can see which slots have unsaved changes at a glance.
 */
function updateSlotDirtyDot() {
  const slotSection = document.getElementById('slotSection');
  if (slotSection) {
    const slot = state.slots[state.currentSlot];
    const isDirty = slot?.dirty || false;
    slotSection.classList.toggle('dirty', isDirty);
  }

  // Update option text: append * for dirty slots
  const sel = document.getElementById('saveSlot');
  if (!sel) return;
  for (const opt of /** @type {HTMLSelectElement} */ (sel).options) {
    const index = parseInt(opt.value, 10);
    if (isNaN(index)) continue; // skip failed-slot options (value='')
    const isDirty = state.slots[index]?.dirty || false;
    const slotNum = String(state.slots[index]?.slot ?? '?');
    opt.textContent = isDirty ? `${slotNum}  *  ` : slotNum;
  }

  // Sync Save button enabled/disabled state with the current slot's dirty flag
  updateSaveButtonState();
}

/**
 * Dirty callback — fired after each debounced dirty flush.
 * Updates the current slot's dirty flag and slot dot indicator.
 */
function onDirtyChange() {
  if (state.slots.length === 0) return;
  // Only mark slot dirty if per-slot fields changed (not folder-level
  // toolbar fields like profileNum, accountId, or enc toggle).
  state.slots[state.currentSlot].dirty = hasSlotChanges();
  updateSlotDirtyDot();
}

function setStatus(msg) {
  const el = document.getElementById('status');
  el.textContent = msg;
  // Show a tooltip with the full message, but ONLY when it's visually
  // truncated (overflowing the status span's max-width).  The tooltip
  // system checks scrollWidth > clientWidth on hover before showing.
  el.setAttribute('data-tooltip', msg);
  el.setAttribute('data-tooltip-if-truncated', 'true');
}

/**
 * Commit current editor values back into the in-memory model for the
 * active slot.  Must be called before switching slots or saving.
 *
 * Returns false (and sets a status message) if validation fails —
 * the caller should abort the pending operation.
 *
 * @returns {boolean} true if the model was committed successfully
 */
function commitCurrentSlot() {
  if (state.slots.length === 0) return true;
  if (!state.loaded) return true; // Skip until a slot has been rendered
  const model = collectForm();
  if (model === null) {
    setStatus(
      'Validation failed — Account ID must be 32 hex characters (0-9, A-F) or empty, ' +
        'and Name must be ≤16 characters with no control characters. ' +
        'Save aborted. Please fix the fields and try again.',
    );
    return false;
  }
  state.slots[state.currentSlot].model = model;

  // Collect folder-level SFO fields into app state (not slot model).
  // These are shared across all slots and passed separately to save functions.
  const folderFields = collectFolderFields();
  if (folderFields === null) {
    setStatus(
      'Validation failed — Account ID must be 32 hex characters (0-9, A-F) or empty. ' +
        'Save aborted. Please fix the field and try again.',
    );
    return false;
  }
  state.profileNumber = folderFields.profileNumber;
  state.accountId = folderFields.accountId;
  return true;
}

/**
 * Populate the character slot dropdown.
 *
 * Successfully loaded slots are shown as selectable options.
 * Failed slots are shown as disabled (greyed-out) options with just the
 * slot number — the same compact format as successful slots.  The full
 * error reason is exposed via:
 *   - `title` on the option (native tooltip for option hover in dropdown)
 *   - `data-tooltip` on the select element (custom tooltip when hovering
 *     over the closed dropdown)
 *
 * This keeps the dropdown at a fixed width regardless of error message
 * length, preventing toolbar layout breakage.
 */
function populateSlotDropdown() {
  const sel = document.getElementById('saveSlot');
  sel.innerHTML = '';

  // Successfully loaded slots — selectable
  for (let i = 0; i < state.slots.length; i++) {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = String(state.slots[i].slot);
    sel.appendChild(opt);
  }

  // Failed slots — shown but disabled (greyed out), same compact format
  // as successful slots. Error details are in the tooltips, not the text.
  for (const failed of state.failedSlots) {
    const opt = document.createElement('option');
    opt.value = 'failed';
    opt.disabled = true;
    opt.textContent = String(failed.slot);
    // Native tooltip — fires when hovering over the option in the open
    // dropdown list (browser-dependent; works in most Chromium builds).
    opt.title = `Slot ${failed.slot} could not be loaded: ${failed.error}`;
    sel.appendChild(opt);
  }

  // Set a summary tooltip on the select element itself so hovering over
  // the closed dropdown explains which slots failed and why.
  if (state.failedSlots.length > 0) {
    const summary = state.failedSlots.map((f) => `Slot ${f.slot}: ${f.error}`).join('\n');
    sel.setAttribute('data-tooltip', `Failed slot(s):\n${summary}`);
  } else {
    sel.removeAttribute('data-tooltip');
  }

  // Show the slot selector section
  document.getElementById('slotSection').hidden = false;
}

/**
 * Render a specific slot's model into the editor (instant — no decryption).
 * Commits the current slot's form data before switching.
 * @param {number} index  index into state.slots
 */
function renderSlot(index) {
  if (index < 0 || index >= state.slots.length) return;
  if (!commitCurrentSlot()) return; // abort slot switch on validation failure
  state.currentSlot = index;

  const { model, display } = state.slots[index];
  populateForm(model, display, { profileNumber: state.profileNumber, accountId: state.accountId });

  // Update dropdown to reflect active slot
  /** @type {HTMLSelectElement} */ (document.getElementById('saveSlot')).value = String(index);

  // Update slot dirty dot for the newly selected slot
  updateSlotDirtyDot();
}

/**
 * Enable/disable save/export buttons based on load state.
 */
function updateSaveButtons() {
  /** @type {HTMLButtonElement} */ (document.getElementById('btnToggleEncrypt')).disabled = false;
  // Save (in-place overwrite) is available on Chromium-based browsers.
  // On other browsers, the button is hidden entirely.
  const saveBtn = document.getElementById('btnSave');
  if (!saveBtn) return;
  if (canWriteInPlace()) {
    saveBtn.hidden = false;
    /** @type {HTMLButtonElement} */ (saveBtn).disabled = false;
  } else {
    saveBtn.hidden = true;
  }
  /** @type {HTMLButtonElement} */ (document.getElementById('btnExport')).disabled = false;

  // Apply dirty-gated Save button state
  updateSaveButtonState();
}

/**
 * Update the Save button's disabled state based on the current slot's dirty
 * flag and busy state.
 *
 * The Save button is only enabled when:
 *   - The app is not busy (during async operations)
 *   - The current slot has unsaved changes (dirty)
 *   - The button is not hidden (Chromium-only feature)
 *
 * Export remains always enabled regardless of dirty state.
 */
function updateSaveButtonState() {
  const saveBtn = document.getElementById('btnSave');
  if (!saveBtn || saveBtn.hidden) return;
  if (state.busy) return;
  const isDirty = hasUnsavedChanges();
  /** @type {HTMLButtonElement} */ (saveBtn).disabled = !isDirty;
}

/**
 * Update the Close button's tooltip to include the current source
 * directory name (or file count) and encryption state.
 * Called after opening a save and after in-place saves that change
 * the encryption state.
 */
function updateCloseButtonTooltip() {
  const btn = document.getElementById('btnClose');
  if (!btn) return;

  let sourceInfo = '';
  if (state.dirName) {
    sourceInfo = state.dirName;
  } else if (state.fileCount) {
    sourceInfo = `${state.fileCount} file${state.fileCount !== 1 ? 's' : ''} loaded`;
  }

  const encTag = state.sourceEncrypted ? 'encrypted' : 'un-encrypted';

  let tooltip =
    'Close current save and return to landing page — all unsaved changes will be discarded';
  if (sourceInfo) {
    tooltip += `\n\nSource: ${sourceInfo} (${encTag})`;
  }
  btn.setAttribute('data-tooltip', tooltip);
}

/**
 * Update the encryption toggle switch's state, label, and tooltip to match
 * the current encryptMode state. Adds a visual .mismatch class when the
 * output mode differs from the source save's encryption state.
 */
function updateEncryptToggle() {
  const btn = document.getElementById('btnToggleEncrypt');
  if (!btn) return;
  btn.setAttribute('aria-checked', String(state.encryptMode));
  const labelEl = btn.querySelector('.toggle-switch-label');
  if (labelEl) {
    labelEl.textContent = state.encryptMode ? 'Enc' : 'Dec';
  }

  const mismatch =
    state.sourceEncrypted !== undefined && state.encryptMode !== state.sourceEncrypted;

  btn.classList.toggle('mismatch', mismatch);

  const baseTooltip = state.encryptMode
    ? 'Encryption: ON — Save/Export will use encrypted format (click to toggle)'
    : 'Encryption: OFF — Save/Export will use decrypted format (click to toggle)';

  if (mismatch) {
    const sourceState = state.sourceEncrypted ? 'encrypted' : 'un-encrypted';
    const outputState = state.encryptMode ? 'encrypted' : 'un-encrypted';
    btn.setAttribute(
      'data-tooltip',
      baseTooltip +
        `\n\n⚠ Mismatch: the source save is ${sourceState}, but the output will be ${outputState}.\n` +
        'This will permanently change the encryption state of your save folder on Save, or produce a differently-encrypted ZIP on Export.',
    );
  } else {
    btn.setAttribute('data-tooltip', baseTooltip);
  }

  // Report mismatch state to the dirty tracker so the slot dirty dot
  // and hasUnsavedChanges() reflect the enc toggle.
  setEncToggleDirty(mismatch);
}

/**
 * Set up drag-and-drop folder loading.
 *
 * Shows a full-page overlay when a folder is dragged over the app, then
 * reads all files from the dropped folder via webkitGetAsEntry(). This is
 * the universal way to open saves on all browsers. On Chromium-based
 * browsers, the Open button is also available (uses
 * showDirectoryPicker for in-place Save support).
 */
function setupDragAndDrop() {
  // Open-button path (showDirectoryPicker available): no drag-over at all.
  // The landing page shows just the centered Open button.
  if (canWriteInPlace()) return;

  // Guard against double-init — #app element persists across re-init, so
  // attaching again would stack duplicate drag-and-drop listeners.
  if (dragDropInitialized) return;
  dragDropInitialized = true;

  const app = document.getElementById('app');
  const overlay = document.getElementById('dropOverlay');
  if (!app || !overlay) return;

  // Use a counter to handle nested dragenter/dragleave correctly
  let dragCounter = 0;

  app.addEventListener('dragenter', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer && e.dataTransfer.types.includes('Files')) {
      dragCounter++;
      overlay.hidden = false;
      // Highlight the landing dropzone if visible
      const landing = document.querySelector('.landing-dropzone');
      if (landing) landing.classList.add('drag-active');
    }
  });

  app.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Keep the drop effect as "copy" so the cursor shows a + indicator
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  });

  app.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer && e.dataTransfer.types.includes('Files')) {
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        overlay.hidden = true;
        const landing = document.querySelector('.landing-dropzone');
        if (landing) landing.classList.remove('drag-active');
      }
    }
  });

  app.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter = 0;
    overlay.hidden = true;
    const landing = document.querySelector('.landing-dropzone');
    if (landing) landing.classList.remove('drag-active');

    if (!e.dataTransfer || !e.dataTransfer.items) return;

    try {
      setStatus('Reading dropped folder…');
      const { files, dirName } = await readFilesFromDataTransfer(e.dataTransfer.items);
      state.dirName = dirName || '';
      const rawFiles = files;
      // Drag-and-drop cannot provide a FileSystemDirectoryHandle, so
      // in-place Save is unavailable even on Chromium for dropped folders.
      state.dirHandle = null;
      await handleOpen(rawFiles);
    } catch (err) {
      setStatus(`Failed to open dropped save: ${err.message}`);
      console.error(err);
    }
  });
}

/**
 * Set up the landing page based on browser capabilities.
 *
 * Capability-based, mutually exclusive:
 *
 *   canWriteInPlace() === true  (showDirectoryPicker available):
 *     Centered Open button only. No dropzone, no drag-over. The Open
 *     button is moved from the toolbar into the landing page so it
 *     appears centered; the dropzone is hidden.
 *
 *   canWriteInPlace() === false (no directory picker):
 *     Centered drag-and-drop dropzone only. No Open button.
 *
 * After a save loads, the landing page is hidden on both paths, so the
 * Open button (when present) disappears with it.
 */
function setupLandingBrowse() {
  const landing = document.getElementById('landingPage');
  const dropzone = document.querySelector('.landing-dropzone');
  const btnOpen = document.getElementById('btnOpen');
  const browseLink = document.getElementById('landingBrowse');

  if (canWriteInPlace()) {
    // Open-button path: hide dropzone, show landing with centered Open button.
    if (dropzone) /** @type {HTMLElement} */ (dropzone).hidden = true;
    if (browseLink?.parentElement) browseLink.parentElement.hidden = true;
    // Move the Open button into the landing page (its click listener is
    // attached in setupOpenButton() and follows the element).
    if (landing && btnOpen) {
      landing.hidden = false;
      btnOpen.hidden = false;
      landing.appendChild(btnOpen);
    }
  } else {
    // Dropzone path: no Open button, dropzone stays visible.
    if (btnOpen) btnOpen.hidden = true;
    if (browseLink?.parentElement) browseLink.parentElement.hidden = true;
  }

  // Wire browse link click as a no-op-safe fallback (hidden on both paths,
  // but kept for edge cases where it might be re-shown).
  if (browseLink) {
    browseLink.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        setStatus('Select your PS3 save folder…');
        const { dirHandle, files } = await openDirectoryViaFSAccess();
        state.dirHandle = dirHandle;
        state.dirName = /** @type {any} */ (dirHandle)?.name || '';
        await handleOpen(files);
      } catch (err) {
        if (err.name === 'AbortError') {
          setStatus('Open cancelled.');
        } else {
          setStatus(`Failed to open save: ${err.message}`);
          console.error(err);
        }
      }
    });
  }
}

/**
 * Set up the Open button (Chromium-based browsers only).
 *
 * Uses showDirectoryPicker() for a native folder picker, providing a
 * FileSystemDirectoryHandle for in-place Save support.
 */
function setupOpenButton() {
  const btn = document.getElementById('btnOpen');
  if (!btn) return;

  if (!canWriteInPlace()) {
    btn.hidden = true;
    return;
  }

  btn.addEventListener('click', async () => {
    try {
      setStatus('Select your PS3 save folder…');
      const { dirHandle, files } = await openDirectoryViaFSAccess();
      state.dirHandle = dirHandle;
      state.dirName = /** @type {any} */ (dirHandle)?.name || '';
      await handleOpen(files);
    } catch (err) {
      if (err.name === 'AbortError') {
        setStatus('Open cancelled.');
      } else {
        setStatus(`Failed to open save: ${err.message}`);
        console.error(err);
      }
    }
  });
}

/**
 * Set the busy state during async save/export operations.
 *
 * Disables all toolbar action buttons and the slot selector to prevent
 * concurrent operations (e.g. double-save, slot-switch mid-write).
 *
 * @param {boolean} isBusy
 */
function setBusy(isBusy) {
  state.busy = isBusy;
  const ids = ['btnSave', 'btnExport', 'btnClose', 'btnToggleEncrypt', 'saveSlot'];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el) continue;
    /** @type {HTMLButtonElement | HTMLSelectElement} */ (el).disabled = isBusy;
  }
  // After re-enabling buttons, respect dirty state for Save button
  if (!isBusy) updateSaveButtonState();
}

/**
 * Check for unsaved changes and prompt the user to confirm discarding them.
 * Returns true if the user confirms (or if there are no unsaved changes).
 *
 * @returns {Promise<boolean>}
 */
async function confirmDiscard() {
  if (!hasUnsavedChanges()) return true;
  return await showConfirm(
    'You have unsaved changes that will be lost.\n\nAre you sure you want to continue?',
    { title: 'Discard Changes?', confirmText: 'Discard', danger: true },
  );
}

/**
 * Initialize the UI on page load.
 */
export async function initApp() {
  // Guard against double-init (HMR, tests) — prevents stacked listeners.
  if (isInitialized) return;
  isInitialized = true;

  buildPage();
  buildDirtyTree();
  setDirtyCallback(onDirtyChange);
  initTooltips();
  setupDragAndDrop();
  setupLandingBrowse();
  setupOpenButton();
  populateCombos();
  setupWarpAndWorld();
  setupTabs();
  setupAddRowButtons();
  setupHairColorSample();
  setupDirtyListeners();
  setupEquipmentSync();
  setupLazySelects();
  setupDurabilitySync();
  setupDepositWeaponSync();
  setupCountAndDuplicateSync();
  setupSelectTooltipSync();

  // Warn the user before closing the tab/navigating away with unsaved changes.
  // Store the handler so destroyApp() can remove it.
  beforeUnloadHandler = (e) => {
    if (hasUnsavedChanges()) {
      e.preventDefault();
      e.returnValue = '';
    }
  };
  window.addEventListener('beforeunload', beforeUnloadHandler);

  // Slot dropdown change — instant switch to the selected slot
  document.getElementById('saveSlot').addEventListener('change', (e) => {
    const index = parseInt(/** @type {HTMLSelectElement} */ (e.target).value, 10);
    if (!isNaN(index)) {
      renderSlot(index);
    }
  });

  // Encryption toggle — flips between encrypted (locked) and decrypted (unlocked) output
  document.getElementById('btnToggleEncrypt').addEventListener('click', () => {
    state.encryptMode = !state.encryptMode;
    updateEncryptToggle();
    setStatus(
      state.encryptMode
        ? 'Encryption ON — Save/Export will produce encrypted files.'
        : 'Encryption OFF — Save/Export will produce decrypted files.',
    );
  });

  // Save button — overwrites save folder in-place (Chromium-based browsers only)
  document.getElementById('btnSave').addEventListener('click', async () => {
    if (state.busy) return;
    setBusy(true);
    try {
      if (state.encryptMode) {
        await handleOverwriteEncrypted();
      } else {
        await handleOverwriteDecrypted();
      }
    } catch (err) {
      setStatus(`Save failed: ${err.message}`);
      console.error(err);
    } finally {
      setBusy(false);
    }
  });

  // Close button — release current save and return to landing page
  document.getElementById('btnClose').addEventListener('click', async () => {
    // Guard: never close while an async operation is in-flight — the
    // pending save/export may still resolve and mutate state/DOM after
    // the reset, causing corruption.
    if (state.busy) return;

    // Guard against unsaved changes
    if (!(await confirmDiscard())) return;

    // Reset state to a clean initial state (single source of truth)
    state = createInitialState();

    // Hide toolbar controls + content area, show landing page (always —
    // capability-branched in setupLandingBrowse: Open button on Chromium,
    // dropzone elsewhere).
    document.querySelector('.toolbar')?.classList.remove('loaded');
    document.getElementById('contentArea')?.classList.remove('loaded');
    const landing = document.getElementById('landingPage');
    if (landing) landing.hidden = false;

    // Reset slot dropdown
    document.getElementById('slotSection').hidden = true;
    const slotSel = document.getElementById('saveSlot');
    if (slotSel) slotSel.innerHTML = '';

    // Reset close button tooltip to default
    updateCloseButtonTooltip();

    // Disable buttons
    /** @type {HTMLButtonElement} */ (document.getElementById('btnToggleEncrypt')).disabled = true;
    const saveBtn = document.getElementById('btnSave');
    if (saveBtn) /** @type {HTMLButtonElement} */ (saveBtn).disabled = true;
    /** @type {HTMLButtonElement} */ (document.getElementById('btnExport')).disabled = true;

    setStatus(
      canWriteInPlace()
        ? 'Save closed. Click "Open" to load another PS3 save folder.'
        : 'Save closed. Drag and drop another PS3 save folder to begin.',
    );
  });

  // Export button — downloads as ZIP (mode depends on toggle)
  document.getElementById('btnExport').addEventListener('click', async () => {
    if (state.busy) return;
    setBusy(true);
    try {
      if (state.encryptMode) {
        await handleExportEncrypted();
      } else {
        await handleExportDecrypted();
      }
    } catch (err) {
      setStatus(`Export failed: ${err.message}`);
      console.error(err);
    } finally {
      setBusy(false);
    }
  });

  // Browser-aware initial status message
  setStatus(
    canWriteInPlace()
      ? 'Ready. Click "Open" to load a PS3 save folder.'
      : 'Drag and drop your PS3 save folder to begin.',
  );
}

/**
 * Handle opening a save folder. Loads all character slots at once.
 * @param {Map<string, {name: string, bytes: Uint8Array}>} rawFiles
 */
async function handleOpen(rawFiles) {
  // Validate: a PS3 save folder must contain PARAM.SFO.
  // In Tauri, pick_directory already enforces this and re-prompts, so
  // this is a safety net for browser paths (Chromium picker, drag-and-drop).
  if (!rawFiles.has('param.sfo')) {
    setStatus(
      'Selected folder does not contain PARAM.SFO — not a valid PS3 save. Please try again.',
    );
    return;
  }

  setStatus('Opening save…');

  try {
    const { slots, failedSlots, profileNumber, accountId, encrypted } = await openSave(
      rawFiles,
      (msg) => setStatus(msg),
    );

    state.slots = slots;
    state.failedSlots = failedSlots;
    state.currentSlot = 0;
    state.profileNumber = profileNumber;
    state.accountId = accountId;
    state.sourceEncrypted = encrypted; // Original state (never changes)
    state.encryptMode = encrypted; // Default toggle to match source
    state.loaded = false; // Will be set true after first render
    // Store the original PARAM.SFO bytes as a fingerprint so we can
    // verify the user re-selects the same folder during in-place Save.
    state.sfoFingerprint = rawFiles.get('param.sfo')?.bytes ?? null;

    // No playable slots found — the save is likely invalid or from a
    // different game. Show a clear message instead of an empty editor.
    if (slots.length === 0) {
      const detail =
        failedSlots.length > 0
          ? ` All ${failedSlots.length} slot(s) failed to load: ${failedSlots.map((f) => `slot ${f.slot}: ${f.error}`).join('; ')}.`
          : '';
      setStatus(
        `No playable slots found in this save${detail} ` +
          'Please verify this is a Demon\u2019s Souls PS3 save folder containing USER.DAT files.',
      );
      return;
    }

    // Populate slot dropdown and render first slot
    populateSlotDropdown();
    renderSlot(0);
    state.loaded = true;

    // Enable buttons and sync toggle icon
    updateSaveButtons();
    updateEncryptToggle();

    // Show toolbar controls + content area, hide landing page
    document.querySelector('.toolbar')?.classList.add('loaded');
    document.getElementById('contentArea')?.classList.add('loaded');
    const landingOnOpen = document.getElementById('landingPage');
    if (landingOnOpen) landingOnOpen.hidden = true;

    // Update Close button tooltip with directory info + encryption state
    state.fileCount = rawFiles.size;
    updateCloseButtonTooltip();

    const slotNames = slots.map((s) => `slot ${s.slot}`).join(', ');
    const mode = encrypted ? 'encrypted' : 'unencrypted';

    if (failedSlots.length > 0) {
      const failedNames = failedSlots.map((f) => `slot ${f.slot}`).join(', ');
      const reasons = failedSlots.map((f) => `slot ${f.slot}: ${f.error}`).join('; ');
      setStatus(
        `Loaded ${slots.length} slot(s) (${slotNames}) — ${mode}. ` +
          `⚠ ${failedSlots.length} slot(s) failed to load (${failedNames}): ${reasons}. ` +
          `Failed slots are listed but cannot be edited.`,
      );
    } else {
      setStatus(
        `Loaded ${slots.length} slot(s) (${slotNames}) — ${mode}. ` +
          `Switch between characters using the dropdown.`,
      );
    }
  } catch (err) {
    setStatus(`Failed to open save: ${err.message}`);
    console.error(err);
  }
}

/**
 * Compare two Uint8Array instances for byte-equality.
 *
 * @param {Uint8Array} a
 * @param {Uint8Array} b
 * @returns {boolean}
 */
function bytesEqual(a, b) {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Ensure we have a FileSystemDirectoryHandle for in-place writes.
 *
 * When a save is opened via drag-and-drop, there's no directory handle.
 * On Chromium browsers, we lazily prompt the user to re-select the folder
 * so we can get a writable handle. Returns true if a handle is available.
 *
 * @returns {Promise<boolean>}
 */
async function ensureDirHandle() {
  if (state.dirHandle) return true;
  if (!canWriteInPlace()) return false;
  // Lazily prompt: user selects the folder again to grant write access
  setStatus('Select the save folder to enable in-place Save…');
  try {
    const { dirHandle, files } = await openDirectoryViaFSAccess();
    // Verify the folder matches by comparing the directory name
    if (
      state.dirName &&
      /** @type {any} */ (dirHandle).name &&
      /** @type {any} */ (dirHandle).name !== state.dirName
    ) {
      setStatus(
        `Folder mismatch: selected "${/** @type {any} */ (dirHandle).name}" but the loaded save is "${state.dirName}". Save cancelled.`,
      );
      return false;
    }
    // Content check: verify PARAM.SFO exists AND matches the originally
    // loaded save's SFO bytes.  Two saves from the same game region share
    // the same folder name (e.g. BLES01389SAVE) and every save has a
    // PARAM.SFO, so a name check + existence check alone cannot distinguish
    // them.  Comparing the actual SFO bytes prevents overwriting the wrong
    // save folder.
    const newSfoBytes = files.get('param.sfo')?.bytes;
    if (!newSfoBytes) {
      setStatus('Selected folder does not contain PARAM.SFO — not the same save. Save cancelled.');
      return false;
    }
    if (state.sfoFingerprint && !bytesEqual(newSfoBytes, state.sfoFingerprint)) {
      setStatus(
        'PARAM.SFO mismatch — the selected folder is a different save than the one currently loaded. Save cancelled.',
      );
      return false;
    }
    state.dirHandle = dirHandle;
    setStatus('Write access granted.');
    return true;
  } catch (err) {
    if (err.name === 'AbortError') {
      setStatus('Save cancelled.');
    } else {
      setStatus(`Could not get write access: ${err.message}`);
    }
    return false;
  }
}

/**
 * Handle overwriting the save folder with un-encrypted (decrypted) files.
 * Writes directly to disk via File System Access API (Chromium only).
 */
async function handleOverwriteDecrypted() {
  if (state.slots.length === 0) {
    setStatus('No save loaded.');
    return;
  }

  if (!(await ensureDirHandle())) {
    if (!canWriteInPlace()) {
      setStatus('Overwrite requires a Chromium browser. Use Export to download a ZIP instead.');
    }
    return;
  }

  setStatus('Collecting form data…');
  if (!commitCurrentSlot()) return; // abort on validation failure

  const { filesToWrite, sfoBytes, filesToDelete } = await writeSaveData(
    state.slots,
    state.failedSlots,
    state.profileNumber,
    state.accountId,
    (msg) => setStatus(msg),
    true, // inPlace: only write USER.DAT variants, skip unchanged files
  );

  setStatus('Writing decrypted files…');
  let deleteErrMsg = '';
  try {
    // Write new files FIRST — if this fails, the save folder still has
    // its old (intact) files and is not corrupted.
    await writeFilesToDirectory(state.dirHandle, filesToWrite);

    // Only after a successful write, delete stale files (e.g. PARAM.PFD
    // when decrypting).  If the delete fails, the new files are already
    // on disk but PARAM.PFD is still present — the save is in a
    // transitional state and the user must re-open it.
    if (filesToDelete && filesToDelete.size > 0) {
      try {
        await deleteFilesFromDirectory(state.dirHandle, filesToDelete);
      } catch (delErr) {
        console.error('Post-write cleanup failed:', delErr);
        deleteErrMsg = delErr.message;
      }
    }

    // Write PARAM.SFO AFTER PARAM.PFD has been deleted (in-place decrypted
    // mode).  Writing SFO while PFD still exists causes the editor to treat
    // the save as encrypted on next open → double-decryption → corruption.
    // In in-place mode, writeSaveData omits PARAM.SFO from filesToWrite
    // but returns it separately as sfoBytes.
    if (!filesToWrite.has('PARAM.SFO') && sfoBytes) {
      const sfoWriteMap = new Map([['PARAM.SFO', sfoBytes]]);
      await writeFilesToDirectory(state.dirHandle, sfoWriteMap);
      // Add it to filesToWrite so updateSessionAfterWrite syncs session.sfoBytes
      filesToWrite.set('PARAM.SFO', sfoBytes);
    }

    // If the delete failed, the on-disk state is ambiguous (decrypted
    // USER.DAT + stale PARAM.PFD).  Do NOT update the in-memory encryption
    // state or refresh the editor — tell the user to re-open instead.
    if (deleteErrMsg) {
      setStatus(
        `Save written, but could not remove stale file(s): ${deleteErrMsg}. ` +
          'The save is in a transitional state (decrypted files written but ' +
          'PARAM.PFD remains). Please re-open the save folder before making ' +
          'further edits.',
      );
      return;
    }

    // Sync in-memory session state to match the new on-disk encryption state.
    // This clears manager.pfd, updates manager.files, rawFiles, and
    // session.encrypted so subsequent saves work correctly.
    await updateSessionAfterWrite(state.slots, filesToWrite, false);

    // Update app-level state and UI
    state.sourceEncrypted = false;
    updateCloseButtonTooltip();
    updateEncryptToggle();

    refreshAfterSave();

    setStatus(
      filesToDelete && filesToDelete.size > 0
        ? 'Save overwritten with un-encrypted files (PARAM.PFD removed).'
        : 'Save overwritten with un-encrypted files.',
    );
  } catch (err) {
    setStatus(
      `Write failed: ${err.message}. ` +
        'Your save folder may be in an inconsistent state — ' +
        'please restore from a backup if the game cannot load it.',
    );
    console.error(err);
  }
}

/**
 * Refresh the editor DOM after a successful save.
 *
 * Purges soft-deleted rows from the DOM (their data has been written out
 * — slots cleared by the writer), then re-populates the form from the
 * committed model to recapture the dirty-tracking baseline and clear
 * all dirty marks. This makes the editor reflect the just-saved state
 * as the new "clean" baseline.
 */
function refreshAfterSave() {
  try {
    purgeDeletedRows();
    // Re-sanitize all slot models from their updated fullModel — this gives
    // fresh _ref values so formerly-new items render as "existing" rows.
    reloadSlotModels(state.slots, (msg) => setStatus(msg));
    // Re-render the current slot from the fresh model.
    state.loaded = false;
    const { model, display } = state.slots[state.currentSlot];
    populateForm(model, display, {
      profileNumber: state.profileNumber,
      accountId: state.accountId,
    });
    state.loaded = true;

    // Clear all slot dirty flags — the save committed all changes to disk.
    for (const slot of state.slots) {
      slot.dirty = false;
    }
    updateSlotDirtyDot();
  } catch (err) {
    // Restore state.loaded so the editor stays interactive with the
    // pre-refresh (just-saved) form data.  Dirty marks remain intact
    // so the user knows the UI may not reflect the on-disk state.
    state.loaded = true;
    console.error('refreshAfterSave failed:', err);
    setStatus(
      'Save succeeded, but the editor could not refresh from the saved data. ' +
        'Please re-open the save folder to see the updated state.',
    );
  }
}

/**
 * Build the suggested ZIP filename from the loaded save's directory name.
 *
 * Prefers "<dirName>.zip" when a directory name is available (e.g.
 * "BLES01389SAVE.zip"), otherwise falls back to the generic "des_save.zip".
 *
 * @returns {string}
 */
function defaultZipName() {
  const dir = (state.dirName || '').trim();
  return dir ? `${dir}.zip` : 'des_save.zip';
}

/**
 * Show a "Save As" dialog and return a file handle (Chromium only).
 *
 * MUST run first in the click handler, before any await that does heavy
 * work (encryption can take a few seconds). showSaveFilePicker() requires
 * a fresh user-gesture activation; calling it after a long await throws
 * SecurityError.
 *
 * Returns null if the browser doesn't support the API (caller falls back
 * to <a download>). Throws AbortError if the user cancels the dialog.
 *
 * @returns {Promise<object|null>}
 */
async function pickExportDestination() {
  if (!canChooseSaveLocation()) return null;
  return await pickZipFile(defaultZipName());
}

/**
 * Handle exporting decrypted files.
 *
 * Chromium: shows a native "Save As" dialog so the user must pick a folder
 *   and filename before the file is written.
 * Other browsers: falls back to a plain <a download> (browser's default
 *   download folder).
 */
async function handleExportDecrypted() {
  if (state.slots.length === 0) {
    setStatus('No save loaded.');
    return;
  }

  // Pick destination FIRST, while user-activation from the click is fresh.
  let handle;
  try {
    handle = await pickExportDestination();
  } catch (err) {
    if (err.name === 'AbortError') {
      setStatus('Export cancelled.');
    } else {
      setStatus(`Export failed: ${err.message}`);
      console.error(err);
    }
    return;
  }

  setStatus('Collecting form data…');
  if (!commitCurrentSlot()) return; // abort on validation failure

  const { filesToWrite } = await writeSaveData(
    state.slots,
    state.failedSlots,
    state.profileNumber,
    state.accountId,
    (msg) => setStatus(msg),
  );

  if (handle) {
    setStatus('Writing decrypted ZIP…');
    await writeZipToHandle(/** @type {any} */ (handle), filesToWrite);
    setStatus(`Decrypted save exported as ${/** @type {any} */ (handle).name}.`);
  } else {
    setStatus('Building decrypted ZIP…');
    const zipName = defaultZipName();
    await downloadFilesAsZip(filesToWrite, zipName);
    setStatus(
      `Decrypted save downloaded as ${zipName} (browser default folder — your browser doesn't support "Save As").`,
    );
  }
}

/**
 * Handle overwriting the save folder with encrypted files.
 * Writes directly to disk via File System Access API (Chromium only).
 */
async function handleOverwriteEncrypted() {
  if (state.slots.length === 0) {
    setStatus('No save loaded.');
    return;
  }

  if (!(await ensureDirHandle())) {
    if (!canWriteInPlace()) {
      setStatus('Overwrite requires a Chromium browser. Use Export to download a ZIP instead.');
    }
    return;
  }

  setStatus('Collecting form data…');
  if (!commitCurrentSlot()) return; // abort on validation failure

  const { filesToWrite, sfoBytes } = await exportEncryptedSave(
    state.slots,
    state.failedSlots,
    state.profileNumber,
    state.accountId,
    (msg) => setStatus(msg),
    true, // inPlace: only write USER.DAT + PFD + SFO, skip assets
  );

  // Sync the patched SFO into session state (encrypted in-place always
  // includes PARAM.SFO in filesToWrite, but update it explicitly for safety)
  if (sfoBytes) {
    for (const slot of state.slots) {
      slot.session.sfoBytes = sfoBytes;
    }
  }

  setStatus('Writing encrypted files…');
  try {
    await writeFilesToDirectory(state.dirHandle, filesToWrite);

    // Sync in-memory session state to match the new on-disk encryption state.
    // This parses the new PARAM.PFD, updates manager.files, rawFiles, and
    // session.encrypted so subsequent saves work correctly.
    await updateSessionAfterWrite(state.slots, filesToWrite, true);

    // Update app-level state and UI
    state.sourceEncrypted = true;
    updateCloseButtonTooltip();
    updateEncryptToggle();

    refreshAfterSave();

    setStatus('Save overwritten with encrypted files.');
  } catch (err) {
    setStatus(`Write failed: ${err.message}.`);
    console.error(err);
  }
}

/**
 * Handle exporting encrypted files.
 *
 * Chromium: shows a native "Save As" dialog so the user must pick a folder
 *   and filename before the file is written.
 * Other browsers: falls back to a plain <a download> (browser's default
 *   download folder).
 */
async function handleExportEncrypted() {
  if (state.slots.length === 0) {
    setStatus('No save loaded.');
    return;
  }

  // Pick destination FIRST, while user-activation from the click is fresh.
  // Encryption can take several seconds; if we awaited it before showing
  // the picker, the user-gesture activation would expire and the call to
  // showSaveFilePicker() would throw SecurityError.
  let handle;
  try {
    handle = await pickExportDestination();
  } catch (err) {
    if (err.name === 'AbortError') {
      setStatus('Export cancelled.');
    } else {
      setStatus(`Export failed: ${err.message}`);
      console.error(err);
    }
    return;
  }

  setStatus('Collecting form data…');
  if (!commitCurrentSlot()) return; // abort on validation failure

  const { filesToWrite } = await exportEncryptedSave(
    state.slots,
    state.failedSlots,
    state.profileNumber,
    state.accountId,
    (msg) => setStatus(msg),
  );

  if (handle) {
    setStatus('Writing encrypted ZIP…');
    await writeZipToHandle(/** @type {any} */ (handle), filesToWrite);
    setStatus(`Encrypted save exported as ${/** @type {any} */ (handle).name}.`);
  } else {
    setStatus('Building encrypted ZIP…');
    const zipName = defaultZipName();
    await downloadFilesAsZip(filesToWrite, zipName);
    setStatus(
      `Encrypted save downloaded as ${zipName} (browser default folder — your browser doesn't support "Save As").`,
    );
  }
}

/**
 * Tear down the UI — removes event listeners and resets state.
 *
 * Intended for HMR, test cleanup, or full app reset.  Safe to call even
 * if initApp() was never called.
 */
export function destroyApp() {
  if (beforeUnloadHandler) {
    window.removeEventListener('beforeunload', beforeUnloadHandler);
    beforeUnloadHandler = null;
  }
  // Cancel any pending debounced equipment refresh to prevent stale
  // timer callbacks from firing after teardown.
  refreshEquipmentDisplay.cancel();
  // Clear all registered event handlers so a subsequent initApp()
  // re-registers from scratch instead of accumulating duplicates.
  resetDispatcher();
  // Reset dirty-state module variables (tree, pending set, timer, callback)
  // so a subsequent initApp() starts from a clean baseline.
  resetDirtyState();
  isInitialized = false;
  state = createInitialState();
}

// Auto-init on DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
