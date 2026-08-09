# Demon's Souls Save Mechanism Documentation

## Purpose

Reverse-engineered documentation of the DeS `USER.DAT` save format, covering the interdependent data structures that must be synchronized when editing items: save file structure, inventory records, equipped slots and active selectors, Thomas deposit storage, spells, and field semantics.

---

## 1. Save File Overview

| Property | Value |
|----------|-------|
| File | `USER.DAT` (`MIN_SAVE_SIZE` = 0x22000 = 139,264 bytes minimum enforced; real saves are typically ~512 KB) |
| Endianness | Big-endian |
| Encryption | AES-CTR with HMAC-SHA1 (handled by PARAM.PFD layer, see `encrypted_export.md`) |

---

## 2. Inventory Records

### 2.1 Layout (0x20 bytes per record)

```
Offset  Size  Field      Description
------  ----  --------   -----------
+0x00   4     type       0x00000000=WPN, 0x10000000=ARM, 0x20000000=RNG, 0x40000000=GDS, 0xFFFFFFFF=empty
+0x04   4     itemId     Item ID (encodes weapon type + upgrade level for weapons)
+0x08   4     count      Stack count
+0x0C   4     idx1       Durability table key + hotbar pointer reference (unique per inventory)
+0x10   2     misc1      "sortId" — inventory menu grouping/ordering
+0x12   2     idx2       Display/sort order index (sequential position)
+0x14   4     misc2      Unknown (consistently 0x01000000; preserve verbatim)
+0x18   4     pad1       Untouched by the editor (observed 0 in original saves; remains 0xFF in newly claimed slots)
+0x1C   4     pad2       Untouched by the editor (observed 0 in original saves; remains 0xFF in newly claimed slots)
```

> The trailing 8 bytes (`+0x18`/`+0x1C`, `pad1`/`pad2`) were confirmed `0x00000000` across **all 184** records of a real BLUS30443 save. The editor leaves them untouched (newly-claimed slots inherit the `0xFF` empty-slot template).

### 2.2 Key Offsets

| Constant | Offset | Notes |
|----------|--------|-------|
| `INV_COUNT` | 0x2D4 | Number of active inventory records |
| `INV_COUNT_MIRROR` | 0x10360 | Mirror of INV_COUNT |
| `INV_TYPE_BASE` | 0x2DC | First record's type field |
| `INV_STRIDE` | 0x20 | 32 bytes per record |
| `INV_SLOTS` | 0x800 | 2048 total slots |

### 2.3 Durability Table

Parallel table indexed by `idx1`. Each entry is 8 bytes.

```
Offset: 0x10364 + idx1 * 8
+0x00   4   durability     Current condition value
+0x04   4   unknown        Flags/condition state (0x00 normally, non-zero for some items)
```

When an inventory item is deleted, the writer zeros its durability entry via `clearDurabilityForSlot()` — the first 4 bytes (durability value) are set to `0x00000000`; the second 4-byte field (flags/condition state) is left untouched.

### 2.4 Inventory Editing Strategy

The editor uses surgical in-place updates to avoid corrupting the game's inventory layout validation:

