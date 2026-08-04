/** * Tests for the des-db read-only game data module.
 */
import * as db from '../../js/des-db/index.js';
import weaponsData from '../../js/des-db/weapons.js';
import armorData from '../../js/des-db/armors.js';
import ringsData from '../../js/des-db/rings.js';
import goodsData from '../../js/des-db/goods.js';
import spellsData from '../../js/des-db/spells.js';
import hairstylesData from '../../js/des-db/hairstyles.js';
import relUpgradesData from '../../js/des-db/rel-upgrades.js';
import relTypesData from '../../js/des-db/rel-types.js';

describe('des-db: getCategories', () => {
  test('returns expected category list', () => {
    const cats = db.getCategories();
    expect(cats).toEqual(['weapons', 'armor', 'rings', 'goods', 'spells', 'hairstyles']);
  });

  test('returned array is frozen', () => {
    expect(Object.isFrozen(db.getCategories())).toBe(true);
  });
});

describe('des-db: getItemIdsByCategory / getItemNamesByCategory', () => {
  test('weapons has correct length', () => {
    const ids = db.getItemIdsByCategory('weapons');
    const names = db.getItemNamesByCategory('weapons');
    expect(ids.length).toBe(names.length);
    expect(ids.length).toBeGreaterThan(100);
  });

  test('weapons first real entry is Dagger (index 0)', () => {
    expect(db.getItemNamesByCategory('weapons')[0]).toBe('Dagger');
    expect(db.getItemIdsByCategory('weapons')[0]).toBe(0x2710);
  });

  test('armor first entry is Gold Mask', () => {
    expect(db.getItemNamesByCategory('armor')[0]).toBe('Gold Mask');
    expect(db.getItemIdsByCategory('armor')[0]).toBe(0x186a0);
  });

  test('spells first entry is Invoke Magic Sq.', () => {
    expect(db.getItemNamesByCategory('spells')[0]).toBe('Invoke Magic Sq.');
    expect(db.getItemIdsByCategory('spells')[0]).toBe(0x64);
  });

  test('rings first entry is Ring of Great Strength', () => {
    expect(db.getItemNamesByCategory('rings')[0]).toBe('Ring of Great Strength');
    expect(db.getItemIdsByCategory('rings')[0]).toBe(0x64);
  });

  test('hairstyles first entry is Shaved (1)', () => {
    expect(db.getItemNamesByCategory('hairstyles')[0]).toBe('Shaved (1)');
    expect(db.getItemIdsByCategory('hairstyles')[0]).toBe(0x7a120);
  });

  test('goods first entry is Execution Grounds Key', () => {
    expect(db.getItemNamesByCategory('goods')[0]).toBe('Execution Grounds Key (Inactive)');
  });

  test('invalid category throws', () => {
    expect(() => db.getItemIdsByCategory(/** @type {never} */ ('invalid'))).toThrow(
      'Unknown category',
    );
    expect(() => db.getItemNamesByCategory(/** @type {never} */ ('invalid'))).toThrow(
      'Unknown category',
    );
  });
});

describe('des-db: getItem', () => {
  test('lookup by string key', () => {
    const dagger = db.getItem('weapons', '0x2710');
    expect(dagger).toBeDefined();
    expect(dagger.name).toBe('Dagger');
    expect(dagger.type).toEqual([1, 1]);
  });

  test('lookup by number key', () => {
    const dagger = db.getItem('weapons', 0x2710);
    expect(dagger.name).toBe('Dagger');
  });

  test('throws for unknown key', () => {
    expect(() => db.getItem('weapons', '0xDEADBEEF')).toThrow('Item not found');
  });

  test('throws for unknown category', () => {
    expect(() => db.getItem(/** @type {never} */ ('invalid'), '0x2710')).toThrow(
      'Unknown category: invalid',
    );
  });

  test('item objects are frozen', () => {
    expect(Object.isFrozen(db.getItem('weapons', '0x2710'))).toBe(true);
  });

  test('case-insensitive: lowercase hex string key works', () => {
    // Data stores uppercase keys; lowercase input must also resolve.
    expect(db.getItem('weapons', '0x2710').name).toBe('Dagger');
    expect(db.getItem('armor', '0x186a0').name).toBe('Gold Mask');
  });
});

