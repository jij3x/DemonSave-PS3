/**
 * form-render.js — Form population/collection, durability sync, and
 * tooltip sync.
 *
 * Handles rendering the save model into the DOM (populateForm) and
 * collecting form values back into a model (collectForm).  Also sets up
 * durability auto-sync when the user changes an item, and tooltip auto-sync
 * when the user selects a different item in any item-name select.
 */

import * as db from '../../des-db/index.js';
import { resetAndCaptureBaseline } from '../core/dirty.js';
import {
  setVal,
  getVal,
  getEqId,
  EQ_CATEGORY,
  setEquipmentText,
  refreshEquipmentDisplay,
} from '../core/dom-helpers.js';
import { updateHairColorSample, updateWorldName } from './form-helpers.js';
import { lookupMaxDurability, getItemNote, updateSelectTooltip } from '../core/item-helpers.js';
import { validateName } from '../core/constants.js';
import { registerChangeHandler } from '../core/event-dispatcher.js';
import { renderInventory, collectInventory } from '../tables/inventory-table.js';
import { renderSpellTable, collectSpells } from '../tables/spell-table.js';
import { renderDeposit, collectDeposit } from '../tables/deposit-table.js';

/**
 * Numeric input IDs that should NOT be clamped to their min/max attributes
 * during collectForm().  These fields have no fixed upper bound in the
 * save format, or the HTML min/max is advisory only.
 */
const SKIP_CLAMP_IDS = new Set([
  'profileNum', // folder-level SFO field, handled separately
  // position/tendency fields have no game-enforced bounds
]);

/* ------------------------------------------------------------------ */
/* Form model → DOM                                                    */
/* ------------------------------------------------------------------ */

/**
 * Populate the DOM form from a parsed save model.
 *
 * After rendering, captures a dirty-tracking baseline and clears any
 * stale dirty marks from a previous editing session.
 *
 * @param {Record<string, any>} m           the save model
 * @param {Record<string, any>|undefined} display  display-only data (equipment pointers, invIdxByRef)
 * @param {number} profileNum              SFO profile number
 */
