/**
 * Every hardcoded offset constant for the DeS USER.DAT save file, named.
 *
 * The DeS USER.DAT save file is a big-endian binary blob whose layout is
 * pinned to a specific game build.
 *
 * (The secondary file txtF2 — 04/104/204USER.DAT — has its own per-slot
 * name offset: 0x21D + slot*0x140.)
 */

/* ---- Buffer size ---- */

/**
 * Minimum buffer size for a valid DeS USER.DAT save.  All fixed offsets used
 * by the reader/writer fall within this range, so any buffer smaller than
 * this is either truncated, corrupt, or not a DeS save.  Enforced by both
 * readSave() and writeSave().
 */
export const MIN_SAVE_SIZE = 0x22000; // 139,264 bytes — covers the full position table (POS_TABLE_BASE=0x21AE3 + max spawn offset). Real saves are typically ~512 KB.

/* ---- SFO ---- */

export const SFO_PROFILE_NUMBER = 0x570;

/* ---- World / position ---- */

export const WORLD = 0x4;
export const BLOCK = 0x5;
export const POS_OFFSET_SELECTOR = 0x21ae1; // Int16, indexes into spawn table
export const POS_TABLE_BASE = 0x21ae3;

/* ---- Vitals ---- */

export const CURR_HP = 0x50;
export const CURR_MAX_HP = 0x54; // buffed/effective max HP
export const MAX_HP = 0x58;
export const CURR_MP = 0x5c;
export const CURR_MAX_MP = 0x60; // buffed/effective max MP
export const MAX_MP = 0x64;
export const CURR_STAM = 0x6c;
export const CURR_MAX_STAM = 0x70; // buffed/effective max stamina
export const MAX_STAM = 0x74;

/* ---- Stats (base + effective columns) ---- */

export const VIT = 0x80;
export const VIT_BASE = 0x7c;
export const INT = 0x88;
export const INT_BASE = 0x84;
export const END = 0x90;
export const END_BASE = 0x8c;
export const STR = 0x98;
export const STR_BASE = 0x94;
export const DEX = 0xa0;
export const DEX_BASE = 0x9c;
export const MAGIC = 0xa8;
export const MAGIC_BASE = 0xa4;
export const FAITH = 0xb0;
export const FAITH_BASE = 0xac;
export const LUCK = 0xb8;
export const LUCK_BASE = 0xb4;
export const SOULS = 0xbc;
export const SOUL_MEMORY = 0xc8;
export const LEVELS_PURCHASED = 0xcc;

/* ---- Identity ---- */

export const PHANTOM_TYPE = 0xd3;

/**
 * Name field.  Byte 0xD4 stays 0; character data (16 UTF-16LE pairs = 32
 * bytes) starts at 0xD5 (NAME+1).  The game reads the name as zero-terminated
 * UTF-16 from 0xD4, so pair [0x00, char0] is the first character.  No
 * length-prefix byte.
 */
export const NAME = 0xd4;
export const GENDER = 0xf6;
export const START_CLASS = 0xfb;

/* ---- Sanity check ---- */

export const SANITY_CHECK = 0x170; // must be non-zero

/* ---- Equipped slots (item ids + hotbar pointers) ---- */

// Hotbar inventory-index pointers
export const LH1_PTR = 0x238;
export const RH1_PTR = 0x23c;
export const LH2_PTR = 0x240;
export const RH2_PTR = 0x244;
export const ARROW_PTR = 0x248;
export const BOLT_PTR = 0x24c;
export const HELMET_PTR = 0x250;
export const CHEST_PTR = 0x254;
export const GAUNTLETS_PTR = 0x258;
export const LEGGINGS_PTR = 0x25c;
/** Padding/reserved slot — always 0xFFFFFFFF in real saves. Ring and quick-slot pointers start at 0x264. */
export const RESERVED_PTR = 0x260;
export const RING1_PTR = 0x264;
export const RING2_PTR = 0x268;
export const QUICK1_PTR = 0x26c;
export const QUICK2_PTR = 0x270;
export const QUICK3_PTR = 0x274;
export const QUICK4_PTR = 0x278;
export const QUICK5_PTR = 0x27c;