describe('des-db: hasItem', () => {
  // getItem already exercises normalizeItemId() with string, number, and
  // lowercase hex inputs; hasItem calls the same normalizer, so a single
  // test covering all three forms is sufficient.
  test('returns true for existing item (string, number, lowercase hex)', () => {
    expect(db.hasItem('weapons', '0x2710')).toBe(true);
    expect(db.hasItem('weapons', 0x2710)).toBe(true);
    expect(db.hasItem('weapons', '0x2710')).toBe(true);
  });

  test('returns false for non-existent item', () => {
    expect(db.hasItem('weapons', '0xDEADBEEF')).toBe(false);
  });

  test('returns false for unknown category', () => {
    expect(db.hasItem(/** @type {never} */ ('invalid'), '0x2710')).toBe(false);
  });
});

describe('des-db: getItemDurability', () => {
  test('casting tool resolves from entry durability field', () => {
    // Wooden Catalyst — durability stored directly on the weapons.js entry.
    expect(db.getItemDurability('weapons', '0x15F90')).toBe(30);
    expect(db.getItemDurability('weapons', 0x15f90)).toBe(30);
    // Talisman of Beasts
    expect(db.getItemDurability('weapons', '0x16184')).toBe(150);
  });

  test.each([
    ['Dagger', '0x2710', 200], // weapon → base weapon 1
    ["Knight's Shield", '0x24D74', 300], // shield → base weapon 43
    ['Buckler', '0x249F0', 200], // shield → base weapon 40
    ['Short Bow', '0x1FBD0', 100], // bow → base weapon 36
  ])('%s resolves via upgrade_ref → base_weapons (%s → %i)', (_name, id, expected) => {
    expect(db.getItemDurability('weapons', id)).toBe(expected);
  });

  test('armor returns null when no durability field present', () => {
    // Bare Head — type 5 (Armor). Empty slots and NPC equipment do not
    // carry a durability field, so this resolves to null.
    expect(db.getItemDurability('armor', '0x18D44')).toBeNull();
  });

  test('armor resolves from entry durability field', () => {
    // Gold Mask — type 5 (Armor), durability 150.
    expect(db.getItemDurability('armor', '0x186A0')).toBe(150);
    // Ancient King's Breastplate — durability 800.
    expect(db.getItemDurability('armor', '0x3118C')).toBe(800);
    // Fluted Helmet — durability 250.
    expect(db.getItemDurability('armor', '0x1895C')).toBe(250);
  });

  test('armor with durability: 0 returns 0 (not null)', () => {
    // Monk's Head Wrappings — durability explicitly 0; returned as-is.
    expect(db.getItemDurability('armor', '0x2BF20')).toBe(0);
  });

  test.each([
    ['ammo', 'weapons', '0x27100'], // Arrow — type 4 (Ammo)
    ['ring', 'rings', '0x64'], // Ring of Great Strength — type 8
    ['goods', 'goods', '0x6'], // Execution Grounds Key — type 12
  ])('throws for non-durability type (%s)', (_label, cat, id) => {
    expect(() => db.getItemDurability(/** @type {never} */ (cat), id)).toThrow(
      'expected Weapon (1), Shield (2), Bow (3), Armor (5), or Casting Tool (6)',
    );
  });

  test('throws for unknown item id', () => {
    expect(() => db.getItemDurability('weapons', '0xDEADBEEF')).toThrow('Item not found');
  });

  test('weapon without upgrade_ref returns null', () => {
    // Storm Ruler (0x526D) — type [1,3] (Weapon) but has no upgrade_ref.
    // Falls through to the final `return null` at the end of getItemDurability.
    expect(db.getItemDurability('weapons', '0x526D')).toBeNull();
    // Ghost dagger (0x4A38) — type [1,1] (Weapon), also no upgrade_ref.
    expect(db.getItemDurability('weapons', '0x4A38')).toBeNull();
  });
});

