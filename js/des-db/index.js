/**
 * des-db — Read-only game data module for Demon's Souls.
 *
 * Treats the JSON files in this directory as the single source of truth.
 * All data is deep-frozen on load and exposed through a functional API
 * that allows clients to retrieve data but never write to it.
 *
 * Categories: 'weapons', 'armor', 'rings', 'goods', 'spells', 'hairstyles'
 */

import weaponsData from './weapons.js';
import armorData from './armors.js';
import ringsData from './rings.js';
import goodsData from './goods.js';
import spellsData from './spells.js';
import hairstylesData from './hairstyles.js';
import startClassesData from './class.js';
import relTypesData from './rel-types.js';
import relUpgradesData from './rel-upgrades.js';
import warpsData from './warps.js';
import upgradeRefIndexData from './idx-upgrade-ref.js';

/**
 * Game-data item entry (common shape across categories).  `type` is the
 * [typeId, subTypeId] pair; Weapon/Shield/Bow entries additionally carry
 * `upgrade_ref`, and base entries carry `durability`.
 * @typedef {Object} DbItem
 * @property {string} name
 * @property {[number, number|null]} type
 * @property {string} [note]
 * @property {[number, number|null, number|null]} [upgrade_ref]
 * @property {number} [durability]
 */

/* ------------------------------------------------------------------ */
/* Internal: category config                                           */
/* ------------------------------------------------------------------ */

/**
 * Map of category name → { data, itemsKey }
 * The itemsKey is the JSON property holding the keyed entries
 * (e.g. 'items' for most, 'hairstyles' for hairstyles).
 *
 * @type {Record<string, {data: Record<string, unknown>, itemsKey: string}>}
 */
const CATEGORY_CONFIG = {
  weapons: { data: weaponsData, itemsKey: 'items' },
  armor: { data: armorData, itemsKey: 'items' },
  rings: { data: ringsData, itemsKey: 'items' },
  goods: { data: goodsData, itemsKey: 'items' },
  spells: { data: spellsData, itemsKey: 'items' },
  hairstyles: { data: hairstylesData, itemsKey: 'hairstyles' },
};

/** Ordered list of valid category names. */
const _categories = Object.freeze(Object.keys(CATEGORY_CONFIG));

/* ------------------------------------------------------------------ */
/* Internal: build ordered arrays from keyed JSON                      */
/* ------------------------------------------------------------------ */

/**
 * Parse a hex-ID key (e.g. "0x2710") to an unsigned integer.
 * @param {string} key
 * @returns {number}
 */
function parseHexKey(key) {
  return parseInt(key, 16) >>> 0;
}

/**
 * Normalize an item ID (string or number) into the canonical hex-key form
 * used by the data files (e.g. `0x2710`).  Accepts both string (`'0x2710'`,
 * `'0x2710'`) and number (`0x2710`) inputs.
 * @param {string|number} itemId
 * @returns {string}
 */
function normalizeItemId(itemId) {
  return typeof itemId === 'string'
    ? '0x' + parseInt(itemId, 16).toString(16).toUpperCase()
    : '0x' + (itemId >>> 0).toString(16).toUpperCase();
}

/**
 * Build frozen ordered arrays (ids, names) from a category's JSON object.
 * Object.keys() preserves file insertion order for non-integer-index keys,
 * which all hex-ID keys ("0x186A0") satisfy.
 *
 * @param {string} category
 * @returns {{ ids: number[], names: string[], itemsMap: Record<string, DbItem> }}
 */
export function _buildCategory(category) {
  const cfg = CATEGORY_CONFIG[category];
  if (!cfg) {
    throw new Error(`Unknown category: ${category}`);
  }

  const items = /** @type {Record<string, DbItem>} */ (cfg.data[cfg.itemsKey]);
  const keys = Object.keys(items);

  const ids = keys.map(parseHexKey);
  const names = keys.map((k) => items[k].name);

  // Game data is static, so the original imported objects are frozen in
  // place (see deepFreeze calls below) rather than cloned.
  return { ids, names, itemsMap: items };
}