/**
 * Active hand-slot selectors (NOT read/written by this editor).
 *
 *   0x280 (UInt32 BE): unknown — always 0x00000001; NOT the left-hand selector.
 *   0x284 (UInt32 BE): active LEFT hand slot  — 0 = LH1, 1 = LH2
 *   0x288 (UInt32 BE): active RIGHT hand slot — 0 = RH1, 1 = RH2
 *
 * Switching the held weapon changes only the low byte of the relevant
 * selector (0x287 for LH, 0x28b for RH); all equipped item IDs remain
 * identical.
 */
export const ACTIVE_LH_SLOT = 0x284;
export const ACTIVE_RH_SLOT = 0x288;

// Equipped item ids
export const LH1 = 0x28c;
export const RH1 = 0x290;
export const LH2 = 0x294;
export const RH2 = 0x298;
export const ARROWS = 0x29c;
export const BOLTS = 0x2a0;
export const HELMET = 0x2a4;
export const CHEST = 0x2a8;
export const GAUNTLETS = 0x2ac;
export const LEGGINGS = 0x2b0;
export const HAIRSTYLE = 0x2b4;
export const RING1 = 0x2b8;
export const RING2 = 0x2bc;
export const QUICK1 = 0x2c0;
export const QUICK2 = 0x2c4;
export const QUICK3 = 0x2c8;
export const QUICK4 = 0x2cc;
export const QUICK5 = 0x2d0;

/* ---- Inventory ---- */

export const INV_COUNT = 0x2d4;
export const INV_COUNT_MIRROR = 0x10360;
export const INV_TYPE_BASE = 0x2dc; // first record's Type field
export const INV_ITEM_ID_BASE = 0x2e0; // first record's ItemID
export const INV_ITEM_COUNT_BASE = 0x2e4;
export const INV_IDX1_BASE = 0x2e8;
export const INV_MISC1_BASE = 0x2ec; // UInt16 — "sortId" (see note below)
export const INV_IDX2_BASE = 0x2ee; // UInt16 — display/sort order index
export const INV_MISC2_BASE = 0x2f0; // UInt32 — unknown/preserved raw
export const INV_STRIDE = 0x20;
export const INV_SLOTS = 0x800; // total record slots blanked on save
export const DURABILITY_BASE = 0x10364; // + Idx1 * 8

/**
 * Active quick-slot (goods hotbar) selector — NOT read/written by this editor.
 *
 * Determines which of the 5 quick slots is currently selected in the goods
 * hotbar.  Values: 0 = QUICK1, 1 = QUICK2, 2 = QUICK3, 3 = QUICK4, 4 = QUICK5.
 *
 * Switching the active quick item changes only the low byte at 0x1035f
 * (u32 at 0x1035c); all quick slot item IDs and pointers remain identical.
 */
export const ACTIVE_QUICK_SLOT = 0x1035c;