describe('des-db: getWeaponItemByUpgradeRef', () => {
  test('valid ref returns itemId string', () => {
    // [1, 1, 0] → Dagger (0x2710)
    expect(db.getWeaponItemByUpgradeRef([1, 1, 0])).toBe('0x2710');
  });

  test('null-path ref (non-upgradable) returns itemId string', () => {
    // [77, null, null] → Soulbrandt (0x51A4)
    expect(db.getWeaponItemByUpgradeRef([77, null, null])).toBe('0x51A4');
  });

  test('throws on non-array input', () => {
    expect(() => db.getWeaponItemByUpgradeRef(null)).toThrow('Invalid upgrade_ref');
    expect(() => db.getWeaponItemByUpgradeRef(/** @type {never} */ ('1:1:0'))).toThrow(
      'Invalid upgrade_ref',
    );
    expect(() => db.getWeaponItemByUpgradeRef(undefined)).toThrow('Invalid upgrade_ref');
  });

  test('throws on truncated array (fewer than 3 elements)', () => {
    // Input must be a 3-element array; shorter arrays are rejected.
    expect(() => db.getWeaponItemByUpgradeRef(/** @type {never} */ ([77]))).toThrow(
      'Invalid upgrade_ref',
    );
    expect(() => db.getWeaponItemByUpgradeRef(/** @type {never} */ ([77, null]))).toThrow(
      'Invalid upgrade_ref',
    );
  });

  test('throws on unknown ref', () => {
    expect(() => db.getWeaponItemByUpgradeRef([999, 1, 0])).toThrow('No item found');
  });
});

describe('des-db: getStartClasses', () => {
  test('returns 10 classes in order', () => {
    const classes = db.getStartClasses();
    expect(classes).toEqual([
      'Soldier',
      'Knight',
      'Hunter',
      'Priest',
      'Magician',
      'Wanderer',
      'Barbarian',
      'Thief',
      'Temple Knight',
      'Royalty',
    ]);
  });

  test('returned array is frozen', () => {
    expect(Object.isFrozen(db.getStartClasses())).toBe(true);
  });
});

describe('des-db: getWarps', () => {
  test('returns correct number of warp entries', () => {
    const warps = db.getWarps();
    expect(warps.length).toBe(32);
  });

  test('first warp is Nexus', () => {
    const warps = db.getWarps();
    expect(warps[0].name).toBe('Nexus');
    expect(warps[0].world).toBe(1);
  });

  test('each warp has all required fields', () => {
    for (const w of db.getWarps()) {
      expect(w).toHaveProperty('name');
      expect(w).toHaveProperty('world');
      expect(w).toHaveProperty('block');
      expect(w).toHaveProperty('x');
      expect(w).toHaveProperty('y');
      expect(w).toHaveProperty('z');
      expect(w).toHaveProperty('rot');
    }
  });

  test('returned array is frozen', () => {
    expect(Object.isFrozen(db.getWarps())).toBe(true);
  });
});

describe('des-db: getWorldName', () => {
  test('returns correct names for known worlds', () => {
    expect(db.getWorldName(1)).toBe('The Nexus');
    expect(db.getWorldName(2)).toBe('Boletarian Palace');
    expect(db.getWorldName(3)).toBe('Shrine of Storms');
    expect(db.getWorldName(4)).toBe('Tower of Latria');
    expect(db.getWorldName(5)).toBe('Valley of Defilement');
    expect(db.getWorldName(6)).toBe('Stonefang Tunnel');
    expect(db.getWorldName(7)).toBe('Northern Limit');
    expect(db.getWorldName(8)).toBe('Tutorial');
  });

  test('throws for unknown world', () => {
    expect(() => db.getWorldName(999)).toThrow('Unknown world');
  });
});

describe('des-db: getAllTypes', () => {
  test('returns all types with correct shape', () => {
    const types = db.getAllTypes();
    expect(types.length).toBe(13);
    expect(types[0]).toEqual({ typeId: 0, name: 'Non-functional Leftover' });
    expect(types[1]).toEqual({ typeId: 1, name: 'Weapon' });
    expect(types[5]).toEqual({ typeId: 5, name: 'Armor' });
    expect(types[7]).toEqual({ typeId: 7, name: 'Spell' });
  });
});

describe('des-db: getUpgradePathDef', () => {
  test('getUpgradePathDef returns correct definition', () => {
    const basic = db.getUpgradePathDef(1);
    expect(basic.name).toBe('Basic');
    expect(basic.levels).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(basic.note).toContain('Hardstone');
  });

  test('getUpgradePathDef returns Colorless with level 0', () => {
    const colorless = db.getUpgradePathDef(14);
    expect(colorless.name).toBe('Colorless');
    expect(colorless.levels).toEqual([0, 1, 2, 3, 4, 5]);
  });

  test('getUpgradePathDef throws for unknown', () => {
    expect(() => db.getUpgradePathDef(999)).toThrow('Unknown upgrade path id');
  });
});

