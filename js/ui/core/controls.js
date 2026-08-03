/**
 * controls.js — Item data tables, combo-box population, weapon/goods type
 * classification, deposit weapon decomposition, and pre-computed dropdown
 * widths.
 *
 * Serves as the central data layer between the des-db and the UI: builds
 * filtered id/name arrays per category and type, exposes helpers for
 * deposit weapon decomposition (base weapon / upgrade path / level), and
 * pre-computes fixed pixel widths for every dropdown at module load.
 */

import * as db from '../../des-db/index.js';
const { getBaseWeapon, hasBaseWeapon, getUpgradePathDef, getWeaponItemByUpgradeRef } = db;

/**
 * Recursively freeze an object and all nested objects/arrays.
 * Used to make exported data arrays/objects immutable so callers can't
 * accidentally corrupt shared state.
 *
 * @template T
 * @param {T} obj
 * @returns {T} the same object, now deeply frozen
 */
function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Object.isFrozen(obj)) return obj;
  // Freeze all nested values first (depth-first), then freeze this object.
  // A WeakSet guard prevents infinite recursion if the object graph
  // contains a cycle where the inner object isn't frozen yet.
  return deepFreezeInternal(obj, new WeakSet());
}

function deepFreezeInternal(obj, seen) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Object.isFrozen(obj)) return obj;
  if (seen.has(obj)) return obj; // cycle guard
  seen.add(obj);
  for (const val of Object.values(obj)) {
    if (val && typeof val === 'object' && !Object.isFrozen(val)) {
      deepFreezeInternal(val, seen);
    }
  }
  return Object.freeze(obj);
}

const WEAPON_IDS = db.getItemIdsByCategory('weapons');
const WEAPON_NAMES = db.getItemNamesByCategory('weapons');

/**
 * Weapon types that appear in the `weapons` category (from rel-types.js).
 * Each entry is { typeId, name } — used to build per-type sub-tabs.
 *
 * type 1 = Weapon (melee), 2 = Shield, 3 = Bow, 4 = Ammo, 6 = Casting Tool.
 */
const WEAPON_TYPES = [
  { typeId: 1, name: 'Weapon' },
  { typeId: 2, name: 'Shield' },
  { typeId: 3, name: 'Bow' },
  { typeId: 4, name: 'Ammo' },
  { typeId: 6, name: 'Casting Tool' },
];

/**
 * Pre-built per-type filtered arrays for weapons.
 *
 * Keyed by typeId → { ids, names }. Built once at module load from the
 * flat WEAPON_IDS/WEAPON_NAMES arrays, using getItem().type[0] to classify
 * each weapon. Unknown items (not in the DB) are excluded from these arrays
 * — they can't be classified, so they don't appear in type-filtered dropdowns.
 */
const WEAPON_TYPE_DATA = {};
for (const { typeId } of WEAPON_TYPES) {
  WEAPON_TYPE_DATA[typeId] = { ids: [], names: [] };
}
for (let i = 0; i < WEAPON_IDS.length; i++) {
  const id = WEAPON_IDS[i];
  try {
    const item = db.getItem('weapons', id);
    const typeId = item.type?.[0];
    if (WEAPON_TYPE_DATA[typeId]) {
      WEAPON_TYPE_DATA[typeId].ids.push(id);
      WEAPON_TYPE_DATA[typeId].names.push(WEAPON_NAMES[i]);
    }
  } catch {
    // Unknown item — skip (can't classify)
  }
}

/**
 * Deposit-specific per-type filtered arrays for weapons.
 *
 * Same as WEAPON_TYPE_DATA but excludes sub_type 0 ("Experimental") items —
 * ghost/test entries that should not be selectable when adding items to
 * Thomas's Storage.  Inventory selects continue using the unfiltered set.
 */
