/**
 * item-helpers.js — Item/type lookups, durability lookup, dropdown width,
 * and select-tooltip management.
 *
 * Bridges the des-db and controls layers for item resolution helpers used
 * by inventory, spell, and deposit table renderers.
 */

import * as db from '../../des-db/index.js';
import { getItemDurability } from '../../des-db/index.js';
import { SELECT_WIDTHS } from './controls.js';

/**
 * Format an unknown item ID as a human-readable "Unknown (0x...)" string.
 *
 * Centralized so all call sites (inventory, deposit, spell tables +
 * equipment display) use identical formatting.
 *
 * @param {number} id  raw item ID (unsigned 32-bit)
 * @returns {string}
 */
export function formatUnknownItem(id) {
  return `Unknown (0x${(id >>> 0).toString(16).toUpperCase().padStart(8, '0')})`;
}

/* --- O(1) item-index lookup (cached via WeakMap on frozen id arrays) --- */

/**
 * Cache of id-array → Map<itemId, index>.
 *
 * The id arrays exported from controls.js are frozen (immutable), so the
 * cache is always valid for a given array reference.  Each unique array
 * builds its Map exactly once (lazily, on first lookup) and reuses it
 * on all subsequent calls.
 */
const _indexMapCache = new WeakMap();

/**
 * Look up the index of an item ID in an id array — O(1) after first use.
 *
 * The id arrays are frozen at module load, so the cached index Map is
 * always correct.
 *
 * @param {number[]} ids  frozen id array from controls.js
 * @param {number} id     item ID to find
 * @returns {number} index, or -1 if not found
 */
export function findItemIndex(ids, id) {
  let map = _indexMapCache.get(ids);
  if (!map) {
    map = new Map();
    for (let i = 0; i < ids.length; i++) {
      map.set(ids[i], i);
    }
    _indexMapCache.set(ids, map);
  }
  return map.has(id) ? map.get(id) : -1;
}

/**
 * Compute the SELECT_WIDTHS key for a given category/type/deposit combination.
 *
 * Shared by applyItemSelectWidth (item-helpers.js) and selectWidthFor
 * (dom.js) so both use identical logic and cannot drift apart.
 *
 * @param {string} category           des-db category ('weapons'|'armor'|'rings'|'goods'|'spells')
 * @param {number|null} typeId        weapon/goods type filter (null = unfiltered)
 * @param {boolean} [isDeposit=false] true for deposit selects (uses filtered weapon data)
 * @returns {string} key into SELECT_WIDTHS
 */
export function selectWidthKey(category, typeId, isDeposit = false) {
  if (category === 'spells') {
    return 'spells';
  } else if (category === 'weapons' && typeId != null) {
    return isDeposit ? `weapons-${typeId}-deposit` : `weapons-${typeId}`;
  } else if (category === 'goods' && typeId != null) {
    return `goods-${typeId}`;
  } else {
    return category; // armor, rings, goods (unfiltered)
  }
}

/**
 * Set a pre-computed fixed width on an item-name select so it fits the
 * longest selectable item in its list (plus arrow/padding overhead).
 *
 * All widths are pre-computed at module load time in controls.js (see
 * SELECT_WIDTHS) — no runtime measurement needed.
 *
 * @param {HTMLSelectElement} sel     the item-name select to size
 * @param {string} category           des-db category ('weapons'|'armor'|'rings'|'goods'|'spells')
 * @param {number|null} typeId        weapon/goods type filter (null = unfiltered)
 * @param {boolean} [isDeposit=false] true for deposit selects (uses filtered weapon data)
 */
export function applyItemSelectWidth(sel, category, typeId, isDeposit = false) {
  const key = selectWidthKey(category, typeId, isDeposit);
  sel.style.width = `${SELECT_WIDTHS[key]}px`;
}

/**
 * Resolve the weapon type ID for a given item by looking it up in the DB.
 * Returns 1 (Weapon) as a fallback for unknown items or items not in the DB.
 * @param {number} itemId
 * @returns {number} typeId (1=Weapon, 2=Shield, 3=Bow, 4=Ammo, 6=Casting Tool)
 */
export function getWeaponTypeId(itemId) {
  if (itemId === undefined || itemId === 0) return 1;
  try {
    const item = db.getItem('weapons', itemId);
    return item.type?.[0] ?? 1;
  } catch {
    return 1; // unknown item — default to type 1 (Weapon)
  }
}

/**
 * Resolve the goods type ID for a given item by looking it up in the DB.
 * Returns 9 (Ore) as a fallback for unknown items or items not in the DB.
 * @param {number} itemId
 * @returns {number} typeId (9=Ore, 10=Consumables, 11=Souls, 12=Key Items)
 */
export function getGoodsTypeId(itemId) {
  if (itemId === undefined || itemId === 0) return 9;
  try {
    const item = db.getItem('goods', itemId);
    return item.type?.[0] ?? 9;
  } catch {
    return 9; // unknown item — default to type 9 (Ore)
  }
}

/**
 * Look up the max durability for an item from the des-db.
 *
 * Weapons and armor have a durability field in the DB; all other categories
 * (rings, goods, spells) do not and return 0.  If the lookup fails (unknown
 * item or DB error), falls back to 200 for durability-bearing categories.
 *
 * @param {'weapons'|'armor'|'rings'|'goods'} category
 * @param {number} itemId  raw item ID (unsigned 32-bit)
 * @returns {number} max durability value (0 for non-durability categories)
 */
export function lookupMaxDurability(category, itemId) {
  if (category !== 'weapons' && category !== 'armor') return 0;
  try {
    return getItemDurability(category, itemId) ?? 200;
  } catch {
    return 200;
  }
}

/**
 * Look up the descriptive note for an item from the des-db.
 *
 * Most categories (armor, rings, goods, spells) carry the note directly on
 * the item entry.  Weapons (type 1/2/3) usually don't have a note on the
 * individual upgrade variant — instead, the note lives on the base weapon
 * definition in rel-upgrades.js.  This helper resolves both cases.
 *
 * @param {'weapons'|'armor'|'rings'|'goods'|'spells'} category
 * @param {number} itemId  raw item ID (unsigned 32-bit)
 * @returns {string|null} the note text, or null if no note is available
 */
export function getItemNote(category, itemId) {
  if (!itemId) return null;
  try {
    const item = db.getItem(category, itemId);
    // Direct note on the item entry (armor, rings, goods, spells, and
    // some weapons like casting tools / ammo / special entries).
    if (item.note) return item.note;
    // Weapons without a direct note: resolve via upgrade_ref → base weapon.
    if (category === 'weapons' && Array.isArray(item.upgrade_ref) && item.upgrade_ref[0] != null) {
      try {
        const base = db.getBaseWeapon(item.upgrade_ref[0]);
        if (base?.note) return base.note;
      } catch {
        // base weapon lookup failed — no note
      }
    }
  } catch {
    // item not found or DB error — no note
  }
  return null;
}

/**
 * Set or clear the descriptive note tooltip on an item-name select element.
 *
 * When a note is available, sets data-tooltip so the unified tooltip system
 * shows it on hover.  When no note exists, removes the attribute so no
 * tooltip appears.
 *
 * @param {HTMLSelectElement} sel       the item-name select
 * @param {string|null} note            the note text, or null
 * @param {string} [itemName]           optional display name to prepend
 */
export function updateSelectTooltip(sel, note, itemName) {
  if (note) {
    sel.setAttribute('data-tooltip', itemName ? `${itemName}\n${note}` : note);
  } else {
    sel.removeAttribute('data-tooltip');
  }
}