describe('des-db: getBaseWeapon', () => {
  test('returns composite info for Dagger (base weapon 1)', () => {
    const dag = db.getBaseWeapon(1);
    expect(dag.name).toBe('Dagger');
    // Dagger: path_ids [1, 4, 2, 7, 8, 10] → sorted [1, 2, 4, 7, 8, 10]
    expect(dag.path_ids).toEqual([1, 2, 4, 7, 8, 10]);
    expect(dag.durability).toBe(200);
    expect(typeof dag.note).toBe('string');
    expect(dag.note.length).toBeGreaterThan(0);
  });

  test('path_ids are in ascending order regardless of file order', () => {
    // Short Sword: path_ids [1, 3, 2, 5, 9, 11] → sorted [1, 2, 3, 5, 9, 11]
    expect(db.getBaseWeapon(5).path_ids).toEqual([1, 2, 3, 5, 9, 11]);
    expect(db.getBaseWeapon(5).name).toBe('Short Sword');
  });

  test('Colorless-only base weapons have single path', () => {
    // Baby's Nail — base weapon 48
    expect(db.getBaseWeapon(48).path_ids).toEqual([14]);
    expect(db.getBaseWeapon(48).name).toBe("Baby's Nail");
  });

  test('returns empty path_ids for non-upgradable base weapons', () => {
    // Club — base weapon 69 — valid Weapon but no upgrade paths.
    expect(db.getBaseWeapon(69).path_ids).toEqual([]);
    // Light Crossbow — base weapon 71 — valid Bow but no upgrade paths.
    expect(db.getBaseWeapon(71).path_ids).toEqual([]);
  });

  test('throws for unknown base weapon id', () => {
    expect(() => db.getBaseWeapon(999)).toThrow('Invalid base weapon id');
  });

  test('returned object is frozen', () => {
    expect(Object.isFrozen(db.getBaseWeapon(1))).toBe(true);
  });
});

describe('des-db: hasBaseWeapon', () => {
  test('returns true for a known base weapon', () => {
    expect(db.hasBaseWeapon(1)).toBe(true);
    expect(db.hasBaseWeapon(69)).toBe(true);
    expect(db.hasBaseWeapon(89)).toBe(true);
  });

  test('returns false for unknown base weapon id', () => {
    expect(db.hasBaseWeapon(999)).toBe(false);
    expect(db.hasBaseWeapon(0)).toBe(false);
  });
});

