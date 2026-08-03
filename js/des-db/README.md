# des-db

A read-only game data module for **Demon's Souls**. It treats the JSON/JS data files in
this directory as the single source of truth, deep-freezes everything on load, and
exposes a functional query API that lets clients retrieve data but never mutate it.

## Design Principles

| Principle | Details |
|---|---|
| **Immutable** | All exported data is `Object.freeze`-d recursively at module load. Mutation throws `TypeError` in strict mode. |
| **Fail-fast** | Unknown categories, item IDs, path IDs, and base weapon IDs throw `Error` immediately rather than returning `undefined`. |
| **Zero per-call allocation** | Ordered arrays, lookup maps, and pre-resolved upgrade-path references are built once at load and returned directly. Hot-path queries never allocate. |
| **Stale-index guard** | A load-time check compares `idx-upgrade-ref.js` entry count against `weapons.js` — a mismatch throws immediately. |

## File Map

| File | Role | Top-level key | Entry shape |
|---|---|---|---|
| `index.js` | **Public API barrel export** — all 14 query functions | — | — |
| `weapons.js` | Weapons, shields, bows, ammo, casting tools | `items` | `{ name, type, upgrade_ref?, durability?, note? }` |
| `armors.js` | Armor pieces (head/chest/arms/legs) | `items` | `{ name, type, durability?, note? }` |
| `rings.js` | Rings | `items` | `{ name, type, note? }` |
| `goods.js` | Consumables, ore, souls, keys, eye stones, special items | `items` | `{ name, type, note? }` |
| `spells.js` | Magic spells and miracles | `items` | `{ name, type, note? }` |
| `hairstyles.js` | Character customization hairstyles | `hairstyles` | `{ name }` |
| `class.js` | Starting character classes | `classes` | Ordered `string[]` (10 entries) |
| `rel-types.js` | Item type → sub-type relationship table | `types` | `{ name, sub_types: { id: { name } } }` |
| `rel-upgrades.js` | Upgrade paths and base-weapon definitions | `paths`, `base_weapons` | See [Upgrade System](#upgrade-system-rel-upgradesjs) |
| `warps.js` | Warp locations and world name lookup | `warps`, `world_names` | See [Warps](#warps-warpsjs) |
| `idx-upgrade-ref.js` | ⚠️ **Generated** reverse lookup index | `index` | See [Generated Index](#generated-index-idx-upgrade-refjs) |

Every data file carries a `_meta` block with `description`, `source`, and `schema` fields
documenting its origin and shape.

## Hex ID Convention

All item keys across `weapons`, `armor`, `rings`, `goods`, `spells`, and `hairstyles` are
**canonical uppercase hex strings** (e.g. `"0x2710"`).

The API accepts both string and number forms for item IDs:

```js
db.getItem('weapons', '0x2710');  // string — normalized internally
db.getItem('weapons', 0x2710);    // number — converted internally
db.getItem('weapons', '0x2710');  // lowercase — also works
```

## Category Schemas

### Weapons (`weapons.js`)

The largest data file — encompasses five item types under one category:

| Type ID | Name | Sub-type IDs |
|---|---|---|
| 1 | Weapon | 0 Experimental, 1 Dagger, 2 Straight Sword, 3 Large Sword, 4 Very Large Sword, 5 Curved Sword, 6 Katana, 7 Rapier, 8 Axe, 9 Large Axe, 10 Hammer, 11 Large Hammer, 12 Fist, 13 Spear, 14 Pole |
| 2 | Shield | 0 Experimental, 1 Parry Shield, 2 Bash Shield |
| 3 | Bow | 0 Experimental, 1 Bow, 2 Crossbow |
| 4 | Ammo | 0 Experimental, 1 Arrow, 2 Bolt |
| 6 | Casting Tool | 0 Experimental, 1 Catalyst, 2 Talisman |

Sub-type IDs are scoped per-type (each starts from 0, where 0 is reserved for Experimental).

Entry shape:

```js
{
  "name": "Dagger",              // display name
  "type": [1, 1],                // [type_id, sub_type_id] — sub_type is per-type
  "upgrade_ref": [1, 1, 0],     // optional: [base_weapon_id, path_id, level]
  "durability": 30,              // optional: only on Casting Tool entries
  "note": "..."                  // optional: wikidot-sourced summary
}
```

**`upgrade_ref`** is present only on Weapon (1), Shield (2), and Bow (3) entries that map
to a base weapon. Entries for non-upgradable weapons (base IDs 69-89) use
`[id, null, null]`. Ammo and Casting Tool entries omit `upgrade_ref` entirely.

**`durability`** is populated only on Casting Tool (type 6) entries. For
Weapon/Shield/Bow entries, durability is resolved indirectly via `base_weapons` in
`rel-upgrades.js`.

### Armor (`armors.js`)

```js
{
  "name": "Gold Mask",
  "type": [5, 1],      // [type_id, sub_type_id]; sub_type_id starts from 0 (0 is Experimental)
  "durability": 150,    // optional: max durability; absent on empty slots and NPC equipment
  "note": "..."         // optional: wikidot-sourced summary
}
```

Type 5 (Armor) sub-types: 0 Experimental, 1 Head, 2 Chest, 3 Arms, 4 Legs.

### Rings / Goods / Spells

All share the same minimal shape:

```js
{
  "name": "Ring of Great Strength",
  "type": [8, 1],      // [type_id, sub_type_id]; sub_type_id starts from 0 (0 is Experimental)
  "note": "..."        // optional: wikidot-sourced summary
}
```

Type ranges by category:

| Category | Type IDs | Sub-type IDs |
|---|---|---|
| `rings` | 8 (Ring) | 0 Experimental, 1 Ring |
| `goods` | 9 Ore, 10 Consumables, 11 Souls, 12 Key Item | 0-1 (Ore), 0-6 (Consumables), 0-2 (Souls), 0-3 (Key Item) |
| `spells` | 7 (Spell) | 0 Experimental, 1 Magic, 2 Miracle |

### Hairstyles (`hairstyles.js`)

```js
{ "name": "Shaved (1)" }
```

Keyed by hex ID under the `hairstyles` top-level key (not `items`).

### Classes (`class.js`)

An ordered array of 10 class name strings. Index corresponds to class ID:

```js
["Soldier", "Knight", "Hunter", "Priest", "Magician",
 "Wanderer", "Barbarian", "Thief", "Temple Knight", "Royalty"]
```

## Type System (`rel-types.js`)

The full 13-entry type and sub-type table used by all item categories:

| Type ID | Name | Sub-types |
|---|---|---|
| 0 | Non-functional Leftover | 0 Unused Items |
| 1 | Weapon | 0 Experimental, 1 Dagger, 2 Straight Sword, 3 Large Sword, 4 Very Large Sword, 5 Curved Sword, 6 Katana, 7 Rapier, 8 Axe, 9 Large Axe, 10 Hammer, 11 Large Hammer, 12 Fist, 13 Spear, 14 Pole |
| 2 | Shield | 0 Experimental, 1 Parry Shield, 2 Bash Shield |
| 3 | Bow | 0 Experimental, 1 Bow, 2 Crossbow |
| 4 | Ammo | 0 Experimental, 1 Arrow, 2 Bolt |
| 5 | Armor | 0 Experimental, 1 Head, 2 Chest, 3 Arms, 4 Legs |
| 6 | Casting Tool | 0 Experimental, 1 Catalyst, 2 Talisman |
| 7 | Spell | 0 Experimental, 1 Magic, 2 Miracle |
| 8 | Ring | 0 Experimental, 1 Ring |
| 9 | Ore | 0 Experimental, 1 Ore |
| 10 | Consumables | 0 Experimental, 1 Health Restoration, 2 Magic Restoration, 3 Status Ailment Cure, 4 Projectile Weapon, 5 Weapon Buff, 6 Other |
| 11 | Souls | 0 Experimental, 1 Souls, 2 Demon's Souls |
| 12 | Key Item | 0 Experimental, 1 Eye Stone, 2 Special, 3 Key |

## Upgrade System (`rel-upgrades.js`)

Defines 14 upgrade paths and maps base weapons (IDs 1-89) to their available paths.

### Upgrade Paths (1-14)

| ID | Name | Levels | Material | Summary |
|---|---|---|---|---|
| 1 | Basic | 0-10 | Hardstone / Sharpstone | Evenly increases physical damage with no special effects |
| 2 | Quality | 1-5 | Clearstone | Balanced STR and DEX scaling (both C at max) |
| 3 | Crushing | 1-5 | Greystone | STR scaling reaches S at +5; DEX removed |
| 4 | Sharp | 1-5 | Bladestone | DEX scaling reaches S at +5 |
| 5 | Dragon | 1-5 | Dragonstone | Adds fire damage; removes all stat bonuses |
| 6 | Tearing | 1-5 | Suckerstone | Adds heavy bleed damage; DEX scaling to S |
| 7 | Mercury | 1-5 | Mercurystone | Adds poison buildup |
| 8 | Fatal | 1-5 | Marrowstone | Adds critical damage bonus; DEX scaling to A |
| 9 | Moon | 1-5 | Moonlightstone | Adds magic damage scaling with MAG (C) |
| 10 | Crescent | 1-5 | Darkmoonstone | Magic damage (MAG A) + MP regeneration; removes STR/DEX |
| 11 | Blessed | 1-5 | Faintstone | Magic damage (FTH A at +5) + HP regeneration |
| 12 | Sticky | 1-5 | Spiderstone | Bows only; DEX scaling to S + increased range |
| 13 | Dark | 1-5 | Cloudstone | Shields only; raises Magic Damage Reduction |
| 14 | Colorless | 0-5 | Colorless Demon's Soul | Unique/special weapons only; max 10 per playthrough |

### Base Weapons

Each base weapon entry:

```js
{
  "name": "Dagger",
  "path_ids": [1, 4, 2, 7, 8, 10],  // valid upgrade path IDs
  "durability": 200,                 // base durability
  "note": "..."                      // wikidot-sourced summary
}
```

Base weapons 69-89 have no `path_ids` — they are valid Weapon/Shield/Bow records but cannot
be upgraded (e.g. Club, crossbows, non-upgradable shields).

## Warps (`warps.js`)

Two top-level keys:

- **`warps`** — Array of 32 warp entries:
  ```js
  { "name": "Nexus", "world": 1, "block": 0, "x": 0, "y": 0, "z": 0, "rot": 0 }
  ```
- **`world_names`** — Integer world ID → friendly name:
  ```js
  { "1": "The Nexus", "2": "Boletarian Palace", "3": "Shrine of Storms", ... }
  ```

## Generated Index (`idx-upgrade-ref.js`)

⚠️ **This file is auto-generated — do not edit manually.**

A reverse lookup index that enables O(1) resolution from an `upgrade_ref` tuple back to
the weapons hex item ID, powering `getWeaponItemByUpgradeRef()`.

### Structure

```js
{
  "_meta": {
    "tool": "tools/gen-des-db-index.mjs",
    "source": "js/des-db/weapons.js",
    "schema": "Keyed by \"base_weapon_id:path_id:level\" ...",
    "entryCount": 1654              // current entry count
  },
  "index": {
    "1:1:0": { "category": "weapons", "id": "0x2710" },   // Dagger
    "1:1:1": { "category": "weapons", "id": "0x2711" },   // Dagger+1
    "77:null:null": { "category": "weapons", "id": "0x51A4" } // Soulbrandt
  }
}
```

- **Key format**: `"base_weapon_id:path_id:level"` — null components serialized as `"null"`
- **Value**: `{ category, id }` where `category` is always `"weapons"` and `id` is the hex-ID string

### Generation

Created by `tools/gen-des-db-index.mjs`, which:

1. Iterates all `weapons.js` entries that have an `upgrade_ref` field
2. Skips entries without `upgrade_ref` (arrows, bolts, ghost items, etc.)
3. **Fails hard** on duplicate `upgrade_ref` tuples — generation aborts with an error
4. Supports reproducible builds via the `SOURCE_DATE_EPOCH` environment variable

Regenerate after editing `weapons.js`:

```bash
node tools/gen-des-db-index.mjs
```

### Stale-Index Guard

At module load time, `index.js` compares the live `upgrade_ref` count in `weapons.js`
against `_meta.entryCount` in the index. If they diverge, it throws immediately:

```
idx-upgrade-ref.js is stale: 1655 upgrade_ref entries in weapons.js but index has 1654.
Run: node tools/gen-des-db-index.mjs
```

This ensures a stale index can never silently produce wrong lookups.

## Public API (`index.js`)

All functions are named exports from `index.js`:

```js
import * as db from './des-db/index.js';
```

### Category & Item Queries

| Function | Returns | Throws on error |
|---|---|---|
| `getCategories()` | `string[]` — `['weapons', 'armor', 'rings', 'goods', 'spells', 'hairstyles']` | — |
| `getItemIdsByCategory(cat)` | `number[]` — ordered hex IDs | Unknown category |
| `getItemNamesByCategory(cat)` | `string[]` — ordered display names | Unknown category |
| `getItem(cat, id)` | Item entry object (frozen) | Unknown category / item not found |
| `hasItem(cat, id)` | `boolean` — never throws | — |

`getItem` / `hasItem` accept `id` as either a string (`'0x2710'`) or number (`0x2710`).

### Upgrade Queries

| Function | Returns | Throws on error |
|---|---|---|
| `getWeaponItemByUpgradeRef([baseId, pathId, level])` | `string` — hex item ID (e.g. `'0x2710'`) | Invalid array / no match |
| `getUpgradePathDef(pathId)` | `{ name, levels, note }` (frozen) | Unknown path ID |
| `getBaseWeapon(baseWeaponId)` | `{ name, path_ids, durability, note }` (frozen; path_ids sorted ascending) | Invalid base weapon ID |
| `hasBaseWeapon(baseWeaponId)` | `boolean` — never throws | — |

`getBaseWeapon` returns `path_ids` in deterministic ascending order regardless of
file insertion order. Non-upgradable but valid base weapons (e.g. Club = 69) return `[]`.

### Durability

| Function | Returns | Throws on error |
|---|---|---|
| `getItemDurability(cat, id)` | `number \| null` | Non-durability type / item not found |

Resolution rules:
- **Casting Tool (6) / Armor (5)** → the item's own `durability` field (`null` if absent)
- **Weapon (1) / Shield (2) / Bow (3)** → `base_weapons[upgrade_ref[0]].durability`
- All other types throw

### World & Class Queries

| Function | Returns | Throws on error |
|---|---|---|
| `getStartClasses()` | `string[]` — 10 class names | — |
| `getWarps()` | `Array<{ name, world, block, x, y, z, rot }>` — 32 entries | — |
| `getWorldName(world)` | `string` | Unknown world |
| `getAllTypes()` | `Array<{ typeId, name }>` — 13 entries | — |

## Data Sources

- **Item data**: [Wulf2k/DeS-SaveEdit](https://github.com/Wulf2k/DeS-SaveEdit) (VB source) — hex IDs and base item lists
- **Wiki data**: [demonssouls.wikidot.com](http://demonssouls.wikidot.com/) — notes, upgrade paths, durability, and type taxonomy
- **Warp coordinates**: Wulf2k/DeS-SaveEdit VB source