1. **In-place updates only** — The writer patches each item at its original `_slot` position. No blanking of the full inventory region, no rewriting, no reordering.
2. **Reader records `_slot`** — Each inventory record stores its original physical slot position (`offset / INV_STRIDE`).
3. **UI preserves `_ref`** — `model.js:sanitizeModel()` replaces `_slot` with an opaque `_ref` token (e.g., `"inv:42"`). The DOM round-trip carries `_ref` via a `data-ref` attribute on each `<tr>`. On save, `mergeModel()` maps `_ref` back to `_slot`.
4. **Deleted slots** — Slots occupied on disk but removed from the model are fully blanked (all 32 bytes set to `0xFF`). Deleted slot tracking uses an `out` bag from `mergeModel()` — the writer receives the list of slots to clear via its `deletedSlots` parameter.
5. **New items** — Items without a `_slot` are placed into the first available empty slot using a forward-only scan pointer.  The writer assigns `idx1 = idx2 = slot_number` (the game's invariant, confirmed from real save binary analysis).  Using global-max+1 breaks equipped-slot pointer resolution because the game's hotbar pointers reference inventory rows by `idx1`, which must match the slot for the equipped mark to display correctly.

### 2.5 Inventory Empty Slot Pattern

Deleted inventory slots are fully blanked with `0xFF` across all 32 bytes:

| Offset | Field | Value |
|--------|-------|-------|
| 0x00–0x1F | entire record | `0xFF` repeated (32 bytes) |

Deleted durability entries are zeroed (`0x00000000`) by the writer's `clearDurabilityForSlot()`.

### 2.6 `idx1` Uniqueness

The reader and writer do **not** validate `idx1` uniqueness across inventory items. This is deliberate — the editor honors user-provided values as-is. However, duplicate `idx1` values cause silent last-write-wins collisions in both the durability table and the hotbar pointer maps, which can lead to data loss for the colliding items. No warning is emitted.

---

## 3. Equipped Slots & Selectors

The weapon/item the character is currently holding ("on hand") is **not** determined by changing the equipped item IDs. Instead, the game stores *both* hand-1 and hand-2 weapons in fixed slots and uses a pair of **active-slot selector** fields to track which one is currently drawn. Similarly, the goods hotbar has an active quick-slot selector.

### 3.1 Full Equipped-Slot Region Layout

The equipped-slot region spans from the hotbar inventory-index pointers (`0x238`–`0x27C`) through the active-slot selectors (`0x284`–`0x288`) to the equipped item-ID cache (`0x28C`–`0x2D0`):

```
0x238  LH1_PTR      UInt32  Inventory idx1 for left-hand slot 1
0x23c  RH1_PTR      UInt32  Inventory idx1 for right-hand slot 1
0x240  LH2_PTR      UInt32  Inventory idx1 for left-hand slot 2
0x244  RH2_PTR      UInt32  Inventory idx1 for right-hand slot 2
0x248  ARROW_PTR    UInt32  Inventory idx1 for equipped arrows
0x24c  BOLT_PTR     UInt32  Inventory idx1 for equipped bolts
0x250  HELMET_PTR   UInt32  Inventory idx1 for helmet
0x254  CHEST_PTR    UInt32  Inventory idx1 for chest armor
0x258  GAUNTLETS_PTR UInt32 Inventory idx1 for gauntlets
0x25c  LEGGINGS_PTR UInt32  Inventory idx1 for leggings
0x260  RESERVED     UInt32  Reserved/padding (always 0xFFFFFFFF)
0x264  RING1_PTR    UInt32  Inventory idx1 for ring slot 1
0x268  RING2_PTR    UInt32  Inventory idx1 for ring slot 2
0x26c  QUICK1_PTR   UInt32  Inventory idx1 for quick slot 1
0x270  QUICK2_PTR   UInt32  Inventory idx1 for quick slot 2
0x274  QUICK3_PTR   UInt32  Inventory idx1 for quick slot 3
0x278  QUICK4_PTR   UInt32  Inventory idx1 for quick slot 4
0x27c  QUICK5_PTR   UInt32  Inventory idx1 for quick slot 5
0x280  (unknown)    UInt32  0x00000001 (does not change)
0x284  ACTIVE_LH_SLOT UInt32 0=LH1, 1=LH2  ← active left-hand selector
0x288  ACTIVE_RH_SLOT UInt32 0=RH1, 1=RH2  ← active right-hand selector
0x28c  LH1          UInt32  Left-hand 1 item ID
0x290  RH1          UInt32  Right-hand 1 item ID
0x294  LH2          UInt32  Left-hand 2 item ID
0x298  RH2          UInt32  Right-hand 2 item ID
0x29c  ARROWS       UInt32  Equipped arrow item ID
0x2a0  BOLTS        UInt32  Equipped bolt item ID
0x2a4  HELMET       UInt32  Helmet item ID
0x2a8  CHEST        UInt32  Chest armor item ID
0x2ac  GAUNTLETS    UInt32  Gauntlets item ID
0x2b0  LEGGINGS     UInt32  Leggings item ID
0x2b4  HAIRSTYLE    UInt32  Hairstyle item ID
0x2b8  RING1        UInt32  Ring slot 1 item ID
0x2bc  RING2        UInt32  Ring slot 2 item ID
0x2c0  QUICK1       UInt32  Quick slot 1 item ID
0x2c4  QUICK2       UInt32  Quick slot 2 item ID
0x2c8  QUICK3       UInt32  Quick slot 3 item ID
0x2cc  QUICK4       UInt32  Quick slot 4 item ID
0x2d0  QUICK5       UInt32  Quick slot 5 item ID
0x2d4  INV_COUNT    UInt32  Inventory record count
```

> Offset `0x260` is a reserved/padding slot (always `0xFFFFFFFF`). The ring and quick-slot pointers start at `0x264` and run through `0x27C`. Verified against a real BLUS30443 save: all 13 non-empty equipment slots resolve correctly with these offsets.

### 3.2 Hotbar Pointers

Each equipped slot has a pointer at a fixed offset. The pointer value is the inventory `idx1` of the equipped item. Unused pointer = `0xFFFFFFFF`.

| Slot | Pointer Offset | ItemID Offset |
|------|---------------|---------------|
| LH1 | 0x238 | 0x28C |
| RH1 | 0x23C | 0x290 |
| LH2 | 0x240 | 0x294 |
| RH2 | 0x244 | 0x298 |
| Arrow | 0x248 | 0x29C |
| Bolt | 0x24C | 0x2A0 |
| Helmet | 0x250 | 0x2A4 |
| Chest | 0x254 | 0x2A8 |
| Gauntlets | 0x258 | 0x2AC |
| Leggings | 0x25C | 0x2B0 |
| (reserved) | 0x260 | — |
| Ring1 | 0x264 | 0x2B8 |
| Ring2 | 0x268 | 0x2BC |
| Quick1 | 0x26C | 0x2C0 |
| Quick2 | 0x270 | 0x2C4 |
| Quick3 | 0x274 | 0x2C8 |
| Quick4 | 0x278 | 0x2CC |
| Quick5 | 0x27C | 0x2D0 |

### 3.3 Active Slot Selectors (Not Edited)

These fields determine which weapon/item the character actually holds or which quick slot is active. The editor does **not** modify them.

| Selector | Offset | Size | Type | Values | Effect |
|----------|--------|------|------|--------|--------|
| `ACTIVE_LH_SLOT` | 0x284 | 4 | UInt32 BE | `0` = LH1, `1` = LH2 | Which left-hand weapon is currently held |
| `ACTIVE_RH_SLOT` | 0x288 | 4 | UInt32 BE | `0` = RH1, `1` = RH2 | Which right-hand weapon is currently held |
| `ACTIVE_QUICK_SLOT` | 0x1035C | 4 | UInt32 BE | `0`–`4` | Which quick slot is active (0=QUICK1, … 4=QUICK5) |

The `0x280` field (unknown, observed `0x00000001` in all saves) sits between the pointers and selectors and does not change when weapons are switched.

Memory layout around `ACTIVE_QUICK_SLOT`:
```
0x1035c  ACTIVE_QUICK_SLOT   UInt32  0=QUICK1, 1=QUICK2, … 4=QUICK5
0x10360  INV_COUNT_MIRROR    UInt32  Mirror of INV_COUNT (0x2d4)
0x10364  DURABILITY_BASE     —       Start of durability table (+ idx1 * 8)
```

### 3.4 Editor Behavior (Equipped Slots)

The editor reads and writes all 18 equipped item IDs in the range `0x28C`–`0x2D0`. Seventeen of these have associated hotbar pointers (`LH1_PTR` … `QUICK5_PTR`, `0x238`–`0x27C`); `HAIRSTYLE` (`0x2B4`) has no pointer and is written as an ID only.

For each pointer-equipped slot, the editor back-resolves the matching hotbar pointer to the inventory `idx1` of the selected item. Pointer resolution uses a 3-tier rule (in priority order):

1. **ID unchanged** (`newId == oldId` on disk): Keep the existing pointer verbatim. Preserves the game's binding for duplicate items (e.g., 3 Kilijs) — a no-op re-save does not rebind to a different instance.
2. **Current pointer already resolves to the desired item**: If the on-disk pointer's `idx1` maps to an inventory row whose `itemId == newId`, keep it. Handles ID/pointer desync and re-equipping the same physical instance.
3. **First-wins fallback**: Pick the first inventory row matching `newId`. Unambiguous when the item is unique; best-effort for duplicates.

Edge cases:
- Empty slot (`0xFFFFFFFF`): writes `0xFFFFFFFF` to both the ID and pointer.
- Foreign/unknown ID (not in inventory): leaves the pointer untouched (no invented `idx1`).

### 3.5 Active Hand-Slot Selector Evidence (Binary Comparison)

#### Right-hand test

Two saves were compared where the only gameplay difference was which right-hand weapon was actively held:

**Equipped item IDs (identical in both saves):**

| Offset | Field | Value | Weapon |
|--------|-------|-------|--------|
| `0x28c` | LH1 | `0x00024b1c` | Heater Shield |
| `0x290` | RH1 | `0x00009d8e` | Crescent Falchion+4 |
| `0x294` | LH2 | `0x000187cc` | Bare Fists |
| `0x298` | RH2 | `0x0001fc3a` | Compound Short Bow+6 |
| `0x29c` | ARROWS | `0x00027100` | Arrow |

**Active-slot selectors (the only gameplay-relevant diff):**

| Offset | Old value | New value | Meaning |
|--------|-----------|-----------|---------|
| `0x284` | `0x00000000` | `0x00000000` | Active LH = LH1 (Heater Shield) — unchanged in RH test |
| `0x288` | `0x00000000` | `0x00000001` | Active RH: 0→RH1 (Falchion), 1→RH2 (Bow) **← CHANGED** |

The sole gameplay-relevant byte change was at offset `0x28b` (the low byte of the UInt32 at `0x288`) going from `0x00` → `0x01`.

#### Left-hand test

A separate comparison where the only gameplay difference was which left-hand weapon was actively held:

| Offset | Old value | New value | Meaning |
|--------|-----------|-----------|---------|
| `0x284` | `0x00000000` | `0x00000001` | Active LH: 0→LH1 (Heater Shield), 1→LH2 (Bare Fists) **← CHANGED** |
| `0x288` | `0x00000000` | `0x00000000` | Active RH = RH1 (Crescent Falchion+4) — unchanged |

The sole gameplay-relevant byte change was at offset `0x287` (the low byte of the UInt32 at `0x284`) going from `0x00` → `0x01`.

#### Annotated dump (equipped slots region)

```
Offset   Old          New          Label
0x0238   0x00000000   0x00000000   LH1_PTR
0x023c   0x00000033   0x00000033   RH1_PTR
0x0240   0x00000002   0x00000002   LH2_PTR
0x0244   0x00000005   0x00000005   RH2_PTR
0x0248   0x00000001   0x00000001   ARROW_PTR
0x024c   0xffffffff   0xffffffff   BOLT_PTR
0x0250   0x00000055   0x00000055   HELMET_PTR
0x0254   0x00000057   0x00000057   CHEST_PTR
0x0258   0x00000058   0x00000058   GAUNTLETS_PTR
0x025c   0x00000059   0x00000059   LEGGINGS_PTR
0x0260   0xffffffff   0xffffffff   RESERVED (padding)
0x0264   0x00000016   0x00000016   RING1_PTR
0x0268   0x00000035   0x00000035   RING2_PTR
0x026c   0x00000028   0x00000028   QUICK1_PTR
0x0270   0x0000004b   0x0000004b   QUICK2_PTR
0x0274   0xffffffff   0xffffffff   QUICK3_PTR (empty)
0x0278   0xffffffff   0xffffffff   QUICK4_PTR (empty)
0x027c   0xffffffff   0xffffffff   QUICK5_PTR (empty)
0x0280   0x00000001   0x00000001   (unknown)
0x0284   0x00000000   0x00000000   ACTIVE_LH_SLOT (0=LH1, 1=LH2)
0x0288   0x00000000   0x00000001   ACTIVE_RH_SLOT (0=RH1, 1=RH2) *** CHANGED ***
0x028c   0x00024b1c   0x00024b1c   LH1 = Heater Shield
0x0290   0x00009d8e   0x00009d8e   RH1 = Crescent Falchion+4
0x0294   0x000187cc   0x000187cc   LH2 = Bare Fists
0x0298   0x0001fc3a   0x0001fc3a   RH2 = Compound Short Bow+6
0x029c   0x00027100   0x00027100   ARROWS = Arrow
0x02a0   0xffffffff   0xffffffff   BOLTS = none
```

#### Pointer ↔ Item ID Relationship

The hotbar pointers (`0x238`–`0x27c`) reference inventory rows by `idx1` (the durability-table key), **not** by the item ID or slot position. The game resolves the active weapon as: `ACTIVE_RH_SLOT` → RH1 or RH2 → `RH1_PTR`/`RH2_PTR` (idx1) → inventory row → item ID. The `idx1` field is unique per inventory row, and all equipment pointers resolve correctly via `idx1` lookup.

| Pointer field | Offset | idx1 value | Inventory row itemId | Equipped ID | Weapon |
|---------------|--------|------------|----------------------|-------------|--------|
| RH1_PTR | `0x23c` | `0x33` (51) | row 51 | `0x00009d8e` | Crescent Falchion+4 |
| RH2_PTR | `0x244` | `0x05` (5) | row 5 | `0x0001fc3a` | Compound Short Bow+6 |
| RING1_PTR | `0x264` | `0x16` (22) | row 22 | `0x00000071` | Cling Ring |
| RING2_PTR | `0x268` | `0x35` (53) | row 53 | `0x0000006a` | Ring |
| QUICK1_PTR | `0x26c` | `0x28` (40) | row 40 | `0x000003e9` | Half Moon Grass |
| QUICK2_PTR | `0x270` | `0x4b` (75) | row 75 | `0x000003f0` | Widow's Lotus |

### 3.6 Active Quick-Slot Selector Evidence (Binary Comparison)

Two saves were compared where the only gameplay difference was which quick-slot item was active:

**Quick slot item IDs (identical in both saves):**

| Offset | Field | Value | Item |
|--------|-------|-------|------|
| `0x2c0` | QUICK1 | `0x000003e9` | Half Moon Grass |
| `0x2c4` | QUICK2 | `0x000003f0` | Widow's Lotus |
| `0x2c8` | QUICK3 | `0xffffffff` | (empty) |
| `0x2cc` | QUICK4 | `0xffffffff` | (empty) |
| `0x2d0` | QUICK5 | `0xffffffff` | (empty) |

**Active quick-slot selector (the only gameplay-relevant diff):**

| Offset | Old value | New value | Meaning |
|--------|-----------|-----------|---------|
| `0x1035c` | `0x00000000` | `0x00000001` | Active slot: 0→QUICK1 (Half Moon Grass), 1→QUICK2 (Widow's Lotus) **← CHANGED** |

The sole gameplay-relevant byte change was at offset `0x1035f` (the low byte of the UInt32 at `0x1035c`) going from `0x00` → `0x01`.

#### Quick Slot Pointer Chain

The game resolves the active goods item as:

1. Read `ACTIVE_QUICK_SLOT` (`0x1035c`) → selects QUICK1…QUICK5
2. Read the corresponding `QUICKn_PTR` (`0x26c` + n*4) → gets inventory `idx1`
3. Look up the inventory row by `idx1` → get the item ID

---

## 4. Thomas Deposit (Storage)

### 4.1 Entry Layout (0x14 = 20 bytes per entry)

```
DepositEntry (0x14 = 20 bytes):
  +0x00  UInt32BE  unknown1       // Usually 0x00000000 (sometimes 0x01, 0x02, 0x03)
  +0x04  UInt8     type           // 0x00=WPN, 0x10=ARM, 0x20=RNG, 0x40=GDS, 0xFF=empty
  +0x05  UInt24BE  itemId         // 3-byte item ID
  +0x08  UInt32BE  sortOrder      // hi16=sortId (matches inventory misc1), lo16=deposit order index
  +0x0C  UInt8     count          // stack count for goods
  +0x0D  UInt8     flag           // 0x21 for items, 0x00 for empty
  +0x0E  UInt32BE  pad            // 0x00000000 for items; 0x0000FFFF for empty slots
  +0x12  UInt16BE  durability     // weapon/armor max durability (e.g. 300=0x012C, 200=0x00C8)
```

The reader captures bytes 13–19 (`flag` + `pad` + `durability` = 7 bytes) as a 7-element `flags` array for write-back fidelity — `flags[0]` is the flag byte, `flags[1..4]` are pad, and `flags[5..6]` are durability. Durability is also extracted separately from bytes 18–19 into the named model field. In the sanitized model, deposit items carry `unknown1`, `sortOrder`, and `flags[]` as hidden data — these fields travel through the DOM as dataset attributes and are restored verbatim on merge.

### 4.2 Key Offsets

| Constant | Offset | Notes |
|----------|--------|-------|
| `DEPOSIT_BASE` | 0x14BE8 | First entry |
| `DEPOSIT_STRIDE` | 0x14 | 20 bytes |
| `DEPOSIT_MAX_ENTRIES` | 2048 | Maximum slots |
| `DEPOSIT_COUNT` | 0x1EBEC | UInt32BE — number of non-empty deposit entries (written on save) |

### 4.3 Deposit Entry Count (`0x1EBEC`)

The game stores the deposit entry count at `0x1EBEC` as a UInt32BE. The editor writes this field on every save, setting it to the number of non-empty deposit entries written. If this count becomes stale (e.g., items added or removed without updating it), the game may refuse to load entries beyond the stored count (items invisible) or load garbage if the count is too high (corruption).

### 4.4 Empty Slot Pattern

**Game-native empty deposit slot:**
```
00 00 00 00 FF FF FF FF FF FF FF FF 00 00 00 00 FF FF FF FF
```

The writer's blanking loop produces this exact pattern — `0xFF` fills bytes 4–11 (type, itemId, sortOrder) and 16–19 (pad high half + durability), while `0x00` fills bytes 0–3 (unknown1), 12 (count), and 13–15 (flag + pad low half). All 2048 slots are blanked first, then deposit entries are written sequentially.

### 4.5 Deposit Durability

The deposit entry stores weapon/armor durability in bytes 18–19 (the last 2 bytes of the 20-byte entry) as a UInt16BE. This is separate from the inventory durability table.

On write, the writer determines durability with a tiered approach:
1. **Tier 1**: Named `durability` field from the model (UI-editable, includes explicit 0).
2. **Tier 2**: `flags[5..6]` for records that lack the named field — this is preserved binary data, not user input (treat 0 as "no data").
3. If neither tier yields a value, the writer throws (no silent defaults for weapons/armor).

Evidence from real save (deposit weapon durability):

| Deposit Slot | Item ID | Durability (bytes 18–19) | Typical Max |
|-------------|---------|--------------------------|-------------|
| 2 | 0x00016120 | 01 2C (300) | 300 |
| 6 | 0x000027D8 | 00 C8 (200) | 200 |
| 46 | 0x00024F04 | 01 2C (300) | 300 |
| 59 | 0x00024EA0 | 01 F4 (500) | 500 |

### 4.6 `sortOrder` Field (bytes 8–11)

The hi16 is the `sortId` — it matches the inventory `misc1` field for the same item type. The lo16 is a **deposit-specific display/order index** — it increments roughly with position but is not strictly sequential (there are gaps where empty slots were removed). It does not encode durability or upgrade level; durability is in bytes 18–19.

On write, the writer preserves the original lo16 when non-zero (carries meaningful deposit order data); for new items where the lo16 is zero, it falls back to the sequential slot index. This is non-corrupting: a wrong sortId causes the item to appear at an odd position in-game but does not damage the save.

### 4.7 New Deposit Item Defaults

New deposit items added via the UI start with only `category`, `itemId`, `count`, and (optionally) `durability`. The `assignDepositDefaults()` function in `model.js` fills the binary-internal fields:

- `unknown1` = 0
- `sortOrder` = 0 (sortId=0 → item appears at top of in-game deposit list)
- `flags` = `[0x21, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]` — flag byte `0x21` is the game-native "occupied item" marker; durability bytes are zero (writer uses the named field)

### 4.8 Limit Enforcement

The UI enforces `DEPOSIT_MAX_ENTRIES` (2048). When the limit is reached, adding more items is blocked. The writer also checks the count before writing and throws if exceeded.

---

## 5. sortId (misc1) Reference

`misc1` (record `+0x10`, UInt16 BE) is the in-game inventory **sort key**. It
encodes a **`class`** (menu sort group) and a **`class_idx`** (position within
that group). The encoding is category-specific — there is no single byte split
that works for all four categories:

| Category | `class` (sort group) | `class_idx` (position) | Decode |
|----------|----------------------|------------------------|--------|
| Weapons | `misc1 >> 8` | `misc1 & 0xFF` | hi/lo byte split |
| Armor | `floor(misc1 / 1000)` (0=head, 1=chest, 2=arms, 3=legs) | `misc1 % 1000` | decimal `slotType*1000 + row` |
| Rings | `0` (single group) | `misc1` | sequential ring index |
| Goods | `misc1 >> 8` (0 or 1) | `misc1 & 0xFF` (tier) | hi/lo byte split |

Worked examples: Arrow `0x0516` → weapon class `0x05`, idx `0x16`; Heater Shield
`0x3F17` → class `0x3F`, idx `0x17`; Kilij `0x1005` → class `0x10`, idx `0x05`;
Assassin's Mask `0x000C` → armor slot head, row 12; Black Leather `0x03F4` →
chest, row 12; Crescent Moon Grass / Shard of Hardstone / Augite of Souls all
`0x0001` → goods tier 1.

### 5.1 `class` is the menu sort group, not the DB type

`class` is **not** the `type_id`/`sub_type_id` from `js/des-db/`. It is purely the
in-game menu grouping. One DB type can span several classes, and unrelated DB
types can share a class:

| `class` | Menu group | Examples (DB type) |
|---------|------------|--------------------|
| `0x36` / `0x37` | bows | Long Bow, Compound Short Bow (`[3/1]`) |
| `0x3A` | crossbows + catalysts + talismans | Light/Heavy Crossbow (`[3/2]`), Wooden/Silver Catalyst (`[6/1]`), Talisman of Beasts (`[6/2]`) |
| `0x00` vs `0x18` | dagger-base vs casting-dagger | Secret Dagger (`[1/1]`) vs Geri's Stiletto (`[1/1]`) — same DB type, different class |

### 5.2 `class_idx` is a shared sort position, NOT a unique item id

`class_idx` is **not unique** — neither across classes nor within a single class.
`(category, class, class_idx)` maps to a **display slot**, and the game
deliberately collapses related items onto the same slot.

- **Reused across classes** (same idx, different weapon class), observed in one
  BLUS30443 save: idx `0x15` ∈ {`0x05` projectiles, `0x37` bows}; idx `0x17` ∈
  {`0x05`, `0x3F` shields}; idx `0x7B` ∈ {`0x05`, `0x08` large-swords}; idx
  `0x99` ∈ {`0x08`, `0x3A` crossbow/catalyst}.
- **Reused within a class** (same `class`+`class_idx`, different item):
  - Weapons: Compound Short Bow (`0x1FC34`) and Compound Short Bow+6 (`0x1FC3A`)
    both `0x36E3` — a base weapon and its upgrade share one sort slot.
  - Goods: every item in a tier shares the lo-byte (e.g. Crescent Moon Grass
    `0x3E8`, Shard of Hardstone `0x7D0`, Augite of Souls `0x63` all `0x0001`).
    41 such goods collisions observed in this save.
  - Armor: the four "Bare" placeholder slots (head/chest/arms/legs) all share
    `0x0000`.

### 5.3 Weapon sort classes observed (reference, non-exhaustive)

Only classes the analyzed character **owns** are visible in one save; the full
game superset is larger. From a real BLUS30443 save:

| `class` | Menu group | Example |
|---------|------------|---------|
| `0x00` | bare / dagger-base | Bare Fists, Secret Dagger |
| `0x05` | projectiles (arrows + bolts) | Arrow, Wooden Arrow, Bolt |
| `0x08` | large / very-large swords | Claymore, Storm Ruler, Northern Regalia |
| `0x0B` | very-large swords | Great Sword |
| `0x0F` | curved swords | Crescent Falchion |
| `0x10` | curved swords | Kilij |
| `0x13` | katanas | Magic Sword 'Makoto' |
| `0x17` | rapiers | Rapier |
| `0x18` | casting daggers | Geri's Stiletto |
| `0x1B` | axes | Crushing Battle Axe |
| `0x23` | hammers | Mace |
| `0x27` | fists | Claws |
| `0x2B` | spears | Winged Spear |
| `0x2E` / `0x2F` | poles | Halberd / Mirdan Hammer |
| `0x36` / `0x37` | bows | Compound Short Bow / Long Bow, White Bow |
| `0x3A` | crossbows + catalysts + talismans | Light Crossbow, Wooden Catalyst, Talisman of Beasts |
| `0x3F` | parry shields | Heater Shield, Kite Shield |
| `0x42` | bash shields | Large Brushwood Shield |

### 5.4 Practical guidance

When adding a new item, copy `misc1` from an existing item of the same kind
(ideally the same base weapon / same tier) so it lands in the correct menu slot.
A wrong value does not corrupt the save — the item just appears at an odd
position. The editor carries `misc1` through to the UI for all four inventory
categories as an editable field and writes the UI-provided value back at each
item's original slot position.

---

## 6. Spell/Miracle Fields

### 6.1 Spell Record Layout

Each spell/miracle record in `USER.DAT` is 16 bytes at `0x143ec + i*0x10`:

```
+0x00 UInt32BE  status   (0=unavailable, 1=unknown, 2=known, 3=memorized)
+0x04 UInt32BE  spellId  (item ID matching spells.json)
+0x08 UInt32BE  misc1    (sort/category ID)
+0x0c UInt32BE  misc2    (always 0)
```

### 6.2 Misc1: Sort/Category ID

Controls spell ordering and grouping in the in-game magic menu. The tens digit groups spells by category: 0x=basic/utility, 1x=fire, 2x=enchantment, 3x=defensive, 5x=utility. Miracles use low values (1–8). The ones digit is the position within that category.

Observed values from a real save (14 spells), per `js/des-savefile/offsets.js` comment, cross-referenced against `js/des-db/spells.js`:

| Spell ID | Spell | Type | Misc1 | Category (tens digit) |
|----------|-------|------|-------|-----------------------|
| 0x3e8 | Soul Arrow | Magic | 1 | 0x = basic/utility |
| 0x3e9 | Flame Toss | Magic | 11 | 1x = fire |
| 0x3ef | Demon's Prank | Magic | 53 | 5x = utility |
| 0x3f4 | Cloak | Magic | 51 | 5x = utility |
| 0x3f5 | Protection | Magic | 31 | 3x = defensive |
| 0x3f7 | Water Veil | Magic | 3 | 0x = basic/utility |
| 0x3f9 | Fire Spray | Magic | 12 | 1x = fire |
| 0x3fc | Warding | Magic | 32 | 3x = defensive |
| 0x3fd | Firestorm | Magic | 53 | 5x = utility |
| 0x7d4 | Regeneration | Miracle | 5 | 0x = basic/utility |
| 0x7d7 | Hidden Soul | Miracle | 8 | 0x = basic/utility |
| 0x7d8 | Evacuate | Miracle | 5 | 0x = basic/utility |
| 0x7da | Heal | Miracle | 8 | 0x = basic/utility |
| 0x7db | Antidote | Miracle | 7 | 0x = basic/utility |

Note: `0x3EF` = Demon's Prank is a **magic spell** (sub_type_id 1 = Magic in `rel-types.js`), not a miracle. All entries with IDs ≥ `0x7D0` are miracles (sub_type_id 2); entries below are magic (sub_type_id 1).

The editor preserves `misc1` from existing spells via DOM data attributes and defaults new spells to `misc1=0`. Setting `misc1=0` works fine in-game — the spell appears at the top of the magic menu list instead of its natural category position.

**TODO**: Verify whether `misc1` is hardcoded per spell (same value for same spell across different saves) or can vary. If hardcoded, look it up from a table when adding new spells instead of defaulting to 0.

### 6.3 Misc2

Always `0` in all observed saves. Purpose unknown. The editor preserves existing values and defaults new spells to 0.

### 6.4 Stale Spell Record Clearing

When the new spell count is lower than the original (spells removed), the writer zeroes the leftover records beyond the new `SPELL_COUNT`. Each stale record's 16 bytes are set to all zeros (`EMPTY_SPELL`). This keeps the data clean and consistent with the deposit writer's full-blank approach. The game respects `SPELL_COUNT` for display, but clearing prevents any residual data from lingering in the buffer.

---

## 7. Evidence

Findings derived from:
- Binary dumps and comparisons between real BLUS30443 saves
- Source code in `js/des-savefile/` (reader, writer, offsets, model)
- Cross-reference of item IDs against `js/des-db/` databases