// Build all categories once at module load.
/** @type {Record<string, {ids: number[], names: string[], itemsMap: Record<string, DbItem>}>} */
const _categoryData = {};
for (const cat of _categories) {
  _categoryData[cat] = _buildCategory(cat);
}

/* ------------------------------------------------------------------ */
/* Internal: freeze everything                                         */
/* ------------------------------------------------------------------ */

/**
 * Recursively freeze an object/array so it cannot be mutated.
 *
 * @template T
 * @param {T} obj
 * @returns {T}
 */
export function _deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    const val = /** @type {Record<string, unknown>} */ (obj)[key];
    if (typeof val === 'object' && val !== null && !Object.isFrozen(val)) {
      _deepFreeze(val);
    }
  }
  return obj;
}

/** Local alias so the rest of the module reads as `deepFreeze(...)`. */
const deepFreeze = _deepFreeze;

// Freeze all built category data in place.
for (const cat of _categories) {
  deepFreeze(_categoryData[cat].ids);
  deepFreeze(_categoryData[cat].names);
  deepFreeze(_categoryData[cat].itemsMap);
}
deepFreeze(_categoryData);

// Freeze warps in place.
const _warps = deepFreeze(warpsData.warps);
/** @type {Record<string, string>} */
const _worldNames = deepFreeze(warpsData.world_names);

// Freeze start classes (spread into a new array first).
const _startClasses = deepFreeze([...startClassesData.classes]);

// Freeze types in place (rel-types.js nested structure).
/** @type {Record<string, {name: string}>} */
const _types = deepFreeze(relTypesData.types);

// Pre-build the frozen getAllTypes() result so it isn't re-allocated per call.
const _allTypes = deepFreeze(
  Object.keys(_types).map((tid) => ({
    typeId: Number(tid),
    name: _types[tid].name,
  })),
);

// Freeze upgrade paths and base weapons in place (rel-upgrades.js).
/** @type {Record<string, {name: string, levels: number[], note: string}>} */
const _upgradePaths = deepFreeze(relUpgradesData.paths);
const _baseWeapons = deepFreeze(relUpgradesData.base_weapons);

/**
 * Build per-weapon composite info objects from the base_weapons and
 * upgrade_paths tables.  Each path_id is validated at build time.
 *
 * Returns a plain (un-frozen) object so the caller can deepFreeze the
 * result.  Exported (prefixed `_`) so unit tests can exercise the
 * path_id validation guard with crafted invalid data.
 *
 * @param {Record<string, {name: string, path_ids?: number[], durability: number, note: string}>} baseWeapons  frozen rel-upgrades.base_weapons
 * @param {Record<string, {name: string, levels: number[], note: string}>} upgradePaths frozen rel-upgrades.paths
 * @returns {Record<string, {name: string, path_ids: number[], durability: number, note: string}>}
 * @throws {Error} if a base weapon references an unknown upgrade path id
 * @internal
 */
export function _buildBaseWeaponInfo(baseWeapons, upgradePaths) {
  /** @type {Record<string, {name: string, path_ids: number[], durability: number, note: string}>} */
  const result = {};
  for (const [id, entry] of Object.entries(baseWeapons)) {
    const pids = Array.isArray(entry.path_ids) ? entry.path_ids : [];
    // Sort numerically so path_ids are in deterministic ascending order
    // regardless of file insertion order.
    const sorted = pids.slice().sort((a, b) => a - b);
    // Validate each path_id references a known upgrade path.
    for (const pid of sorted) {
      if (!upgradePaths[String(pid)]) {
        throw new Error(`Base weapon ${id} (${entry.name}) references unknown path id ${pid}`);
      }
    }
    result[id] = {
      name: entry.name,
      path_ids: sorted,
      durability: entry.durability,
      note: entry.note,
    };
  }
  return result;
}

// Pre-build frozen per-weapon composite info objects so getBaseWeapon()
// returns a shared, frozen object with zero per-call allocation.
const _baseWeaponInfo = deepFreeze(
  Object.fromEntries(
    Object.entries(_buildBaseWeaponInfo(_baseWeapons, _upgradePaths)).map(([id, info]) => [
      id,
      deepFreeze(info),
    ]),
  ),
);