export function populateForm(m, display, profileNum) {
  // Cancel any pending debounced equipment refresh so a stale timer
  // (scheduled before a slot switch) doesn't scan the just-rendered DOM
  // and corrupt equipment spans based on outdated state.
  refreshEquipmentDisplay.cancel();

  // Character
  setVal('name', m.name);
  setVal('gender', m.gender);
  setVal('startClass', m.startClass);
  setVal('phantomType', m.phantomType);
  setVal('clearCount', m.clearCount);
  setVal('archSealed', m.archSealed);
  setVal('profileNum', profileNum);
  setVal('accountId', m.accountId || '');

  // Vitals
  setVal('currHP', m.currHP);
  setVal('currMaxHP', m.currMaxHP);
  setVal('maxHP', m.maxHP);
  setVal('currMP', m.currMP);
  setVal('currMaxMP', m.currMaxMP);
  setVal('maxMP', m.maxMP);
  setVal('currStam', m.currStam);
  setVal('currMaxStam', m.currMaxStam);
  setVal('maxStam', m.maxStam);

  // Stats
  setVal('vit', m.vit);
  setVal('int', m.int);
  setVal('end', m.end);
  setVal('str', m.str);
  setVal('dex', m.dex);
  setVal('magic', m.magic);
  setVal('faith', m.faith);
  setVal('luck', m.luck);
  setVal('souls', m.souls);
  setVal('soulMem', m.soulMem);
  setVal('levelsPurchased', m.levelsPurchased);

  // Position
  setVal('world', m.world);
  setVal('block', m.block);
  setVal('xpos', m.x);
  setVal('ypos', m.y);
  setVal('zpos', m.z);
  setVal('rot', m.rot);
  updateWorldName(m.world);

  // Equipment — read-only text spans; display the item name, store the raw
  // ID in data-id for write-back via collectForm().
  // resetOrig=true re-captures data-orig-id so the undelete-restore baseline
  // matches the current slot (not a stale value from a previous slot).
  setEquipmentText('leftHand1', m.leftHand1, EQ_CATEGORY.leftHand1, true);
  setEquipmentText('rightHand1', m.rightHand1, EQ_CATEGORY.rightHand1, true);
  setEquipmentText('leftHand2', m.leftHand2, EQ_CATEGORY.leftHand2, true);
  setEquipmentText('rightHand2', m.rightHand2, EQ_CATEGORY.rightHand2, true);
  setEquipmentText('arrows', m.arrows, EQ_CATEGORY.arrows, true);
  setEquipmentText('bolts', m.bolts, EQ_CATEGORY.bolts, true);
  setEquipmentText('helmet', m.helmet, EQ_CATEGORY.helmet, true);
  setEquipmentText('chest', m.chest, EQ_CATEGORY.chest, true);
  setEquipmentText('gauntlets', m.gauntlets, EQ_CATEGORY.gauntlets, true);
  setEquipmentText('leggings', m.leggings, EQ_CATEGORY.leggings, true);
  // hairstyle is an editable <select> in the Character tab
  setVal('hairstyle', m.hairstyle);
  setEquipmentText('ring1', m.ring1, EQ_CATEGORY.ring1, true);
  setEquipmentText('ring2', m.ring2, EQ_CATEGORY.ring2, true);
  setEquipmentText('quickSlot1', m.quickSlot1, EQ_CATEGORY.quickSlot1, true);
  setEquipmentText('quickSlot2', m.quickSlot2, EQ_CATEGORY.quickSlot2, true);
  setEquipmentText('quickSlot3', m.quickSlot3, EQ_CATEGORY.quickSlot3, true);
  setEquipmentText('quickSlot4', m.quickSlot4, EQ_CATEGORY.quickSlot4, true);
  setEquipmentText('quickSlot5', m.quickSlot5, EQ_CATEGORY.quickSlot5, true);

  // Store equipment pointer values (from display-only data) as data-ro-idx1
  // for deterministic equipment-inventory binding (handles duplicate items).
  const eqPointers = display?.equipmentPointers || {};
  for (const [eqId, ptr] of Object.entries(eqPointers)) {
    if (ptr === undefined) continue;
    const span = document.getElementById(eqId);
    if (span) {
      span.dataset.roIdx1 = String(ptr);
    }
  }

  // Spells
  setVal('spellSlots', m.spellSlots);
  setVal('miracleSlots', m.miracleSlots);
  setVal('hairR', m.hairR);
  setVal('hairG', m.hairG);
  setVal('hairB', m.hairB);
  updateHairColorSample();
  renderSpellTable(m.spells);

  // Tendency
  setVal('charTendency', m.charTendency);
  setVal('nexusTendency', m.nexusTendency);
  setVal('w1Tendency', m.w1Tendency);
  setVal('w2Tendency', m.w2Tendency);
  setVal('w3Tendency', m.w3Tendency);
  setVal('w4Tendency', m.w4Tendency);
  setVal('w5Tendency', m.w5Tendency);

  // NPC flags — determine which state is active for each NPC (single-select)
  // Sage Freke: friendly, hostile, or dead (only one at a time)
  if (m.sageFreke?.dead) setVal('sageFreke', 'dead');
  else if (m.sageFreke?.hostile) setVal('sageFreke', 'hostile');
  else if (m.sageFreke?.friendly) setVal('sageFreke', 'friendly');
  else setVal('sageFreke', '');
  // Thomas: friendly, hostile, or dead (only one at a time)
  if (m.thomas?.dead) setVal('thomas', 'dead');
  else if (m.thomas?.hostile) setVal('thomas', 'hostile');
  else if (m.thomas?.friendly) setVal('thomas', 'friendly');
  else setVal('thomas', '');
  // Boldwin: friendly, hostile, or dead (only one at a time)
  if (m.boldwin?.dead) setVal('boldwin', 'dead');
  else if (m.boldwin?.hostile) setVal('boldwin', 'hostile');
  else if (m.boldwin?.friendly) setVal('boldwin', 'friendly');
  else setVal('boldwin', '');

  // Inventory — pass display.invIdxByRef for deterministic equipment binding.
  const invIdxByRef = display?.invIdxByRef;
  renderInventory('weapons', m.weapons, invIdxByRef);
  renderInventory('armor', m.armor, invIdxByRef);
  renderInventory('rings', m.rings, invIdxByRef);
  renderInventory('goods', m.goods, invIdxByRef);

  // Thomas Storage (Deposit)
  renderDeposit(m.deposit || []);

  // Capture dirty-tracking baseline from the just-rendered DOM state,
  // and clear any stale dirty marks from a previous slot / session.
  // resetAndCaptureBaseline combines both operations into a single DOM walk.
  resetAndCaptureBaseline();
}

/* ------------------------------------------------------------------ */
/* DOM → Form model                                                    */
/* ------------------------------------------------------------------ */

/**
 * Read a numeric input value, clamped to its HTML min/max attributes.
 *
 * Does NOT mutate the DOM — the clamped value is returned for use in
 * the model.  This avoids confusing UX where a "read" operation
 * silently changes visible inputs.
 *
 * @param {string} id  element id
 * @returns {number} clamped numeric value (0 if empty/invalid)
 */
