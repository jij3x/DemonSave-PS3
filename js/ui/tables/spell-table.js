/**
 * spell-table.js — Spell table rendering and collection.
 */

import { getSpellData, SPELL_STATUS_NAMES, SELECT_WIDTHS } from '../core/controls.js';
import { makeNumCell } from '../core/dom-helpers.js';
import { makeRowDeleteButton, prependPlaceholder } from './select-helpers.js';
import {
  findItemIndex,
  formatUnknownItem,
  getItemNote,
  updateSelectTooltip,
} from '../core/item-helpers.js';

/**
 * Collected spell record — alias of the canonical model type.
 * @typedef {import('../../des-savefile/model.js').SpellRecord} SpellRecord
 */

/**
 * Render spell rows from the save model into the spell table.
 * @param {SpellRecord[]} spells  [{itemId, status, misc1, misc2}]
 */
export function renderSpellTable(spells) {
  const tbody = document.querySelector('#spellsTableBody tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  for (const sp of spells) {
    tbody.appendChild(makeSpellRow(sp, true));
  }
}

/**
 * Create a <tr> for a spell record.
 *
 * @param {Record<string, any>} sp  {itemId, status, misc1, misc2}
 * @param {boolean} [isExisting=true]  true if loaded from save file,
 *   false if user-inserted via the Add button. Determines soft vs. hard
 *   delete behavior.
 */
export function makeSpellRow(sp, isExisting = true) {
  const { ids, names } = getSpellData();
  const tr = document.createElement('tr');

  // Track existing vs. new for delete behavior
  tr.dataset.existing = String(isExisting);
  if (!isExisting) {
    tr.classList.add('row-added');
  }

  // Spell name
  const tdName = document.createElement('td');
  const sel = document.createElement('select');
  sel.className = 'spell-name';
  if (!isExisting) prependPlaceholder(sel);

  // Lazy-load: render only the currently-selected spell's display option.
  // Full option list is populated on first user interaction (setupLazySelects).
  // Fixed width fits the longest spell name in the full list.
  sel.style.width = `${SELECT_WIDTHS.spells}px`;

  let matched = false;
  if (sp.itemId !== undefined && sp.itemId !== 0) {
    const idx = findItemIndex(ids, sp.itemId);
    if (idx >= 0) {
      const opt = document.createElement('option');
      opt.value = String(ids[idx]);
      opt.textContent = names[idx];
      opt.selected = true;
      sel.appendChild(opt);
      matched = true;
    }
  }

  // Handle unknown spell IDs not in the database
  if (!matched && sp.itemId !== undefined && sp.itemId !== 0) {
    const opt = document.createElement('option');
    opt.value = sp.itemId;
    opt.textContent = formatUnknownItem(sp.itemId);
    opt.selected = true;
    sel.appendChild(opt);
  }

  // Set note-based tooltip for the currently-selected spell.
  if (sp.itemId) {
    updateSelectTooltip(sel, getItemNote('spells', sp.itemId));
  }

  tdName.appendChild(sel);
  tr.appendChild(tdName);

  // Status
  const tdStatus = document.createElement('td');
  const statusSel = document.createElement('select');
  statusSel.className = 'spell-status';
  for (let i = 0; i < SPELL_STATUS_NAMES.length; i++) {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = SPELL_STATUS_NAMES[i];
    if (i === (typeof sp.status === 'number' ? sp.status : 0)) opt.selected = true;
    statusSel.appendChild(opt);
  }
  tdStatus.appendChild(statusSel);
  tr.appendChild(tdStatus);

  // Misc1 (sort/category ID) — visible editable input
  tr.appendChild(makeNumCell('inv-spell-misc1', sp.misc1 ?? 0));

  // Misc2 — purpose unknown (always 0 in observed saves); hidden from UI.
  // Preserved via dataset for round-trip fidelity. Uncomment the line below
  // to re-expose as an editable input if its function is determined.
  tr.dataset.misc2 = String(sp.misc2 ?? 0);
  // tr.appendChild(makeNumCell('spell-misc2', sp.misc2 ?? 0));

  // Delete
  const tdDel = document.createElement('td');
  tdDel.appendChild(makeRowDeleteButton(tr));
  tr.appendChild(tdDel);

  return tr;
}

/**
 * Collect spell records from the spell table.
 *
 * Soft-deleted rows (data-deleted="true") are skipped.
 *
 * @returns {SpellRecord[]}
 */
export function collectSpells() {
  const tbody = document.querySelector('#spellsTableBody tbody');
  if (!tbody) return [];
  const spells = [];
  for (const tr of tbody.querySelectorAll('tr')) {
    // Skip soft-deleted rows
    if (tr.dataset.deleted === 'true') continue;

    // Skip unselected new rows (placeholder still active)
    const spellNameSel = /** @type {HTMLSelectElement|null} */ (tr.querySelector('.spell-name'));
    if (!spellNameSel?.value) continue;

    const spellStatusSel = /** @type {HTMLSelectElement|null} */ (
      tr.querySelector('.spell-status')
    );
    const spellMisc1Inp = /** @type {HTMLInputElement|null} */ (
      tr.querySelector('.inv-spell-misc1')
    );
    spells.push({
      itemId: parseInt(spellNameSel?.value ?? '', 10) || 0,
      status: parseInt(spellStatusSel?.value ?? '', 10) || 0,
      misc1: parseInt(spellMisc1Inp?.value ?? '', 10) || 0,
      misc2: parseInt(tr.dataset.misc2 ?? '', 10) || 0,
    });
  }
  return spells;
}