const DEPOSIT_WEAPON_TYPE_DATA = {};
for (const { typeId } of WEAPON_TYPES) {
  DEPOSIT_WEAPON_TYPE_DATA[typeId] = { ids: [], names: [] };
}
for (let i = 0; i < WEAPON_IDS.length; i++) {
  const id = WEAPON_IDS[i];
  try {
    const item = db.getItem('weapons', id);
    const typeId = item.type?.[0];
    const subTypeId = item.type?.[1];
    // Skip Experimental (sub_type 0) items in deposit dropdowns.
    if (subTypeId === 0) continue;
    if (DEPOSIT_WEAPON_TYPE_DATA[typeId]) {
      DEPOSIT_WEAPON_TYPE_DATA[typeId].ids.push(id);
      DEPOSIT_WEAPON_TYPE_DATA[typeId].names.push(WEAPON_NAMES[i]);
    }
  } catch {
    // Unknown item — skip (can't classify)
  }
}

const ARMOR_IDS = db.getItemIdsByCategory('armor');
const ARMOR_NAMES = db.getItemNamesByCategory('armor');
const RING_IDS = db.getItemIdsByCategory('rings');
const RING_NAMES = db.getItemNamesByCategory('rings');
const ITEM_IDS = db.getItemIdsByCategory('goods');
const ITEM_NAMES = db.getItemNamesByCategory('goods');

/**
 * Goods types that appear in the `goods` category (from rel-types.js).
 * Each entry is { typeId, name } — used to build per-type sub-tabs.
 *
 * type 9 = Ore, 10 = Consumables, 11 = Souls, 12 = Key Items.
 */
const GOODS_TYPES = [
  { typeId: 9, name: 'Ore' },
  { typeId: 10, name: 'Consum.' },
  { typeId: 11, name: 'Soul' },
  { typeId: 12, name: 'Key Item' },
];

/**
 * Pre-built per-type filtered arrays for goods.
 *
 * Keyed by typeId → { ids, names }. Built once at module load from the
 * flat ITEM_IDS/ITEM_NAMES arrays, using getItem().type[0] to classify
 * each goods item.
 */
const GOODS_TYPE_DATA = {};
for (const { typeId } of GOODS_TYPES) {
  GOODS_TYPE_DATA[typeId] = { ids: [], names: [] };
}
for (let i = 0; i < ITEM_IDS.length; i++) {
  const id = ITEM_IDS[i];
  try {
    const item = db.getItem('goods', id);
    const typeId = item.type?.[0];
    if (GOODS_TYPE_DATA[typeId]) {
      GOODS_TYPE_DATA[typeId].ids.push(id);
      GOODS_TYPE_DATA[typeId].names.push(ITEM_NAMES[i]);
    }
  } catch {
    // Unknown item — skip (can't classify)
  }
}
const SPELL_IDS = db.getItemIdsByCategory('spells');
const SPELL_NAMES = db.getItemNamesByCategory('spells');
const HAIRSTYLE_IDS = db.getItemIdsByCategory('hairstyles');
const HAIRSTYLE_NAMES = db.getItemNamesByCategory('hairstyles');
const START_CLASS_NAMES = db.getStartClasses();
const WARPS = db.getWarps();

/**
 * Fill a <select> element with option elements.
 * @param {HTMLSelectElement} sel
 * @param {number[]} ids      raw item IDs (used as option values)
 * @param {string[]} names    display names
 */
function fillSelect(sel, ids, names) {
  for (let i = 0; i < names.length; i++) {
    const opt = document.createElement('option');
    opt.value = String(ids[i]);
    opt.textContent = names[i];
    sel.appendChild(opt);
  }
}

/**
 * Populate all combo boxes in the UI with their respective item lists.
 *
 * Equipment slots (LH/RH/arrows/bolts/armor/rings/quick slots) are now
 * read-only text spans — they are NOT populated here.  Their display names
 * are resolved on the fly by populateForm() via db.getItem().
 */
export function populateCombos() {
  // Hairstyle is the only equipment select still present (in Character tab)
  fillSelect(document.getElementById('hairstyle'), HAIRSTYLE_IDS, HAIRSTYLE_NAMES);
  fillSelect(
    document.getElementById('startClass'),
    START_CLASS_NAMES.map((_, i) => i),
    START_CLASS_NAMES,
  );

  // Warp locations (positional index — warps have no game ID)
  const warpSel = document.getElementById('warpLocation');
  for (let i = 0; i < WARPS.length; i++) {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = WARPS[i].name;
    warpSel.appendChild(opt);
  }
}

