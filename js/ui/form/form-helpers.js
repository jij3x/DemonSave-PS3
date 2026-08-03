/**
 * form-helpers.js — Shared form-display utilities used by both
 * form-render.js (during rendering) and ui-setup.js (on user input).
 *
 * Extracted to prevent duplication and ensure both call sites use
 * identical logic for hair color swatch and world name display.
 */

import { getWorldName } from '../../des-db/index.js';
import { getVal } from '../core/dom-helpers.js';

/**
 * Update the hair color sample swatch from the R/G/B input values.
 *
 * Called from populateForm (during rendering) and from the input
 * listener set up by setupHairColorSample in ui-setup.js.
 */
export function updateHairColorSample() {
  const sample = document.getElementById('hairColorSample');
  if (!sample) return;
  const r = parseFloat(getVal('hairR')) || 0;
  const g = parseFloat(getVal('hairG')) || 0;
  const b = parseFloat(getVal('hairB')) || 0;
  sample.style.background = `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
}

/**
 * Update the world name display.
 *
 * Called from populateForm during rendering and from the warp/world
 * change listeners in ui-setup.js.
 *
 * @param {number} world  world index
 */
export function updateWorldName(world) {
  const el = document.getElementById('worldName');
  if (!el) return;
  try {
    el.textContent = getWorldName(world);
  } catch {
    el.textContent = '';
  }
}
