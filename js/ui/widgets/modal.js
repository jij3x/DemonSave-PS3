/**
 * modal.js — Custom Promise-based modal dialogs replacing native
 * confirm() and alert().
 *
 * The dialogs are built programmatically, appended to document.body, and
 * removed after the user responds.  Each function returns a Promise so
 * callers can `await` the result just like native dialogs — but without
 * blocking the main thread.
 *
 * Features:
 *   - Focus trap (Tab/Shift+Tab cycles within the dialog)
 *   - Focus restoration to the triggering element on close
 *   - Unique `aria-labelledby` IDs (no collision when stacking)
 *   - Escape to cancel, Enter to confirm
 *   - Overlay-click dismiss for non-destructive dialogs (showAlert only)
 *
 * Usage:
 *   const ok = await showConfirm('Discard changes?');
 *   await showAlert('Deposit is full.');
 */

/** Monotonic counter for unique element IDs. */
let modalIdCounter = 0;

/* --- Shared modal lifecycle (focus trap, focus restore, auto-focus) --- */

/**
 * Set up the common modal lifecycle: focus trap, keydown listener
 * registration, auto-focus of the primary button, and focus restoration.
 *
 * Both `showConfirm` and `showAlert` share this logic to avoid duplication.
 *
 * @param {HTMLDivElement} overlay  the modal overlay element
 * @param {HTMLDivElement} dialog   the dialog card inside the overlay
 * @param {(e: KeyboardEvent) => void} onKey  dialog-specific key handler
 * @returns {() => void} teardown function — removes listeners, removes
 *   overlay from DOM, and restores focus to the previously focused element.
 */
function setupModalLifecycle(overlay, dialog, onKey) {
  // Save the currently focused element so we can restore it on close.
  const previouslyFocused = document.activeElement;

  /**
   * Focus trap: keep Tab/Shift+Tab cycling within the dialog.
   * Prevents focus from reaching elements behind the overlay.
   */
  /** @param {KeyboardEvent} e */
  function trapFocus(e) {
    if (e.key !== 'Tab') return;
    const focusable = dialog.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      /** @type {HTMLElement} */ (last).focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      /** @type {HTMLElement} */ (first).focus();
    }
  }

  // Register keydown listeners (onKey + trapFocus)
  document.addEventListener('keydown', onKey);
  document.addEventListener('keydown', trapFocus);

  // Auto-focus primary button after a frame so DOM is settled
  requestAnimationFrame(() => {
    const primary = dialog.querySelector('.modal-btn-primary');
    if (primary) /** @type {HTMLElement} */ (primary).focus();
  });

  // Return teardown function
  return function teardown() {
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('keydown', trapFocus);
    overlay.remove();
    // Restore focus to the element that was focused before opening.
    if (previouslyFocused && 'focus' in previouslyFocused) {
      /** @type {HTMLElement} */ (previouslyFocused).focus();
    }
  };
}

/* --- Public API --- */

/**
 * Create and show a confirmation dialog (replaces window.confirm).
 *
 * @param {string} message  the message to display
 * @param {object} [opts]
 * @param {string} [opts.title]       dialog title (default: 'Confirm')
 * @param {string} [opts.confirmText] confirm button text (default: 'OK')
 * @param {string} [opts.cancelText]  cancel button text (default: 'Cancel')
 * @param {boolean} [opts.danger]     when true, confirm button uses destructive styling
 * @returns {Promise<boolean>} true if confirmed, false if cancelled
 */
export function showConfirm(message, opts = {}) {
  return new Promise((resolve) => {
    const { title = 'Confirm', confirmText = 'OK', cancelText = 'Cancel', danger = false } = opts;

    let resolved = false;
    /** @type {() => void} */
    let teardown;

    /** @param {boolean} result */
    function close(result) {
      if (resolved) return;
      resolved = true;
      teardown();
      resolve(result);
    }

    /** @param {KeyboardEvent} e */
    function onKey(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        close(true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        close(false);
      }
    }

    const overlay = buildOverlay();
    const dialog = buildDialog(title, message, [
      { text: cancelText, action: () => close(false), isSecondary: true },
      { text: confirmText, action: () => close(true), isDanger: danger },
    ]);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    teardown = setupModalLifecycle(overlay, dialog, onKey);
  });
}

/**
 * Create and show an alert dialog (replaces window.alert).
 *
 * Clicking the overlay (outside the dialog) dismisses the alert —
 * this is safe because showAlert has no destructive consequence.
 *
 * @param {string} message  the message to display
 * @param {object} [opts]
 * @param {string} [opts.title]   dialog title (default: 'Notice')
 * @param {string} [opts.okText]  OK button text (default: 'OK')
 * @returns {Promise<void>}
 */
export function showAlert(message, opts = {}) {
  return new Promise((resolve) => {
    const { title = 'Notice', okText = 'OK' } = opts;

    let resolved = false;
    /** @type {() => void} */
    let teardown;

    function close() {
      if (resolved) return;
      resolved = true;
      teardown();
      resolve();
    }

    /** @param {KeyboardEvent} e */
    function onKey(e) {
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    }

    const overlay = buildOverlay();
    const dialog = buildDialog(title, message, [{ text: okText, action: () => close() }]);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    teardown = setupModalLifecycle(overlay, dialog, onKey);

    // Overlay-click dismiss — only for non-destructive alerts.
    // showConfirm does NOT get this (to prevent accidental data loss).
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
  });
}

/* --- Internal DOM builders --- */

/**
 * Build the semi-transparent full-screen overlay backdrop.
 * @returns {HTMLDivElement}
 */
function buildOverlay() {
  const div = document.createElement('div');
  div.className = 'modal-overlay';
  return div;
}

/**
 * Build the dialog card with title, message, and action buttons.
 *
 * Uses a unique counter-based ID for `aria-labelledby` so concurrent
 * dialogs don't collide.
 *
 * @param {string} title
 * @param {string} message
 * @param {Array<{text: string, action: () => void, isSecondary?: boolean, isDanger?: boolean}>} buttons
 * @returns {HTMLDivElement}
 */
function buildDialog(title, message, buttons) {
  const dialog = document.createElement('div');
  dialog.className = 'modal';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');

  // Generate a unique ID for this dialog's title element.
  const titleId = `modal-title-${++modalIdCounter}`;

  // Title
  const titleEl = document.createElement('div');
  titleEl.className = 'modal-title';
  titleEl.textContent = title;
  titleEl.id = titleId;
  dialog.appendChild(titleEl);
  dialog.setAttribute('aria-labelledby', titleId);

  // Message
  const msgEl = document.createElement('div');
  msgEl.className = 'modal-message';
  msgEl.textContent = message;
  dialog.appendChild(msgEl);

  // Buttons
  const actions = document.createElement('div');
  actions.className = 'modal-actions';
  for (const btn of buttons) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = btn.text;
    if (btn.isSecondary) {
      button.className = 'modal-btn-secondary';
    } else if (btn.isDanger) {
      button.className = 'modal-btn-primary modal-btn-danger';
    } else {
      button.className = 'modal-btn-primary';
    }
    button.addEventListener('click', btn.action);
    actions.appendChild(button);
  }
  dialog.appendChild(actions);

  return dialog;
}