/**
 * Return the ids and names for a given category, used to populate
 * <select> elements inside table rows.
 * @param {'weapons'|'armor'|'rings'|'goods'} category
 * @returns {{ids: number[], names: string[]}}
 */
export function getCategoryData(category) {
  switch (category) {
    case 'weapons':
      return { ids: WEAPON_IDS, names: WEAPON_NAMES };
    case 'armor':
      return { ids: ARMOR_IDS, names: ARMOR_NAMES };
    case 'rings':
      return { ids: RING_IDS, names: RING_NAMES };
    case 'goods':
      return { ids: ITEM_IDS, names: ITEM_NAMES };
    default:
      return { ids: [], names: [] };
  }
}

/** Spell status names (cllCallStatus) */
export const SPELL_STATUS_NAMES = ['Unavailable', 'Unknown', 'Known', 'Memorized'];

/** Spell ids and names for the spell table dropdown */
export function getSpellData() {
  return { ids: SPELL_IDS, names: SPELL_NAMES };
}

/**
 * List of weapon types that have their own sub-tab within the Weapons tab.
 * @returns {Array<{typeId: number, name: string}>}
 */
export function getWeaponTypes() {
  return WEAPON_TYPES;
}

/**
 * Return the ids and names for a specific weapon type (melee, shield, bow,
 * ammo, casting tool). Used to populate type-filtered dropdowns inside
 * weapon-type sub-tabs.
 *
 * @param {number} typeId  1=Weapon, 2=Shield, 3=Bow, 4=Ammo, 6=Casting Tool
 * @returns {{ids: number[], names: string[]}}
 */
export function getWeaponTypeData(typeId) {
  return WEAPON_TYPE_DATA[typeId] || { ids: [], names: [] };
}

/**
 * Return the ids and names for a specific weapon type, filtered for deposit
 * (Thomas's Storage) dropdowns.  Excludes sub_type 0 ("Experimental") items.
 *
 * @param {number} typeId  1=Weapon, 2=Shield, 3=Bow, 4=Ammo, 6=Casting Tool
 * @returns {{ids: number[], names: string[]}}
 */
export function getWeaponTypeDataForDeposit(typeId) {
  return DEPOSIT_WEAPON_TYPE_DATA[typeId] || { ids: [], names: [] };
}

/**
 * List of goods types that have their own sub-tab.
 * @returns {Array<{typeId: number, name: string}>}
 */
export function getGoodsTypes() {
  return GOODS_TYPES;
}

/**
 * Determine whether a given category/type combination should show a
 * durability column in the UI.
 *
 * Weapons (except Ammo), Armor have durability values.  Ammo, all Goods
 * types, and Rings do not — their durability is always 0 and is hidden
 * from the UI (preserved losslessly via tr.dataset for round-trip fidelity).
 *
 * @param {'weapons'|'armor'|'rings'|'goods'} category
 * @param {number|null} [typeId]  weapon/goods type ID (null for armor/rings)
 * @returns {boolean}  true if durability should be visible for this type
 */
export function isDurabilityVisible(category, typeId) {
  switch (category) {
    case 'weapons':
      // Ammo (type 4) has no durability; all other weapon types do.
      return typeId !== 4;
    case 'armor':
      return true;
    case 'rings':
    case 'goods':
      return false;
    default:
      return true;
  }
}

/**
 * Determine whether a given category/type combination should show a
 * count (quantity) column in the UI.
 *
 * Counted items (Ammo, Ore, Consumables, Souls, Key Items) display a
 * count and disallow duplicate entries.  Non-counted items (Weapon,
 * Shield, Bow, Casting Tool, Armor, Ring) always have count=1 and are
 * allowed to be added multiple times.
 *
 * @param {'weapons'|'armor'|'rings'|'goods'} category
 * @param {number|null} [typeId]  weapon/goods type ID (null for armor/rings)
 * @returns {boolean}  true if count should be visible for this type
 */