// upgrade_ref → { category, id } lookup (generated by tools/gen-des-db-index.mjs).
/** @type {Record<string, {category: string, id: string}>} */
const _upgradeRefIndex = deepFreeze(upgradeRefIndexData.index);

// Durability-bearing item types (Weapon, Shield, Bow, Armor, Casting Tool).
const _DURABILITY_TYPES = new Set([1, 2, 3, 5, 6]);

/**
 * Verify the generated idx-upgrade-ref.js is not stale.
 *
 * Counts the number of weapon entries that have an `upgrade_ref` array and
 * compares against the generated index entry count.  If they diverge the
 * index is stale and an error is thrown.
 *
 * Exported (prefixed `_`) so unit tests can exercise the guard with
 * mismatched counts.
 *
 * @param {Object} weaponsItems  the `items` object from weapons.js
 * @param {number} indexCount    number of entries in the generated index
 * @throws {Error} if counts diverge
 * @internal
 */
export function _validateUpgradeRefIndex(weaponsItems, indexCount) {
  let liveRefCount = 0;
  for (const entry of Object.values(weaponsItems)) {
    if (Array.isArray(entry.upgrade_ref)) liveRefCount++;
  }
  if (liveRefCount !== indexCount) {
    throw new Error(
      `idx-upgrade-ref.js is stale: ${liveRefCount} upgrade_ref entries in ` +
        `weapons.js but index has ${indexCount}. ` +
        `Run: node tools/gen-des-db-index.mjs`,
    );
  }
}

// Verify the generated idx-upgrade-ref.js is not stale at module load.
_validateUpgradeRefIndex(weaponsData.items, Object.keys(_upgradeRefIndex).length);

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * List all valid category names.
 * @returns {readonly string[]} frozen array: ['weapons', 'armor', 'rings', 'goods', 'spells', 'hairstyles']
 */
export function getCategories() {
  return _categories;
}

/**
 * Get the ordered array of raw hex IDs for a category.
 * The array is frozen — mutation throws TypeError in strict mode.
 *
 * @param {'weapons'|'armor'|'rings'|'goods'|'spells'|'hairstyles'} category
 * @returns {number[]} e.g. [0x1, 0x2, 0x2710, ...]
 */
export function getItemIdsByCategory(category) {
  const cat = _categoryData[category];
  if (!cat) throw new Error(`Unknown category: ${category}`);
  return cat.ids;
}

/**
 * Get the ordered array of display names for a category.
 * The array is frozen — mutation throws TypeError in strict mode.
 *
 * @param {'weapons'|'armor'|'rings'|'goods'|'spells'|'hairstyles'} category
 * @returns {string[]} e.g. ['Dagger', 'Dagger+1', ...]
 */
export function getItemNamesByCategory(category) {
  const cat = _categoryData[category];
  if (!cat) throw new Error(`Unknown category: ${category}`);
  return cat.names;
}

/**
 * Look up a single item entry by its hex ID.
 * Accepts both a string key ('0x2710') and a number (0x2710).
 * Returns a frozen object; throws an Error if the item is not found.
 *
 * @param {string} category  des-db category, e.g. 'weapons'|'armor'|'rings'|'goods'|'spells'|'hairstyles'
 * @param {string|number} itemId  hex ID, e.g. '0x2710' or 0x2710
 * @returns {DbItem}
 * @throws {Error} if the category is unknown or the item is not found.
 */
export function getItem(category, itemId) {
  const cat = _categoryData[category];
  if (!cat) throw new Error(`Unknown category: ${category}`);
  const key = normalizeItemId(itemId);
  const item = cat.itemsMap[key];
  if (!item) throw new Error(`Item not found: ${category}/${itemId}`);
  return item; // already frozen (part of the frozen itemsMap)
}

/**
 * Check whether an item exists in the given category without throwing.
 *
 * Use this instead of try/catch around getItem() for expected-miss scenarios
 * (e.g. resolving unknown item IDs from save data).
 *
 * @param {string} category  des-db category, e.g. 'weapons'|'armor'|'rings'|'goods'|'spells'|'hairstyles'
 * @param {string|number} itemId  hex ID, e.g. '0x2710' or 0x2710
 * @returns {boolean}
 */