function getNumClamped(id) {
  const el = /** @type {HTMLInputElement} */ (document.getElementById(id));
  if (!el) return 0;
  const raw = parseFloat(el.value);
  if (isNaN(raw)) return 0;
  // Clamp to min/max attributes (unless explicitly skipped)
  if (!SKIP_CLAMP_IDS.has(id)) {
    const min = el.min !== '' ? parseFloat(el.min) : undefined;
    const max = el.max !== '' ? parseFloat(el.max) : undefined;
    if (min !== undefined && raw < min) return min;
    if (max !== undefined && raw > max) return max;
  }
  return raw;
}

/**
 * Validate and collect the current DOM form values into a save model object.
 *
 * Soft-deleted rows (data-deleted="true") are skipped — their data
 * is excluded from the model so the writer clears their physical slots.
 *
 * Numeric inputs with `min`/`max` attributes are clamped to their valid
 * range **in-memory** (the DOM is not mutated).  The `accountId` field
 * is validated as 32 hex chars (or empty).  Returns null if validation
 * fails — the caller should check for null and abort the save.
 *
 * @returns {(import('../../des-savefile/model.js').SanitizedModel|null)}
 *   The collected model, or null if validation failed.
 */
export function collectForm() {
  // --- Validate accountId: must be empty or 32 hex characters ---
  const rawAccountId = getVal('accountId') || '';
  const trimmedAccountId = rawAccountId.trim();
  if (trimmedAccountId !== '' && !/^[0-9a-fA-F]{32}$/.test(trimmedAccountId)) {
    return null;
  }

  // --- Validate name: must be ≤16 chars with no control characters ---
  const nameResult = validateName(getVal('name'));
  if (!nameResult.valid) {
    return null;
  }

  return {
    world: getNumClamped('world'),
    block: getNumClamped('block'),
    x: getNumClamped('xpos'),
    y: getNumClamped('ypos'),
    z: getNumClamped('zpos'),
    rot: getNumClamped('rot'),

    // Vitals
    currHP: getNumClamped('currHP'),
    currMaxHP: getNumClamped('currMaxHP'),
    maxHP: getNumClamped('maxHP'),
    currMP: getNumClamped('currMP'),
    currMaxMP: getNumClamped('currMaxMP'),
    maxMP: getNumClamped('maxMP'),
    currStam: getNumClamped('currStam'),
    currMaxStam: getNumClamped('currMaxStam'),
    maxStam: getNumClamped('maxStam'),

    vit: getNumClamped('vit'),
    int: getNumClamped('int'),
    end: getNumClamped('end'),
    str: getNumClamped('str'),
    dex: getNumClamped('dex'),
    magic: getNumClamped('magic'),
    faith: getNumClamped('faith'),
    luck: getNumClamped('luck'),
    souls: getNumClamped('souls'),
    soulMem: getNumClamped('soulMem'),
    levelsPurchased: getNumClamped('levelsPurchased'),

    phantomType: getNumClamped('phantomType'),
    name: getVal('name'),
    gender: getNumClamped('gender'),
    startClass: getNumClamped('startClass'),

    // Equipment spans: read raw ID from data-id attribute.
    leftHand1: getEqId('leftHand1'),
    rightHand1: getEqId('rightHand1'),
    leftHand2: getEqId('leftHand2'),
    rightHand2: getEqId('rightHand2'),
    arrows: getEqId('arrows'),
    bolts: getEqId('bolts'),
    helmet: getEqId('helmet'),
    chest: getEqId('chest'),
    gauntlets: getEqId('gauntlets'),
    leggings: getEqId('leggings'),
    // hairstyle is still an editable <select>
    hairstyle: parseInt(getVal('hairstyle'), 10) || 0,
    ring1: getEqId('ring1'),
    ring2: getEqId('ring2'),
    quickSlot1: getEqId('quickSlot1'),
    quickSlot2: getEqId('quickSlot2'),
    quickSlot3: getEqId('quickSlot3'),
    quickSlot4: getEqId('quickSlot4'),
    quickSlot5: getEqId('quickSlot5'),

    weapons: collectInventory('weapons'),
    armor: collectInventory('armor'),
    rings: collectInventory('rings'),
    goods: collectInventory('goods'),
    deposit: collectDeposit(),

    spellSlots: getNumClamped('spellSlots'),
    miracleSlots: getNumClamped('miracleSlots'),
    hairR: getNumClamped('hairR'),
    hairG: getNumClamped('hairG'),
    hairB: getNumClamped('hairB'),
    accountId: trimmedAccountId,
    spells: collectSpells(),

    charTendency: getNumClamped('charTendency'),
    nexusTendency: getNumClamped('nexusTendency'),
    w1Tendency: getNumClamped('w1Tendency'),
    w2Tendency: getNumClamped('w2Tendency'),
    w3Tendency: getNumClamped('w3Tendency'),
    w4Tendency: getNumClamped('w4Tendency'),
    w5Tendency: getNumClamped('w5Tendency'),

    clearCount: getNumClamped('clearCount'),
    archSealed: getVal('archSealed'),

    sageFreke: {
      friendly: getVal('sageFreke') === 'friendly',
      hostile: getVal('sageFreke') === 'hostile',
      dead: getVal('sageFreke') === 'dead',
    },
    thomas: {
      friendly: getVal('thomas') === 'friendly',
      hostile: getVal('thomas') === 'hostile',
      dead: getVal('thomas') === 'dead',
    },
    boldwin: {
      friendly: getVal('boldwin') === 'friendly',
      hostile: getVal('boldwin') === 'hostile',
      dead: getVal('boldwin') === 'dead',
    },
  };
}