export function isCountVisible(category, typeId) {
  switch (category) {
    case 'weapons':
      // Only Ammo (type 4) has a count; all other weapon types are 1.
      return typeId === 4;
    case 'goods':
      // All goods types (Ore/Consumables/Souls/Key Items) have counts.
      return true;
    case 'armor':
    case 'rings':
      return false;
    default:
      return true;
  }
}

/**
 * Count range limits by location.
 */
export const COUNT_LIMITS = {
  inventory: { min: 1, max: 99 },
  deposit: { min: 1, max: 999 },
};

/**
 * Return the ids and names for a specific goods type (ore, consumables,
 * souls, key items). Used to populate type-filtered dropdowns inside
 * goods-type sub-tabs.
 *
 * @param {number} typeId  9=Ore, 10=Consumables, 11=Souls, 12=Key Items
 * @returns {{ids: number[], names: string[]}}
 */
export function getGoodsTypeData(typeId) {
  return GOODS_TYPE_DATA[typeId] || { ids: [], names: [] };
}

/* ------------------------------------------------------------------ */
/* Deposit weapon decomposition: base weapon / path / level helpers    */
/* ------------------------------------------------------------------ */

/**
 * Pre-built per-type lists of base weapons.
 *
 * Includes ALL base weapons that have an `upgrade_ref` in the weapons DB —
 * both upgradable (entries 1-68, with path_ids) and non-upgradable (entries
 * 69-89, with [id, null, null] refs).  Keyed by typeId (1=Weapon, 2=Shield,
 * 3=Bow).  Each entry is { baseId, name }.
 *
 * The type of each base weapon is determined by looking up its first
 * upgrade_ref entry (e.g. [baseId, pathIds[0], 0]) in the weapons DB and
 * reading item.type[0].
 */
const BASE_WEAPONS_BY_TYPE = { 1: [], 2: [], 3: [] };
{
  // Build from WEAPON_TYPE_DATA: for each weapon in the type-filtered list
  // that has an upgrade_ref, extract the base_weapon_id and collect unique
  // base weapons with their names.
  for (const typeIdStr of Object.keys(BASE_WEAPONS_BY_TYPE)) {
    const typeId = Number(typeIdStr);
    const { ids } = WEAPON_TYPE_DATA[typeId];
    const seen = new Set();
    for (const itemId of ids) {
      try {
        const item = db.getItem('weapons', itemId);
        const ref = item.upgrade_ref;
        if (!Array.isArray(ref) || ref[0] == null) continue;
        const baseId = ref[0];
        if (seen.has(baseId)) continue;
        seen.add(baseId);
        // Skip base weapons not in rel-upgrades (invalid references).
        if (!hasBaseWeapon(baseId)) continue;
        BASE_WEAPONS_BY_TYPE[typeId].push({ baseId, name: getBaseWeapon(baseId).name });
      } catch {
        // skip
      }
    }
  }
}

/**
 * Return the list of base weapons for a given weapon type.
 *
 * Includes both upgradable weapons (with upgrade paths) and non-upgradable
 * weapons (e.g. Club, Crossbows) that have no paths but are still valid
 * weapons storable in Thomas's Storage.
 *
 * @param {number} typeId  1=Weapon, 2=Shield, 3=Bow
 * @returns {Array<{baseId: number, name: string}>}
 */
export function getBaseWeaponsForType(typeId) {
  return BASE_WEAPONS_BY_TYPE[typeId] || [];
}

/**
 * Return the upgrade paths available for a given base weapon.
 * @param {number} baseId  base weapon ID from rel-upgrades.js
 * @returns {Array<{pathId: number, name: string, levels: number[]}>}
 */
export function getPathsForBaseWeapon(baseId) {
  if (!hasBaseWeapon(baseId)) return [];
  return getBaseWeapon(baseId).path_ids.map((pid) => {
    const def = getUpgradePathDef(pid);
    return { pathId: pid, name: def.name, levels: def.levels };
  });
}

/**
 * Resolve the upgrade_ref [baseId, pathId, level] for a given weapon itemId.
 * Returns null if the item has no upgrade_ref.
 * @param {number} itemId
 * @returns {[number, number, number]|null}
 */