export function hasItem(category, itemId) {
  const cat = _categoryData[category];
  if (!cat) return false;
  const key = normalizeItemId(itemId);
  return cat.itemsMap[key] !== undefined;
}

/**
 * Resolve an upgrade_ref tuple to its hex item ID.
 *
 * Only Weapon (type 1), Shield (type 2), and Bow (type 3) items can have an
 * `upgrade_ref`, and all of these live in the `weapons` category.
 *
 * Returns the hex-ID string (e.g. `'0x2710'`), not the resolved item object —
 * use `getItem('weapons', itemId)` to fetch the full entry if needed.  The
 * return value comes directly from the pre-built frozen index, so no per-call
 * allocation occurs.
 *
 * Throws on illegal input (non-array) or when no item matches the ref.
 *
 * @param {[number, number|null, number|null]} upgradeRef  [base_weapon_id, path_id, level]
 * @returns {string} hex item ID, e.g. '0x2710'
 */
export function getWeaponItemByUpgradeRef(upgradeRef) {
  if (!Array.isArray(upgradeRef) || upgradeRef.length !== 3) {
    throw new Error(
      `Invalid upgrade_ref: expected [base_weapon_id, path_id, level], got ${JSON.stringify(upgradeRef)}`,
    );
  }
  const key = `${upgradeRef[0]}:${upgradeRef[1] ?? 'null'}:${upgradeRef[2] ?? 'null'}`;
  const entry = _upgradeRefIndex[key];
  if (!entry) {
    throw new Error(
      `No item found for upgrade_ref [${upgradeRef[0]}, ${upgradeRef[1]}, ${upgradeRef[2]}]`,
    );
  }
  return entry.id;
}

/**
 * Look up a type name by its integer ID.
 *
 * Exported (prefixed `_`) so unit tests can exercise the `?? '?'` fallback
 * when a typeId is not found in the types table.
 *
 * @param {number} typeId
 * @param {Record<string, {name: string}>} types  frozen rel-types.types
 * @returns {string}
 * @internal
 */
export function _getTypeName(typeId, types) {
  return types[String(typeId)]?.name ?? '?';
}

/**
 * Resolve durability for a Weapon / Shield / Bow item via base_weapons.
 *
 * Exported (prefixed `_`) so unit tests can exercise the defensive fallback
 * branches (unknown base key, missing durability field, non-number durability).
 *
 * @param {{upgrade_ref?: Array<number | null>}} item  the weapon/shield/bow entry
 * @param {Record<string, {durability?: number}>} baseWeapons  frozen base_weapons
 * @returns {number|null}
 * @internal
 */
export function _resolveWeaponDurability(item, baseWeapons) {
  const ref = item.upgrade_ref;
  if (Array.isArray(ref) && ref[0] != null) {
    const baseKey = String(ref[0]);
    const base = Object.hasOwn(baseWeapons, baseKey) ? baseWeapons[baseKey] : undefined;
    const d = base?.durability;
    return typeof d === 'number' && d >= 0 ? d : null;
  }
  return null;
}

/**
 * Get the max durability for an item.
 *
 * Valid item types are Weapon (1), Shield (2), Bow (3), Armor (5), and Casting
 * Tool (6); any other type throws. Resolution rules:
 *   - Casting Tool / Armor → the item's own `durability` field (null if absent).
 *   - Weapon / Shield / Bow → `_baseWeapons[upgrade_ref[0]].durability`.
 *
 * @param {'weapons'|'armor'|'rings'|'goods'|'spells'|'hairstyles'} category
 * @param {string|number} itemId  hex ID, e.g. '0x2710' or 0x2710
 * @returns {number|null}
 * @throws {Error} if the item is not found or is not a durability-bearing type.
 */
