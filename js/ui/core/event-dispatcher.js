/**
 * event-dispatcher.js — Single coordinated event dispatcher for the editor.
 *
 * Instead of each setup function adding its own delegated `change`/`input`
 * listener on `#app` (9+ listeners in total), this module attaches exactly
 * ONE listener per event type and routes the event to all registered
 * handlers in registration order.
 *
 * Benefits:
 *   - Explicit, predictable handler ordering (registration order = module
 *     load order)
 *   - Fewer listeners on the root element
 *   - Easier to debug (a single choke point for all change/input events)
 *
 * Usage:
 *   import { registerChangeHandler, registerInputHandler } from './event-dispatcher.js';
 *
 *   export function setupMyFeature() {
 *     registerChangeHandler((e) => {
 *       const sel = e.target;
 *       if (!(sel instanceof HTMLSelectElement)) return;
 *       // ... handler logic ...
 *     });
 *   }
 *
 * The dispatcher auto-initializes on first registration, so existing tests
 * that call setup* functions directly (without calling initApp) continue
 * to work.
 */

/** @type {Array<(e: Event) => void>} */
const changeHandlers = [];

/** @type {Array<(e: Event) => void>} */
const inputHandlers = [];

let dispatcherInitialized = false;

/**
 * Attach the single `change` and `input` listeners on `#app`.
 * Called automatically on first handler registration.
 */
function initDispatcher() {
  if (dispatcherInitialized) return;
  dispatcherInitialized = true;

  // Attach to document so events from any element (including dynamically
  // created #app containers in tests) are captured. Each registered
  // handler has its own guards to filter relevant events.
  document.addEventListener('change', (e) => {
    for (const handler of changeHandlers) {
      try {
        handler(e);
      } catch (err) {
        console.error('Change handler error:', err);
      }
    }
  });

  document.addEventListener('input', (e) => {
    for (const handler of inputHandlers) {
      try {
        handler(e);
      } catch (err) {
        console.error('Input handler error:', err);
      }
    }
  });
}

/**
 * Register a handler to be called on every `change` event within `#app`.
 * Handlers run in registration order (module load order).
 *
 * The dispatcher auto-initializes on first registration.
 *
 * @param {(e: Event) => void} handler
 */
export function registerChangeHandler(handler) {
  initDispatcher();
  changeHandlers.push(handler);
}

/**
 * Register a handler to be called on every `input` event within `#app`.
 * Handlers run in registration order (module load order).
 *
 * The dispatcher auto-initializes on first registration.
 *
 * @param {(e: Event) => void} handler
 */
export function registerInputHandler(handler) {
  initDispatcher();
  inputHandlers.push(handler);
}

/**
 * Clear all registered change and input handlers.
 *
 * Called by `destroyApp()` so that a subsequent `initApp()` re-registers
 * handlers from scratch instead of accumulating duplicates.  The two
 * document-level listeners are NOT removed (they are cheap, always-present,
 * and iterate whatever handlers are currently in the arrays).
 */
export function resetDispatcher() {
  changeHandlers.length = 0;
  inputHandlers.length = 0;
}