export function getUpgradeRefForItemId(itemId) {
  try {
    const item = db.getItem('weapons', itemId);
    const ref = item.upgrade_ref;
    if (!Array.isArray(ref) || ref[0] == null) return null;
    return ref;
  } catch {
    return null;
  }
}

/**
 * Recompose a hex item ID from a [baseId, pathId, level] upgrade_ref.
 * @param {number} baseId
 * @param {number} pathId
 * @param {number} level
 * @returns {number|null}  unsigned integer item ID, or null if not found
 */
export function resolveItemIdFromRef(baseId, pathId, level) {
  try {
    const hexId = getWeaponItemByUpgradeRef([baseId, pathId, level]);
    return parseInt(hexId, 16) >>> 0;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Dropdown width computation (pre-computed at module load time)       */
/* ------------------------------------------------------------------ */

/**
 * Font used for canvas-based text measurement of select dropdown widths.
 *
 * MUST match the actual CSS font applied to `.grid-table select` in
 * css/styles.css.  If the CSS font family or size changes, update this
 * constant to match — otherwise pre-computed SELECT_WIDTHS values will
 * be wrong, causing misaligned dropdowns.
 */
const SELECT_FONT = '12px system-ui, sans-serif';

/**
 * Approximate average character width (in px) for the 12px system font
 * used by the editor's table selects.
 */
const CHAR_WIDTH = 7;

/**
 * Extra horizontal space (in px) added on top of the measured text width
 * to account for the dropdown arrow, left/right padding, and a small
 * visual margin.
 */
const SELECT_WIDTH_OVERHEAD = 40;

/**
 * Cached canvas 2D context for text measurement.
 *
 * Created once and reused across all namesToWidth() calls to avoid
 * repeated canvas/context allocations during module load (~15 calls).
 * Null in non-DOM environments (e.g. jsdom tests).
 */
let _measureCtx = null;

/**
 * Sentinel: once canvas creation has failed, stop retrying.
 * Without this, every subsequent namesToWidth() call would re-enter the
 * try/catch and attempt to create a canvas element unnecessarily.
 */
let _measureFailed = false;

/**
 * Lazily create (or return cached) 2D canvas context for measureText().
 * @returns {CanvasRenderingContext2D|null}
 */
function getMeasureContext() {
  if (_measureFailed) return null;
  if (_measureCtx !== null) return _measureCtx || null;
  try {
    const canvas = document.createElement('canvas');
    _measureCtx = canvas.getContext('2d');
    if (_measureCtx) {
      _measureCtx.font = SELECT_FONT;
    }
  } catch {
    _measureCtx = null;
  }
  if (_measureCtx === null) _measureFailed = true;
  return _measureCtx || null;
}

/**
 * Compute a fixed pixel width for a <select> from a list of display names.
 *
 * Uses canvas measureText() for pixel-accurate widths when available (browser),
 * falling back to the char-count heuristic (longest name × CHAR_WIDTH +
 * overhead) in non-DOM environments (e.g. jsdom tests).
 *
 * @param {string[]} names  display names of all selectable items
 * @returns {number} width in CSS pixels (e.g. 220)
 */
function namesToWidth(names) {
  if (names.length === 0) return SELECT_WIDTH_OVERHEAD;

  // Find the longest name by char count (used for both approaches)
  let longestName = '';
  for (const name of names) {
    if (name.length > longestName.length) longestName = name;
  }

  // Try canvas-based measurement for proportional-font accuracy.
  const ctx = getMeasureContext();
  if (ctx) {
    const measured = ctx.measureText(longestName).width;
    return Math.ceil(measured) + SELECT_WIDTH_OVERHEAD;
  }

  // Fallback: char-count heuristic (works in all environments)
  return longestName.length * CHAR_WIDTH + SELECT_WIDTH_OVERHEAD;
}

/**
 * Pre-computed select widths for every dropdown in the Inventory, Spells,
 * and Thomas's Storage tabs.
 *
 * All values are calculated once at module load from the static game-data
 * arrays — no runtime measurement needed when creating table rows.
 *
 * Keys:
 *   'spells', 'armor', 'rings', 'goods'           — full category (no type filter)
 *   'spell-status'                                — spell status names
 *   'weapons-{typeId}'                            — inventory weapon type filter
 *   'weapons-{typeId}-deposit'                    — deposit weapon type filter
 *   'goods-{typeId}'                              — goods type filter
 *   'base-weapons-{typeId}'                       — deposit decomposed base weapon
 *   'path'                                        — upgrade path names (max across all)
 *   'level'                                       — upgrade level strings (max across all)
 */
export const SELECT_WIDTHS = {};

// Full categories
SELECT_WIDTHS.spells = namesToWidth(SPELL_NAMES);
SELECT_WIDTHS['spell-status'] = namesToWidth(SPELL_STATUS_NAMES);
SELECT_WIDTHS.armor = namesToWidth(ARMOR_NAMES);
SELECT_WIDTHS.rings = namesToWidth(RING_NAMES);
SELECT_WIDTHS.goods = namesToWidth(ITEM_NAMES);

// Per weapon type (inventory + deposit variants)
for (const { typeId } of WEAPON_TYPES) {
  SELECT_WIDTHS[`weapons-${typeId}`] = namesToWidth(WEAPON_TYPE_DATA[typeId].names);
  SELECT_WIDTHS[`weapons-${typeId}-deposit`] = namesToWidth(DEPOSIT_WEAPON_TYPE_DATA[typeId].names);
  SELECT_WIDTHS[`base-weapons-${typeId}`] = namesToWidth(
    BASE_WEAPONS_BY_TYPE[typeId]?.map((bw) => bw.name) ?? [],
  );
}

// Per goods type
for (const { typeId } of GOODS_TYPES) {
  SELECT_WIDTHS[`goods-${typeId}`] = namesToWidth(GOODS_TYPE_DATA[typeId].names);
}

// Upgrade path / level widths (max across all paths)
{
  let maxPathChars = 0;
  let maxLevelChars = 0;
  for (const { typeId } of WEAPON_TYPES) {
    const baseWeapons = BASE_WEAPONS_BY_TYPE[typeId] ?? [];
    for (const { baseId } of baseWeapons) {
      const paths = getPathsForBaseWeapon(baseId);
      for (const { name, levels } of paths) {
        if (name.length > maxPathChars) maxPathChars = name.length;
        for (const lvl of levels) {
          const lvlStr = '+' + lvl;
          if (lvlStr.length > maxLevelChars) maxLevelChars = lvlStr.length;
        }
      }
    }
  }
  SELECT_WIDTHS.path = maxPathChars * CHAR_WIDTH + SELECT_WIDTH_OVERHEAD;
  SELECT_WIDTHS.level = maxLevelChars * CHAR_WIDTH + SELECT_WIDTH_OVERHEAD;

  // Freeze all exported data structures to prevent accidental mutation by callers.
  // (Callers read these arrays/objects — they should never modify them.)
  deepFreeze(WEAPON_TYPE_DATA);
  deepFreeze(DEPOSIT_WEAPON_TYPE_DATA);
  deepFreeze(GOODS_TYPE_DATA);
  deepFreeze(BASE_WEAPONS_BY_TYPE);
  Object.freeze(WEAPON_IDS);
  Object.freeze(WEAPON_NAMES);
  Object.freeze(ARMOR_IDS);
  Object.freeze(ARMOR_NAMES);
  Object.freeze(RING_IDS);
  Object.freeze(RING_NAMES);
  Object.freeze(ITEM_IDS);
  Object.freeze(ITEM_NAMES);
  Object.freeze(SPELL_IDS);
  Object.freeze(SPELL_NAMES);
  Object.freeze(HAIRSTYLE_IDS);
  Object.freeze(HAIRSTYLE_NAMES);
  Object.freeze(WEAPON_TYPES);
  Object.freeze(GOODS_TYPES);
  deepFreeze(SELECT_WIDTHS);
  deepFreeze(COUNT_LIMITS);
  Object.freeze(SPELL_STATUS_NAMES);
}