describe('des-db: read-only enforcement', () => {
  test('ids arrays are frozen', () => {
    expect(Object.isFrozen(db.getItemIdsByCategory('weapons'))).toBe(true);
    expect(Object.isFrozen(db.getItemIdsByCategory('armor'))).toBe(true);
    expect(Object.isFrozen(db.getItemIdsByCategory('rings'))).toBe(true);
  });

  test('names arrays are frozen', () => {
    expect(Object.isFrozen(db.getItemNamesByCategory('weapons'))).toBe(true);
    expect(Object.isFrozen(db.getItemNamesByCategory('spells'))).toBe(true);
    expect(Object.isFrozen(db.getItemNamesByCategory('hairstyles'))).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* upgrade_ref integrity: verify base_weapon, path, and level         */
/* relationships across all weapons entries                            */
/* ------------------------------------------------------------------ */

describe('des-db: upgrade_ref integrity', () => {
  const baseWeapons = relUpgradesData.base_weapons;
  const upgradePaths = relUpgradesData.paths;
  const weapons = weaponsData.items;

  /** Collect all entries that have an upgrade_ref field. */
  function getEntriesWithUpgradeRef() {
    const result = [];
    for (const [hexId, entry] of Object.entries(weapons)) {
      if (entry.upgrade_ref !== undefined) {
        result.push({ hexId, entry });
      }
    }
    return result;
  }

  test('upgrade_ref, when present, is a 3-element array', () => {
    const violations = [];
    for (const { hexId, entry } of getEntriesWithUpgradeRef()) {
      const ref = entry.upgrade_ref;
      if (!Array.isArray(ref) || ref.length !== 3) {
        violations.push(
          `${hexId} (${entry.name}): expected 3-element array, got ${JSON.stringify(ref)}`,
        );
      }
    }
    expect(violations).toEqual([]);
  });

  test('base_weapon_id in upgrade_ref exists in rel-upgrades.base_weapons', () => {
    const violations = [];
    for (const { hexId, entry } of getEntriesWithUpgradeRef()) {
      const baseWeaponId = String(entry.upgrade_ref[0]);
      if (!baseWeapons[baseWeaponId]) {
        violations.push(
          `${hexId} (${entry.name}): base_weapon_id ${entry.upgrade_ref[0]} not found in rel-upgrades`,
        );
      }
    }
    expect(violations).toEqual([]);
  });

  test('path_id is valid for its base weapon', () => {
    const violations = [];
    for (const { hexId, entry } of getEntriesWithUpgradeRef()) {
      const [baseWeaponId, pathId] = entry.upgrade_ref;
      // Skip null path_ids (non-upgradable weapons like Soulbrandt)
      if (pathId === null) continue;

      const bw = baseWeapons[String(baseWeaponId)];
      if (!bw) continue; // covered by previous test

      if (!bw.path_ids) {
        violations.push(
          `${hexId} (${entry.name}): base weapon ${baseWeaponId} (${bw.name}) has no path_ids but path_id=${pathId}`,
        );
      } else if (!bw.path_ids.includes(pathId)) {
        violations.push(
          `${hexId} (${entry.name}): path_id ${pathId} not valid for base weapon ${baseWeaponId} (${bw.name}). Allowed: [${bw.path_ids.join(', ')}]`,
        );
      }
    }
    expect(violations).toEqual([]);
  });

  test('level is valid for its upgrade path', () => {
    const violations = [];
    for (const { hexId, entry } of getEntriesWithUpgradeRef()) {
      const [, pathId, level] = entry.upgrade_ref;
      // Skip null levels (non-upgradable weapons)
      if (level === null) continue;
      // Skip null paths (also non-upgradable)
      if (pathId === null) continue;

      const path = upgradePaths[String(pathId)];
      if (!path) {
        violations.push(`${hexId} (${entry.name}): path_id ${pathId} not found in upgrade paths`);
        continue;
      }

      if (!path.levels.includes(level)) {
        violations.push(
          `${hexId} (${entry.name}): level ${level} not valid for path ${pathId} (${path.name}). Allowed: [${path.levels.join(', ')}]`,
        );
      }
    }
    expect(violations).toEqual([]);
  });

  test('non-upgradable base weapons (69-89) only have null path/level', () => {
    const violations = [];
    for (const { hexId, entry } of getEntriesWithUpgradeRef()) {
      const [baseWeaponId, pathId, level] = entry.upgrade_ref;
      const bw = baseWeapons[String(baseWeaponId)];
      if (!bw) continue;

      // Only check base weapons that have no path_ids defined
      if (!bw.path_ids) {
        if (pathId !== null || level !== null) {
          violations.push(
            `${hexId} (${entry.name}): base weapon ${baseWeaponId} (${bw.name}) is non-upgradable but has path_id=${pathId}, level=${level}`,
          );
        }
      }
    }
    expect(violations).toEqual([]);
  });

  test('path_id and level are both null or both non-null (bidirectional consistency)', () => {
    const violations = [];
    for (const { hexId, entry } of getEntriesWithUpgradeRef()) {
      const [, pathId, level] = entry.upgrade_ref;
      if (pathId === null && level !== null) {
        violations.push(`${hexId} (${entry.name}): path_id is null but level is ${level}`);
      }
      if (level === null && pathId !== null) {
        violations.push(`${hexId} (${entry.name}): level is null but path_id is ${pathId}`);
      }
    }
    expect(violations).toEqual([]);
  });

  test('only Weapon (1), Shield (2), and Bow (3) types can have upgrade_ref', () => {
    const allowedTypes = new Set([1, 2, 3]);
    const violations = [];
    for (const { hexId, entry } of getEntriesWithUpgradeRef()) {
      const typeId = entry.type[0];
      if (!allowedTypes.has(typeId)) {
        violations.push(
          `${hexId} (${entry.name}): has upgrade_ref but type ${typeId} is not upgradable (must be 1/2/3)`,
        );
      }
    }
    expect(violations).toEqual([]);
  });

  test('no duplicate upgrade_ref triples exist across weapons entries', () => {
    const seen = new Map(); // key "bw:path:level" -> first hexId
    const violations = [];
    for (const { hexId, entry } of getEntriesWithUpgradeRef()) {
      const [bwId, pathId, level] = entry.upgrade_ref;
      const key = `${bwId}:${pathId}:${level}`;
      if (seen.has(key)) {
        violations.push(
          `${hexId} (${entry.name}): duplicate upgrade_ref [${bwId}, ${pathId}, ${level}] already referenced by ${seen.get(key)}`,
        );
      } else {
        seen.set(key, hexId);
      }
    }
    expect(violations).toEqual([]);
  });

  test('every {base_weapon, path, level} combo in rel-upgrades is referenced by a weapons entry', () => {
    // Build the set of expected tuples from rel-upgrades.js definitions.
    const expected = new Set();
    for (const [bwId, bw] of Object.entries(baseWeapons)) {
      if (bw.path_ids) {
        // Upgradable weapon: every path × level combination
        for (const pathId of bw.path_ids) {
          const path = upgradePaths[String(pathId)];
          if (!path) continue;
          for (const level of path.levels) {
            expected.add(`${bwId}:${pathId}:${level}`);
          }
        }
      } else {
        // Non-upgradable weapon (69-89): single null:null tuple
        expected.add(`${bwId}:null:null`);
      }
    }

    // Build the set of actual tuples from weapons.js entries.
    const actual = new Set();
    for (const { entry } of getEntriesWithUpgradeRef()) {
      const [bwId, pathId, level] = entry.upgrade_ref;
      actual.add(`${bwId}:${pathId}:${level}`);
    }

    // Every expected tuple must appear in actual.
    const unreferenced = [...expected].filter((t) => !actual.has(t));
    expect(unreferenced).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* type integrity: verify type_id and sub_type_id relationships       */
/* across all item categories against rel-types.js                    */
/* ------------------------------------------------------------------ */

describe('des-db: type integrity', () => {
  const types = relTypesData.types;

  /** Collect all typed items from categories that have a 'type' field. */
  function getAllTypedItems() {
    const categories = [
      { name: 'weapons', data: weaponsData },
      { name: 'armor', data: armorData },
      { name: 'rings', data: ringsData },
      { name: 'goods', data: goodsData },
      { name: 'spells', data: spellsData },
    ];
    const result = [];
    for (const { name: catName, data } of categories) {
      const items = data.items;
      for (const [hexId, entry] of Object.entries(items)) {
        if (entry.type !== undefined) {
          result.push({ catName, hexId, entry });
        }
      }
    }
    return result;
  }

  test('every type_id exists in rel-types', () => {
    const violations = [];
    for (const { catName, hexId, entry } of getAllTypedItems()) {
      const typeId = String(entry.type[0]);
      if (!types[typeId]) {
        violations.push(
          `[${catName}] ${hexId} (${entry.name}): type_id ${entry.type[0]} not found in rel-types`,
        );
      }
    }
    expect(violations).toEqual([]);
  });

  test('every sub_type_id belongs to its type_id', () => {
    const violations = [];
    for (const { catName, hexId, entry } of getAllTypedItems()) {
      const [typeId, subTypeId] = entry.type;
      const type = types[String(typeId)];
      if (!type) continue; // covered by previous test

      const subTypes = type.sub_types;
      const subTypeKeys = Object.keys(subTypes);

      if (subTypeId === null) {
        // If sub_type is null, the type should have no sub_types defined
        if (subTypeKeys.length > 0) {
          violations.push(
            `[${catName}] ${hexId} (${entry.name}): sub_type_id is null but type ${typeId} (${type.name}) has sub_types [${subTypeKeys.join(', ')}]`,
          );
        }
      } else {
        // If sub_type is non-null, it must exist in the type's sub_types
        if (!subTypes[String(subTypeId)]) {
          violations.push(
            `[${catName}] ${hexId} (${entry.name}): sub_type_id ${subTypeId} not valid for type ${typeId} (${type.name}). Allowed: [${subTypeKeys.join(', ')}]`,
          );
        }
      }
    }
    expect(violations).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* hex-key format: verify all item keys use canonical uppercase hex    */
/* (e.g. "0x2710", not "0x2710" or "0X2710")                          */
/* ------------------------------------------------------------------ */

describe('des-db: hex-key capitalization', () => {
  /** All item collections keyed by hex ID, across all data files. */
  const keyedCollections = [
    { name: 'weapons', items: weaponsData.items },
    { name: 'armor', items: armorData.items },
    { name: 'rings', items: ringsData.items },
    { name: 'goods', items: goodsData.items },
    { name: 'spells', items: spellsData.items },
    { name: 'hairstyles', items: hairstylesData.hairstyles },
  ];

  test('every hex-ID key is in canonical uppercase form', () => {
    const violations = [];
    for (const { name, items } of keyedCollections) {
      for (const key of Object.keys(items)) {
        const canonical = '0x' + parseInt(key, 16).toString(16).toUpperCase();
        if (key !== canonical) {
          violations.push(`[${name}] "${key}" should be "${canonical}"`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* prototype pollution: verify lookup functions don't fall through to   */
/* inherited prototype properties for crafted keys like "__proto__"     */
/* ------------------------------------------------------------------ */

describe('des-db: prototype pollution resistance', () => {
  test('getWorldName throws for prototype keys', () => {
    expect(() => db.getWorldName(/** @type {never} */ ('__proto__'))).toThrow('Unknown world');
    expect(() => db.getWorldName(/** @type {never} */ ('constructor'))).toThrow('Unknown world');
    expect(() => db.getWorldName(/** @type {never} */ ('toString'))).toThrow('Unknown world');
  });

  test('getUpgradePathDef throws for prototype keys', () => {
    expect(() => db.getUpgradePathDef(/** @type {never} */ ('__proto__'))).toThrow(
      'Unknown upgrade path id',
    );
    expect(() => db.getUpgradePathDef(/** @type {never} */ ('constructor'))).toThrow(
      'Unknown upgrade path id',
    );
    expect(() => db.getUpgradePathDef(/** @type {never} */ ('toString'))).toThrow(
      'Unknown upgrade path id',
    );
  });

  test('getBaseWeapon throws for prototype keys', () => {
    expect(() => db.getBaseWeapon(/** @type {never} */ ('__proto__'))).toThrow(
      'Invalid base weapon id',
    );
    expect(() => db.getBaseWeapon(/** @type {never} */ ('constructor'))).toThrow(
      'Invalid base weapon id',
    );
    expect(() => db.getBaseWeapon(/** @type {never} */ ('toString'))).toThrow(
      'Invalid base weapon id',
    );
  });

  test('hasBaseWeapon returns false for prototype keys', () => {
    expect(db.hasBaseWeapon(/** @type {never} */ ('__proto__'))).toBe(false);
    expect(db.hasBaseWeapon(/** @type {never} */ ('constructor'))).toBe(false);
    expect(db.hasBaseWeapon(/** @type {never} */ ('toString'))).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* internal validators: exercise defensive guards that are structurally  */
/* unreachable through the public API with valid data                  */
/* ------------------------------------------------------------------ */

describe('des-db: _buildCategory guard', () => {
  test('throws for unknown category name', () => {
    expect(() => db._buildCategory('nonexistent')).toThrow('Unknown category: nonexistent');
  });
});

describe('des-db: _buildBaseWeaponInfo guard', () => {
  test('throws when a base weapon references an unknown upgrade path', () => {
    const baseWeapons = {
      1: { name: 'Test Weapon', path_ids: [999], durability: 100, note: '' },
    };
    const upgradePaths = {}; // path 999 doesn't exist
    expect(() => db._buildBaseWeaponInfo(baseWeapons, upgradePaths)).toThrow(
      'Base weapon 1 (Test Weapon) references unknown path id 999',
    );
  });

  test('succeeds when all path_ids are valid', () => {
    const baseWeapons = {
      1: { name: 'Test Weapon', path_ids: [1], durability: 100, note: 'test' },
    };
    const upgradePaths = { 1: { name: 'Basic', levels: [0, 1], note: '' } };
    const result = db._buildBaseWeaponInfo(baseWeapons, upgradePaths);
    expect(result['1']).toEqual({
      name: 'Test Weapon',
      path_ids: [1],
      durability: 100,
      note: 'test',
    });
  });

  test('handles base weapons without path_ids (empty)', () => {
    const baseWeapons = {
      69: { name: 'Club', durability: 200, note: '' },
    };
    const upgradePaths = {};
    const result = db._buildBaseWeaponInfo(baseWeapons, upgradePaths);
    expect(result['69'].path_ids).toEqual([]);
  });
});

describe('des-db: _deepFreeze edge cases', () => {
  test('returns null as-is', () => {
    expect(db._deepFreeze(null)).toBeNull();
  });

  test('returns primitive values as-is', () => {
    expect(db._deepFreeze(42)).toBe(42);
    expect(db._deepFreeze('hello')).toBe('hello');
    expect(db._deepFreeze(true)).toBe(true);
    expect(db._deepFreeze(undefined)).toBeUndefined();
  });
});

describe('des-db: _getTypeName', () => {
  test('returns the name for a known typeId', () => {
    const types = { 1: { name: 'Weapon' }, 5: { name: 'Armor' } };
    expect(db._getTypeName(1, types)).toBe('Weapon');
    expect(db._getTypeName(5, types)).toBe('Armor');
  });

  test('returns "?" for an unknown typeId', () => {
    const types = { 1: { name: 'Weapon' } };
    expect(db._getTypeName(999, types)).toBe('?');
  });
});

describe('des-db: _resolveWeaponDurability edge cases', () => {
  test('returns null when upgrade_ref is missing', () => {
    expect(db._resolveWeaponDurability({}, {})).toBeNull();
  });

  test('returns null when upgrade_ref[0] is null', () => {
    const item = { upgrade_ref: [null, null, null] };
    expect(db._resolveWeaponDurability(item, {})).toBeNull();
  });

  test('returns null when base weapon key is not found', () => {
    const item = { upgrade_ref: [999, 1, 0] };
    // baseWeapons is empty → baseKey "999" not found → undefined → null
    expect(db._resolveWeaponDurability(item, {})).toBeNull();
  });

  test('returns null when base weapon has no durability field', () => {
    const item = { upgrade_ref: [1, 1, 0] };
    const baseWeapons = /** @type {Record<string, { durability?: number }>} */ (
      /** @type {unknown} */ ({ 1: { name: 'Test' } })
    ); // no durability
    expect(db._resolveWeaponDurability(item, baseWeapons)).toBeNull();
  });

  test('returns null when durability is a negative number', () => {
    const item = { upgrade_ref: [1, 1, 0] };
    const baseWeapons = { 1: { durability: -1 } };
    expect(db._resolveWeaponDurability(item, baseWeapons)).toBeNull();
  });

  test('returns null when durability is not a number', () => {
    const item = { upgrade_ref: [1, 1, 0] };
    const baseWeapons = { 1: { durability: /** @type {never} */ ('broken') } };
    expect(db._resolveWeaponDurability(item, baseWeapons)).toBeNull();
  });

  test('returns 0 when durability is explicitly 0', () => {
    const item = { upgrade_ref: [1, 1, 0] };
    const baseWeapons = { 1: { durability: 0 } };
    expect(db._resolveWeaponDurability(item, baseWeapons)).toBe(0);
  });
});

describe('des-db: _validateUpgradeRefIndex guard', () => {
  test('throws when index count does not match live upgrade_ref count', () => {
    const weaponsItems = {
      '0x1': { name: 'A', upgrade_ref: [1, 1, 0] },
      '0x2': { name: 'B', upgrade_ref: [2, 1, 0] },
    };
    // 2 live refs but index has only 1 entry → stale
    expect(() => db._validateUpgradeRefIndex(weaponsItems, 1)).toThrow(
      'idx-upgrade-ref.js is stale: 2 upgrade_ref entries in weapons.js but index has 1',
    );
  });

  test('does not throw when counts match', () => {
    const weaponsItems = {
      '0x1': { name: 'A', upgrade_ref: [1, 1, 0] },
      '0x2': { name: 'B', upgrade_ref: [2, 1, 0] },
      '0x3': { name: 'C' }, // no upgrade_ref — not counted
    };
    // 2 live refs, index has 2 entries → consistent
    expect(() => db._validateUpgradeRefIndex(weaponsItems, 2)).not.toThrow();
  });

  test('does not throw when both counts are zero', () => {
    const weaponsItems = {
      '0x1': { name: 'No Ref' },
    };
    expect(() => db._validateUpgradeRefIndex(weaponsItems, 0)).not.toThrow();
  });
});