/* ------------------------------------------------------------------ */
/* Durability sync                                                     */
/* ------------------------------------------------------------------ */

/**
 * Attach a delegated change listener that syncs the durability input when
 * the item in an inventory or deposit row is changed.
 *
 * When a user switches the item (e.g. Dagger → Long Sword), the durability
 * field must be reloaded to reflect the new item's max durability from the
 * des-db.  Weapons and armor have durability values; rings and goods do not
 * (durability resets to 0).
 *
 * Skips placeholder selections (empty value) and soft-deleted rows.
 */
export function setupDurabilitySync() {
  registerChangeHandler((e) => {
    const sel = e.target;
    if (!(sel instanceof HTMLSelectElement)) return;
    if (!sel.classList.contains('inv-name') && !sel.classList.contains('dep-name')) return;

    // Skip placeholder selections (no real item chosen yet)
    if (!sel.value) return;

    const tr = sel.closest('tr');
    if (!tr) return;

    // Skip soft-deleted rows
    if (tr.dataset.deleted === 'true') return;

    // Determine category from the select's lazy-load dataset
    const category = sel.dataset.lazyCat;
    if (!category) return;

    const newItemId = parseInt(sel.value, 10) || 0;
    const maxDur = lookupMaxDurability(/** @type {any} */ (category), newItemId);

    // Update the durability input in the same row (if visible).
    // For non-durability types the value is stored in tr.dataset instead.
    const durInput =
      /** @type {HTMLInputElement|null} */ (tr.querySelector('.inv-durability')) ||
      /** @type {HTMLInputElement|null} */ (tr.querySelector('.inv-dep-durability'));
    if (durInput) {
      durInput.value = String(maxDur);
    } else {
      tr.dataset.durability = String(maxDur);
    }
  });
}

/* ------------------------------------------------------------------ */
/* Tooltip sync: update data-tooltip on item selection change          */
/* ------------------------------------------------------------------ */

/**
 * Attach a delegated change listener that updates the note-based tooltip
 * when the user selects a different item in any item-name select.
 *
 * Handles:
 *   - .inv-name selects (Inventory tab)
 *   - .spell-name selects (Spells tab)
 *   - .dep-name selects (Thomas's Storage, non-decomposed rows)
 *   - .dep-base-weapon selects (Thomas's Storage, decomposed weapon rows)
 *
 * For decomposed weapon rows, the tooltip on the base weapon select is
 * updated with the base weapon's note (the most relevant info for that
 * layout).
 */
export function setupSelectTooltipSync() {
  registerChangeHandler((e) => {
    const sel = e.target;
    if (!(sel instanceof HTMLSelectElement)) return;

    // Skip placeholder selections (no real item chosen yet)
    if (!sel.value) {
      sel.removeAttribute('data-tooltip');
      return;
    }

    // Decomposed deposit weapon rows: update base weapon tooltip from
    // the base weapon's note in rel-upgrades.js.
    if (sel.classList.contains('dep-base-weapon')) {
      const baseId = parseInt(sel.value, 10);
      if (baseId) {
        let note = null;
        try {
          note = db.getBaseWeapon(baseId)?.note ?? null;
        } catch {
          /* no note */
        }
        updateSelectTooltip(sel, note);
      } else {
        sel.removeAttribute('data-tooltip');
      }
      return;
    }

    // Standard item-name selects: look up category from dataset.
    const category = sel.dataset.lazyCat;
    if (!category) return;

    // For inventory/spell selects, the value IS the item ID.
    // For deposit non-decomposed selects, the value is also the item ID.
    // For deposit decomposed rows, the item is recomposed from 3 selects,
    // and the base weapon tooltip is handled above — skip here.
    const itemId = parseInt(sel.value, 10) || 0;
    if (!itemId) return;

    updateSelectTooltip(sel, getItemNote(/** @type {any} */ (category), itemId));
  });
}
