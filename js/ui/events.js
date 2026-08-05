/**
 * events.js — Barrel entry point for the UI event layer.
 *
 * Re-exports the public API from focused sub-modules so that app.js and
 * events.test.js can import from a single location:
 *
 *   import { populateForm, collectForm, ... } from './events.js';
 */

// Re-export dirty-listener setup
export { setupDirtyListeners } from './core/dirty.js';

// Equipment sync
export { setupEquipmentSync } from './core/dom-helpers.js';

// Lazy-load dropdowns
export { setupLazySelects } from './tables/select-helpers.js';

// Deposit weapon sync + count/duplicate sync
export { setupDepositWeaponSync, setupCountAndDuplicateSync } from './tables/deposit-table.js';

// Form render/collect + durability sync (form-render.js)
export {
  populateForm,
  collectForm,
  collectFolderFields,
  setupDurabilitySync,
  setupSelectTooltipSync,
} from './form/form-render.js';

// Tab switching, warp/world, hair color, add-row buttons (ui-setup.js)
export {
  setupHairColorSample,
  setupWarpAndWorld,
  setupTabs,
  setupAddRowButtons,
} from './form/ui-setup.js';