export function getItemDurability(category, itemId) {
  const item = getItem(category, itemId);

  const typeId = item.type?.[0];
  if (!_DURABILITY_TYPES.has(typeId)) {
    const typeName = _getTypeName(typeId, _types);
    throw new Error(
      `${category}/${itemId} (${item.name}) is type ${typeId} (${typeName}); ` +
        `expected Weapon (1), Shield (2), Bow (3), Armor (5), or Casting Tool (6)`,
    );
  }

  // Casting Tool (6) / Armor (5): durability from the item's own field.
  // Uses `>= 0` to return legitimate durability: 0 entries as-is.
  if (typeId === 6 || typeId === 5) {
    const d = item.durability;
    return typeof d === 'number' && d >= 0 ? d : null;
  }

  // Weapon / Shield / Bow (1/2/3): resolve via base_weapons.
  return _resolveWeaponDurability(item, _baseWeapons);
}

/**
 * Get the starting class names as an ordered array.
 * @returns {string[]} frozen array, e.g. ['Soldier', 'Knight', ...]
 */
export function getStartClasses() {
  return _startClasses;
}

/**
 * Get the list of warp locations.
 * @returns {Array<{name: string, world: number, block: number, x: number, y: number, z: number, rot: number}>}
 *   frozen array
 */
export function getWarps() {
  return _warps;
}

/**
 * Get the friendly world name for a world index.
 * @param {number} world
 * @returns {string}
 * @throws {Error} if the world is unknown.
 */
export function getWorldName(world) {
  const key = String(world);
  const name = Object.hasOwn(_worldNames, key) ? _worldNames[key] : undefined;
  if (!name) throw new Error(`Unknown world: ${world}`);
  return name;
}

/**
 * Get all type entries as an ordered array of { typeId, name } pairs.
 * @returns {Array<{typeId: number, name: string}>}
 */
export function getAllTypes() {
  return _allTypes;
}

/**
 * Get an upgrade path definition by its integer ID.
 *
 * Returns the frozen path entry directly ({ name, levels, note }) — no per-call
 * allocation, and the caller cannot mutate it. Throws if the path ID is unknown.
 *
 * @param {number} pathId
 * @returns {{name: string, levels: number[], note: string}}
 * @throws {Error} if the path ID is unknown.
 */
export function getUpgradePathDef(pathId) {
  const key = String(pathId);
  const entry = Object.hasOwn(_upgradePaths, key) ? _upgradePaths[key] : undefined;
  if (!entry) throw new Error(`Unknown upgrade path id: ${pathId}`);
  return entry; // frozen { name, levels, note }
}

/**
 * Get the full info for a base weapon by its integer ID.
 *
 * The base_weapons table only contains Weapon (type 1), Shield (type 2), and
 * Bow (type 3) entries — so a missing entry means the id is not a base weapon
 * type, which is treated as an invalid argument and throws.
 *
 * Some base weapons (e.g. clubs, crossbows, non-upgradable shields) are valid
 * weapon/shield/bow records but have no upgrade paths; for those `path_ids`
 * is an empty array.
 *
 * The returned object is pre-built and frozen — zero per-call allocation.
 * To resolve a path ID into its full definition (name, levels, note), use
 * `getUpgradePathDef(pathId)`.
 *
 * @param {number} baseWeaponId  integer base weapon ID (1-89)
 * @returns {{name: string, path_ids: number[], durability: number, note: string}}
 *   frozen composite object; `path_ids` is sorted ascending
 * @throws {Error} if `baseWeaponId` is not a known Weapon/Shield/Bow entry
 */
export function getBaseWeapon(baseWeaponId) {
  const key = String(baseWeaponId);
  const info = Object.hasOwn(_baseWeaponInfo, key) ? _baseWeaponInfo[key] : undefined;
  if (!info) {
    throw new Error(`Invalid base weapon id: ${baseWeaponId} (must be a Weapon, Shield, or Bow)`);
  }
  return info; // frozen { name, path_ids, durability, note }
}

/**
 * Check whether a base weapon ID exists without throwing.
 *
 * Use this instead of try/catch around getBaseWeapon() for expected-miss
 * scenarios (e.g. filtering upgradeable base weapons from a larger list).
 *
 * @param {number} baseWeaponId  integer base weapon ID (1-89)
 * @returns {boolean}
 */
export function hasBaseWeapon(baseWeaponId) {
  const key = String(baseWeaponId);
  return Object.hasOwn(_baseWeaponInfo, key) && _baseWeaponInfo[key] !== undefined;
}