/**
 * Field semantics for inventory records (reverse-engineered from BLUS30443
 * save):
 *
 * Idx1 (+0x0C, UInt32/UInt16):
 *   "array index" — the key into the parallel durability table at
 *   DURABILITY_BASE (0x10364 + Idx1 * 8).  The equipped-slot hotbar pointers
 *   (LH1_PTR, RH1_PTR, … QUICK5_PTR) also reference inventory rows by this
 *   index.  Each inventory entry must have a unique Idx1.
 *
 *   NOTE ON UNIQUENESS: The reader and writer do NOT validate Idx1 uniqueness
 *   across inventory items.  This is a deliberate design choice — the editor
 *   honors user-provided values as-is, and it is the user's responsibility to
 *   provide correct, non-conflicting values.  Duplicate Idx1 values will
 *   cause the durability table and hotbar pointer maps to silently overwrite
 *   entries (last-write-wins), which can lead to data loss for the colliding
 *   items.  No warning is emitted.
 *
 * Misc1 (+0x10, UInt16):
 *   "sortId" — controls how the item is grouped and ordered in the in-game
 *   inventory menu.  It is NOT a random flag.  Patterns observed:
 *
 *     Weapons:  hi-byte = sort CLASS, lo-byte = CLASS_IDX (sort position).
 *       class_idx is NOT a unique item id — it is a shared menu sort position:
 *       a weapon and its upgrades share it, and the same class_idx recurs
 *       across different classes. (category, class, class_idx) maps to a
 *       display slot, not a unique item. See knowledge/des_save_mechanism.md
 *       §5 for the full per-category decoding and the observed weapon-class
 *       table.
 *       Class examples: 0x00 bare/unarmed · 0x05 projectiles (arrows/bolts) ·
 *       0x0f/0x10 curved swords · 0x36/0x37 bows · 0x3a crossbows/catalysts/
 *       talismans · 0x3f parry shields · 0x42 bash shields.
 *       e.g. Arrow=0x0516, Heavy Arrow=0x0517, Kilij=0x1005,
 *       Heater Shield=0x3f17, Crescent Falchion+4=0x0ffc.
 *
 *     Armor:    ≈ slotType×1000(dec) + itemRow.  Body slot is derived
 *       from the value: 0–999=head, 1000–1999=chest,
 *       2000–2999=gauntlets, 3000–3999=leggings.
 *       e.g. Assassin's Mask(head)=0x000C (12), Black Leather(chest)=0x03F4 (1012),
 *       Black Gloves(arms)=0x07DC (2012), Black Boots(legs)=0x0BC4 (3012).
 *       "---No X---" placeholder rows use 0x0000.
 *
 *     Rings:    simple sequential ring index (0x01 … 0x17+).
 *       e.g. Ring of Great Strength=0x01, Cling Ring=0x13,
 *       Thief's Ring=0x16.
 *
 *     Goods:    item "tier/type" — items sharing a sortId are the same
 *       family and appear adjacent in-game.
 *       0x01 basic grass/hardstone/augite · 0x07 sharpstone/soldier lotus
 *       · 0x0E–0x11 eye stones · 0x15–0x25 keys · 0x65–0x6A soldier/hero
 *       souls · 0xC9–0xD3 demon's souls.
 *       e.g. Crescent Moon Grass=Shard of Hardstone=0x01,
 *       Unknown Soldier's Soul=Shard of Dragonstone=0x65.
 *
 *   Practical advice: when adding a new item, copy Misc1 from an existing
 *   item of the same type so it sorts correctly.  A wrong value won't
 *   corrupt the save, but the item may appear in an odd place.
 *
 * Idx2 (+0x12, UInt16):
 *   "display index" — secondary sort / list position.  In saves observed so
 *   far Idx2 simply mirrors the row's sequential position (0, 1, 2, …) within
 *   the whole inventory array.
 *
 * Misc2 (+0x14, UInt32):
 *   Still undetermined — preserved verbatim.  In the saves observed it is
 *   consistently 0x01000000 for every row; its bit layout is unknown.
 *   Editing it blindly risks desync; leave as-is.
 *
 *   Durability (parallel table):
 *     Current condition for weapons/armor.  Stored at 0x10364 + Idx1*8, so it
 *     is read/written via Idx1.
 *
 *   Reserved (+0x18, +0x1C):  UInt32 each, undocumented.  Observed 0x00000000
 *     across all records of a real BLUS30443 save.  The editor leaves them
 *     untouched (newly-claimed slots inherit the 0xFF empty-slot template).
 */

/* ---- Spells / miracles ---- */

/**
 * Spell record layout (0x10 = 16 bytes each, starting at SPELL_BASE):
 *   +0x00 UInt32BE  status   (0=unavailable, 1=unknown, 2=known, 3=memorized)
 *   +0x04 UInt32BE  spellId  (item ID matching spells.json / SPELL_IDS)
 *   +0x08 UInt32BE  misc1    (sort/category ID — see note below)
 *   +0x0c UInt32BE  misc2    (always 0 in observed saves — see note below)
 *
 * Misc1 (sort/category ID):
 *   Controls spell ordering in the magic menu.  Observed values from a real
 *   save (14 spells): Soul Arrow=1, Heal=8, Antidote=7, Evacuate=5, Flame
 *   Toss=11, Fire Spray=12, Firestorm=53, Protection=31, Warding=32,
 *   Cloak=51, Hidden Soul=8, Regeneration=5, Water Veil=3, Demon's Prank=53.
 *   The tens digit groups spells by category (0x=basic/utility, 1x=fire,
 *   2x=enchantment, 3x=defensive, 5x=utility).  Miracles use low values
 *   (1-8).
 *
 *   The editor preserves misc1 from existing spells (via data attributes)
 *   and defaults new spells to 0.  Setting misc1=0 works fine in-game — the
 *   spell just appears at the top of the list instead of its natural
 *   category position.
 *
 * Misc2:
 *   Always 0 in all observed saves.  Purpose unknown.  The editor defaults
 *   new spells to 0 and preserves existing values.
 */
export const SPELL_SLOTS = 0x102e0;
export const MIRACLE_SLOTS = 0x1030c;
export const SPELL_COUNT = 0x143e8;
export const SPELL_BASE = 0x143ec; // first spell record
export const SPELL_STRIDE = 0x10;
export const SPELL_STATUS_OFFSET = 0x0; // within record
export const SPELL_ID_OFFSET = 0x4; // within record
export const SPELL_MISC1_OFFSET = 0x8; // within record
export const SPELL_MISC2_OFFSET = 0xc; // within record

/* ---- Appearance ---- */

export const HAIR_R = 0x14368;
export const HAIR_G = 0x1436c;
export const HAIR_B = 0x14370;

/* ---- Thomas Storage (Deposit) ---- */

/**
 * Items stored with Thomas in the Nexus.  Each entry is 20 bytes.
 *
 * Layout:
 *   +0x00 unknown1     UInt32BE — usually 0x00000000; non-zero (0x01, 0x02,
 *                      0x03) seen rarely
 *   +0x04 type         UInt8    — item type byte
 *   +0x05 itemId       UInt24BE — 3-byte big-endian item ID
 *   +0x08 sortOrder    UInt32BE — hi16=sortId (matches inventory misc1),
 *                      lo16=deposit order index
 *   +0x0C countLow     UInt8    - low 8 bits of stack count (10-bit total)
 *   +0x0D countFlag    UInt8    - bits 6-7 = count high 2 bits; bits 0-5 = flag (0x21 items, 0x00 empty)
 *   +0x0E pad          UInt32BE — 0x00000000 for items; 0x0000FFFF for empty
 *                      slots
 *   +0x12 durability   UInt16BE — weapon/armor max durability (e.g. 300=0x012C,
 *                      200=0x00C8)
 *
 * Type values: 0x00=weapon, 0x10=armor, 0x20=ring, 0x40=item, 0xFF=empty.
 *
 * Empty slot pattern (game-native):
 *   00 00 00 00 FF FF FF FF FF FF FF FF 00 00 00 00 FF FF FF FF
 */
export const DEPOSIT_BASE = 0x14be8;
export const DEPOSIT_STRIDE = 0x14; // 20 bytes per entry
export const DEPOSIT_MAX_ENTRIES = 2048;
export const DEPOSIT_COUNT = 0x1ebec; // UInt32BE — number of non-empty deposit entries

/* ---- Tendency ---- */

export const CHAR_TENDENCY = 0x1ebf0;
export const NEXUS_TENDENCY = 0x1ebf8;
export const NEXUS_TENDENCY_MIRROR = 0x1ebfc;
export const W1_TENDENCY = 0x1ec00;
export const W1_TENDENCY_MIRROR = 0x1ec04;
export const W2_TENDENCY = 0x1ec20;
export const W2_TENDENCY_MIRROR = 0x1ec24;
export const W3_TENDENCY = 0x1ec10;
export const W3_TENDENCY_MIRROR = 0x1ec14;
export const W4_TENDENCY = 0x1ec08;
export const W4_TENDENCY_MIRROR = 0x1ec0c;
export const W5_TENDENCY = 0x1ec18;
export const W5_TENDENCY_MIRROR = 0x1ec1c;

/* ---- Misc ---- */

export const CLEAR_COUNT = 0x1ec58;
export const ARCH_SEALED = 0x1f965; // bit 6 (0x40), inverted

/* ---- NPC flags ---- */

export const SAGE_FREKE = 0x1fd55; // bit2=friendly, bit3=hostile, bit4=dead
export const THOMAS = 0x1fd75; // bit6=friendly, bit7=hostile
export const THOMAS_DEAD = 0x1fd76; // bit0=dead
export const BOLDWIN = 0x1fd81; // bit0=friendly, bit1=hostile, bit2=dead

/* ---- Secondary file (04/104/204USER.DAT) ---- */

export const SEC_NAME_BASE = 0x21d; // + slot*0x140
export const SEC_NAME_STRIDE = 0x140;
export const SEC_WORLD = 0x24c;
