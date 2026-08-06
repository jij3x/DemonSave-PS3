/**
 * Writer: serialize a form model back into USER.DAT bytes.
 *
 * Serializes a form model back into the save file. Includes:
 *  - Dual stat writes (base + effective columns)
 *  - Vitals writes (current + base/effective max columns for HP/MP/stamina)
 *  - Equipped-slot writes + pointer resolution (write all equipped IDs;
 *    resolve pointers from the binary buffer via keep-if-unchanged /
 *    keep-if-already-correct / first-wins fallbacks)
 *  - Inventory in-place update + add/delete (patch existing items at their
 *    original _slot; clear deleted slots; place new items into empty slots)
 *  - Deposit wipe-and-rebuild (blank 2048 slots, rewrite sequentially)
 *  - Dual tendency writes (each world tendency written twice)
 *  - NPC flag read-modify-write bit masking
 *  - Secondary file name/world write (UTF-16LE name pairs)
 *
 * All integer fields are range-checked: the writer throws if a value
 * exceeds its target storage width (U8, U16, or U32) instead of silently
 * truncating via bitwise masking.
 *
 * writeSave() does NOT mutate the input buffer: it clones the input,
 * writes to the clone, and returns it.  writeSecondaryFileInPlace() DOES
 * mutate in place (it is called multiple times on the same shared secondary
 * buffer).
 */

import * as O from './offsets.js';
import {
  rInt16BE,
  rUInt32BE,
  wInt8,
  wInt32BE,
  wUInt16BE,
  wUInt32BE,
} from '../lib/ps3-save-lib/index.js';
import { assertBounds } from './bounds.js';

// ---------------------------------------------------------------------------
// Coercion + range validation helpers
// ---------------------------------------------------------------------------

/**
 * Parse a value to a number.
 *
 * Accepts numbers and numeric strings. Uses Number() for strict parsing
 * instead of parseFloat(): parseFloat silently accepts partial matches
 * like "12abc" → 12, whereas Number() rejects them as NaN. This prevents
 * malformed UI input from being silently coerced to a wrong value.
 *
 * Throws on anything else — callers (UI collectForm, mergeModel) are
 * expected to provide valid numeric input.
 * @param {number|string} x
 * @returns {number}
 */
function val(x) {
  if (typeof x === 'number') {
    if (!Number.isFinite(x)) {
      throw new Error(`val(): number is NaN or Infinity (${x})`);
    }
    return x;
  }
  if (typeof x === 'string') {
    const trimmed = x.trim();
    if (trimmed === '') {
      throw new Error('val(): empty numeric string');
    }
    const n = Number(trimmed);
    if (isNaN(n) || !Number.isFinite(n)) {
      throw new Error(`val(): invalid numeric string "${x}"`);
    }
    return n;
  }
  throw new Error(`val(): expected number or string, got ${x === null ? 'null' : typeof x}`);
}

/**
 * Validate a value fits in an unsigned 8-bit field [0, 0xFF].
 * Rejects non-integer values (e.g. 3.5) to prevent silent truncation by
 * bitwise operations in the write helpers.
 * @param {number|string} x
 * @returns {number} validated integer
 */
function assertU8(x) {
  const n = val(x);
  if (!Number.isInteger(n) || n < 0 || n > 0xff) {
    throw new Error(`Value ${n} out of range [0, 255] for U8 field`);
  }
  return n;
}

/**
 * Validate a value fits in an unsigned 16-bit field [0, 0xFFFF].
 * Rejects non-integer values (e.g. 3.5) to prevent silent truncation by
 * bitwise operations in the write helpers.
 * @param {number|string} x
 * @returns {number} validated integer
 */
function assertU16(x) {
  const n = val(x);
  if (!Number.isInteger(n) || n < 0 || n > 0xffff) {
    throw new Error(`Value ${n} out of range [0, 65535] for U16 field`);
  }
  return n;
}

/**
 * Validate a value fits in an unsigned 32-bit field [0, 0xFFFFFFFF].
 * Rejects non-integer values (e.g. 3.5) to prevent silent truncation by
 * bitwise operations in the write helpers.
 * @param {number|string} x
 * @returns {number} validated integer
 */
function assertU32(x) {
  const n = val(x);
  if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) {
    throw new Error(`Value ${n} out of range [0, 4294967295] for U32 field`);
  }
  return n;
}

// ---------------------------------------------------------------------------
// Primary save file writer
// ---------------------------------------------------------------------------

/**
 * Serialize the form model into a USER.DAT byte buffer (primary file).
 *
 * This is the in-place variant — it mutates `bytes` directly.  For the
 * cloning wrapper, use {@link writeSave} instead.
 *
 * @param {Uint8Array} bytes                    decrypted USER.DAT (mutated in place)
 * @param {import('./model.js').FullModel} m    full model (after mergeModel)
 * @param {number[]} [deletedSlots]  inventory slot numbers to clear (from
 *   mergeModel's `out.deletedSlots`).  If omitted, a full scan fallback is
 *   used (backward compat for tests that build a model manually).
 * @returns {Uint8Array} the same `bytes` reference, now with the model written
 */
export function writeSaveInPlace(bytes, m, deletedSlots) {
  // Validate buffer is large enough for this save format.
  if (!bytes || bytes.length < O.MIN_SAVE_SIZE) {
    throw new Error(
      `Save buffer too small (${bytes ? bytes.length : 0} bytes, need ≥ ${O.MIN_SAVE_SIZE})`,
    );
  }

  /* ---- World / position ---- */
  bytes[O.WORLD] = assertU8(m.world) & 0xff;
  bytes[O.BLOCK] = assertU8(m.block) & 0xff;
  bytes[0x06] = 0;
  bytes[0x07] = 0;

  // Mask to unsigned 16-bit; rInt16BE returns signed, so negative values
  // (high bit set) would sign-extend to ~4 billion via >>> 0.
  const posOffset = rInt16BE(bytes, O.POS_OFFSET_SELECTOR) & 0xffff;
  if (O.POS_TABLE_BASE + posOffset + 0x18 > bytes.length) {
    throw new Error('Unexpected data, file may be encrypted or corrupt?');
  }
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  dv.setFloat32(O.POS_TABLE_BASE + posOffset, val(m.x), false);
  dv.setFloat32(O.POS_TABLE_BASE + posOffset + 4, val(m.y), false);
  dv.setFloat32(O.POS_TABLE_BASE + posOffset + 8, val(m.z), false);
  dv.setFloat32(O.POS_TABLE_BASE + posOffset + 0x14, val(m.rot), false);

  /* ---- Stats (base + effective) ---- */
  // Stats are stored as signed Int32BE, but the game never uses negative
  // values — validate as U32 for a cleaner contract.
  const vit = assertU32(m.vit);
  wInt32BE(bytes, O.VIT_BASE, vit);
  wInt32BE(bytes, O.VIT, vit);
  const int2 = assertU32(m.int);
  wInt32BE(bytes, O.INT_BASE, int2);
  wInt32BE(bytes, O.INT, int2);
  const end = assertU32(m.end);
  wInt32BE(bytes, O.END_BASE, end);
  wInt32BE(bytes, O.END, end);
  const str = assertU32(m.str);
  wInt32BE(bytes, O.STR_BASE, str);
  wInt32BE(bytes, O.STR, str);
  const dex = assertU32(m.dex);
  wInt32BE(bytes, O.DEX_BASE, dex);
  wInt32BE(bytes, O.DEX, dex);
  const magic = assertU32(m.magic);
  wInt32BE(bytes, O.MAGIC_BASE, magic);
  wInt32BE(bytes, O.MAGIC, magic);
  const faith = assertU32(m.faith);
  wInt32BE(bytes, O.FAITH_BASE, faith);
  wInt32BE(bytes, O.FAITH, faith);
  const luck = assertU32(m.luck);
  wInt32BE(bytes, O.LUCK_BASE, luck);
  wInt32BE(bytes, O.LUCK, luck);

  wInt32BE(bytes, O.SOULS, assertU32(m.souls));
  wInt32BE(bytes, O.SOUL_MEMORY, assertU32(m.soulMem));
  wInt32BE(bytes, O.LEVELS_PURCHASED, assertU32(m.levelsPurchased));

  /* ---- Vitals (current + base/effective max columns) ---- */
  wInt32BE(bytes, O.CURR_HP, assertU32(m.currHP));
  wInt32BE(bytes, O.CURR_MAX_HP, assertU32(m.currMaxHP));
  wInt32BE(bytes, O.MAX_HP, assertU32(m.maxHP));
  wInt32BE(bytes, O.CURR_MP, assertU32(m.currMP));
  wInt32BE(bytes, O.CURR_MAX_MP, assertU32(m.currMaxMP));
  wInt32BE(bytes, O.MAX_MP, assertU32(m.maxMP));
  wInt32BE(bytes, O.CURR_STAM, assertU32(m.currStam));
  wInt32BE(bytes, O.CURR_MAX_STAM, assertU32(m.currMaxStam));
  wInt32BE(bytes, O.MAX_STAM, assertU32(m.maxStam));

  /* ---- Identity ---- */
  bytes[O.PHANTOM_TYPE] = assertU8(m.phantomType) & 0xff;
  writeName(bytes, m.name);

  bytes[O.GENDER] = assertU8(m.gender) & 0xff;
  bytes[O.START_CLASS] = assertU8(m.startClass) & 0xff;

  /* ---- Inventory: build allItems (before slot placement) ----
   *
   * allItems is the merged list of all inventory records across categories.
   * New items (_slot undefined) get their idx1/idx2 assigned later,
   * AFTER they are placed into physical slots — because idx1 must equal
   * the slot number (the game's invariant, confirmed from real saves).
   */
  const TYPE_BYTES = {
    weapons: 0x00000000,
    armor: 0x10000000,
    rings: 0x20000000,
    goods: 0x40000000,
  };
  const allItems = [
    ...(m.weapons || []).map((r) => ({ rec: { ...r }, type: TYPE_BYTES.weapons, cat: 'weapons' })),
    ...(m.armor || []).map((r) => ({ rec: { ...r }, type: TYPE_BYTES.armor, cat: 'armor' })),
    ...(m.rings || []).map((r) => ({ rec: { ...r }, type: TYPE_BYTES.rings, cat: 'rings' })),
    ...(m.goods || []).map((r) => ({ rec: { ...r }, type: TYPE_BYTES.goods, cat: 'goods' })),
  ];

  /* ---- Inventory: in-place update + add/delete ----
   *
   * Surgical slot management instead of blank-and-rewrite:
   *
   * 1. Update existing items at their original _slot positions.
   * 2. Clear deleted items (slots that were occupied but are no longer in
   *    the model) by setting their Type field to 0xFFFFFFFF.
   * 3. Place new items (no _slot) into the first available empty slot
   *    (Type = 0xFFFFFFFF), writing the correct type byte.
   * 4. Update INV_COUNT and INV_COUNT_MIRROR to reflect the new total.
   *
   * NOTE: allItems and TYPE_BYTES are already built above.  idx1/idx2
   * for new items are assigned during placement below (idx1 = slot number).
   */

  // Track which slots the model still uses (for deletion detection)
  const modelSlots = new Set();

  /**
   * Write a single inventory record's fields at the given base offset.
   * All fields are range-validated per their byte widths.
   */
  const writeInvFields = (b, rec, type) => {
    wUInt32BE(bytes, b + 0, type); // Type (not user data)
    wUInt32BE(bytes, b + 4, assertU32(rec.itemId)); // ItemID (U32)
    wUInt32BE(bytes, b + 8, assertU32(rec.count)); // Count (U32)
    // idx1 is semantically a 16-bit index into a 2048-entry table.
    // Validate as U16 here (matching writeDurability) to prevent partial
    // writes where the inventory record succeeds but the durability write
    // throws for the same idx1 value.
    wUInt32BE(bytes, b + 0x0c, assertU16(rec.idx1)); // Idx1 (validated as U16 to match durability table width)
    wUInt16BE(bytes, b + 0x10, assertU16(rec.misc1)); // Misc1/sortId (U16)
    wUInt16BE(bytes, b + 0x12, assertU16(rec.idx2)); // Idx2 (U16)
    wUInt32BE(bytes, b + 0x14, assertU32(rec.misc2)); // Misc2 (U32)
  };

  /**
   * Write durability for a weapon/armor inventory item into the parallel
   * durability table.  Bounds-checked: throws if idx1 produces an offset
   * outside the buffer (prevents silent OOB no-ops from corrupt or
   * user-entered idx1 values).
   */
  const writeDurability = (rec) => {
    const idx1 = assertU16(rec.idx1) & 0xffff;
    const durOffset = O.DURABILITY_BASE + idx1 * 8;
    if (durOffset + 4 > bytes.length) {
      throw new Error(
        `Inventory durability write out of bounds: idx1=${idx1}, offset=0x${durOffset.toString(16)}, buffer=${bytes.length}`,
      );
    }
    wUInt32BE(bytes, durOffset, assertU32(rec.durability));
  };

  // Update existing items in-place at their original _slot positions.
  // A valid _slot is a non-negative integer; anything else (undefined,
  // null, NaN) means the item is new and is placed later.
  for (const { rec, type, cat } of allItems) {
    if (typeof rec._slot !== 'number' || !Number.isInteger(rec._slot) || rec._slot < 0) continue;
    modelSlots.add(rec._slot);

    const b = O.INV_TYPE_BASE + rec._slot * O.INV_STRIDE;
    if (b + O.INV_STRIDE > bytes.length) {
      throw new Error(`Inventory slot ${rec._slot} is out of bounds (corrupt save data)`);
    }

    writeInvFields(b, rec, type);

    // Durability (for weapons and armor)
    if (cat === 'weapons' || cat === 'armor') {
      writeDurability(rec);
    }
  }

  // Clear deleted slots (occupied on disk but not in the model).
  //
  // Pre-computed 32-byte empty inventory template (all 0xFF).
  // Clearing the full record ensures no residual data leaks from deleted
  // items.
  const EMPTY_INV = new Uint8Array(O.INV_STRIDE).fill(0xff);

  /**
   * Clear the durability table entry for a deleted inventory slot.
   * Reads the slot's original idx1 from the buffer BEFORE the record is
   * cleared, then zeros the parallel durability entry so no stale data
   * persists for orphaned idx1 values.
   */
  const clearDurabilityForSlot = (slotBase) => {
    const oldIdx1 = rUInt32BE(bytes, slotBase + 0x0c) & 0xffff;
    if (oldIdx1 < O.INV_SLOTS) {
      const durOffset = O.DURABILITY_BASE + oldIdx1 * 8;
      if (durOffset + 4 <= bytes.length) {
        wUInt32BE(bytes, durOffset, 0);
      }
    }
  };

  // deletedSlots is passed as a parameter (from mergeModel's `out` bag).
  // This reduces the scan from O(2048) reads to O(deleted count).
  if (Array.isArray(deletedSlots)) {
    for (const slot of deletedSlots) {
      if (modelSlots.has(slot)) continue; // safety: shouldn't happen
      const b = O.INV_TYPE_BASE + slot * O.INV_STRIDE;
      if (b + O.INV_STRIDE > bytes.length) continue;
      const diskType = rUInt32BE(bytes, b);
      if (diskType !== 0xffffffff) {
        // Clear durability before wiping the record (idx1 is needed to
        // locate the durability table slot).
        clearDurabilityForSlot(b);
        // Clear all 32 bytes, not just the Type field.
        bytes.set(EMPTY_INV, b);
      }
    }
  } else {
    // Fallback: full scan (backward compat for direct writeSave calls without
    // mergeModel, e.g. tests that build a model manually).
    for (let slot = 0; slot < O.INV_SLOTS; slot++) {
      if (modelSlots.has(slot)) continue;
      const b = O.INV_TYPE_BASE + slot * O.INV_STRIDE;
      if (b + O.INV_STRIDE > bytes.length) break;
      const diskType = rUInt32BE(bytes, b);
      if (diskType !== 0xffffffff) {
        // Clear durability before wiping the record (idx1 is needed to
        // locate the durability table slot).
        clearDurabilityForSlot(b);
        // Clear all 32 bytes, not just the Type field.
        bytes.set(EMPTY_INV, b);
      }
    }
  }

  // Place new items (no _slot) into empty slots.
  //
  // Uses a nextFreeSlot pointer that only advances forward — slots before
  // it are either occupied by existing items or cleared, so we never need
  // to re-scan them. This makes the scan O(INV_SLOTS) total regardless of
  // how many new items are added, instead of O(N × INV_SLOTS).
  //
  // idx1/idx2 assignment: the game's invariant is idx1 == idx2 == slot
  // number. Every inventory item uses its physical slot position as its
  // idx1. This is critical for equipped-slot pointer resolution — the
  // game's hotbar pointers reference inventory rows by idx1, and idx1
  // must match the slot for the equipped mark to display correctly.
  let nextFreeSlot = 0;
  for (const { rec, type, cat } of allItems) {
    if (typeof rec._slot === 'number' && Number.isInteger(rec._slot) && rec._slot >= 0) continue;

    // Find the next empty slot starting from nextFreeSlot
    let placed = false;
    for (; nextFreeSlot < O.INV_SLOTS; nextFreeSlot++) {
      const b = O.INV_TYPE_BASE + nextFreeSlot * O.INV_STRIDE;
      if (b + O.INV_STRIDE > bytes.length) break;
      if (rUInt32BE(bytes, b) === 0xffffffff) {
        // Assign idx1/idx2 = slot number (the game's invariant).
        rec.idx1 = nextFreeSlot;
        rec.idx2 = nextFreeSlot;
        // Write the new item here
        writeInvFields(b, rec, type);
        if (cat === 'weapons' || cat === 'armor') {
          writeDurability(rec);
        }
        modelSlots.add(nextFreeSlot);
        nextFreeSlot++; // advance past this slot for the next item
        placed = true;
        break;
      }
    }
    if (!placed) {
      throw new Error('Inventory is full — cannot add new item (all slots occupied)');
    }
  }

  // Update INV_COUNT and INV_COUNT_MIRROR
  const invCount = modelSlots.size;
  wUInt32BE(bytes, O.INV_COUNT, invCount);
  wUInt32BE(bytes, O.INV_COUNT_MIRROR, invCount);

  /* ---- Equipped slots (item IDs + pointer resolution) ----
   *
   * This runs AFTER inventory placement so that newly added items have
   * their idx1 assigned (= slot number) and are visible in the pointer
   * lookup maps.
   *
   * Pointer resolution reads from the binary buffer only — never from
   * display-only model data.  Three-tier fallback:
   *
   *   0. ID unchanged (newId == oldId on disk):
   *        Keep the existing pointer verbatim.
   *
   *   1. Current pointer already resolves to the desired item:
   *        If the on-disk pointer's idx1 maps to an inventory row whose
   *        itemId == newId, keep it.
   *
   *   2. First-wins fallback:
   *        Pick the first inventory row matching newId.
   *
   *   - 0xFFFFFFFF (empty slot):  write 0xFFFFFFFF to the pointer.
   *   - ID not in inventory (foreign): leave pointer untouched.
   *
   * HAIRSTYLE has no pointer; RESERVED (0x260) is padding, never touched.
   */
  // Build pointer lookup maps from allItems (all items now have idx1).
  const idxByItemId = new Map(); // itemId  → first idx1 (Rule 2 fallback)
  const itemIdByIdx1 = new Map(); // idx1    → itemId    (Rules 0 & 1)
  for (const { rec: r } of allItems) {
    const idx1 = r.idx1;
    if (typeof idx1 === 'number') {
      const id = assertU32(r.itemId) >>> 0;
      if (!idxByItemId.has(id)) idxByItemId.set(id, idx1 & 0xffff);
      itemIdByIdx1.set(idx1 & 0xffff, id);
    }
  }

  /**
   * Write one equipped slot: the item ID + resolved pointer.
   *
   * Pointer resolution reads from the binary buffer — never from
   * display-only model data.
   *
   * @param {number} idOffset   byte offset for the item ID
   * @param {number|null} ptrOffset  byte offset for the pointer (null = hairstyle)
   * @param {number} rawId      new item ID from the model
   */
  const writeEquipped = (idOffset, ptrOffset, rawId) => {
    const newId = assertU32(rawId) >>> 0;

    // Hairstyle has no pointer — just write the ID.
    if (ptrOffset === null) {
      wUInt32BE(bytes, idOffset, newId);
      return;
    }

    // Read current on-disk values BEFORE writing (for fallback rules).
    const oldId = rUInt32BE(bytes, idOffset);
    const oldPtr = rUInt32BE(bytes, ptrOffset);

    // Always write the new item ID.
    wUInt32BE(bytes, idOffset, newId);

    // Empty slot → clear pointer.
    if (newId === 0xffffffff) {
      wUInt32BE(bytes, ptrOffset, 0xffffffff);
      return;
    }

    // Rule 0: ID unchanged → preserve game's binding (no-op).
    if (newId === oldId) return;

    // Rule 1: current pointer already points at the desired item.
    if (oldPtr !== 0xffffffff && itemIdByIdx1.get(oldPtr & 0xffff) === newId) {
      return; // keep pointer
    }

    // Rule 2: first-wins fallback.
    const idx1 = idxByItemId.get(newId);
    if (idx1 !== undefined) {
      wUInt32BE(bytes, ptrOffset, idx1);
    }
    // else: foreign ID not in inventory — leave pointer unchanged.
  };

  // Hands / projectiles
  writeEquipped(O.LH1, O.LH1_PTR, m.leftHand1);
  writeEquipped(O.RH1, O.RH1_PTR, m.rightHand1);
  writeEquipped(O.LH2, O.LH2_PTR, m.leftHand2);
  writeEquipped(O.RH2, O.RH2_PTR, m.rightHand2);
  writeEquipped(O.ARROWS, O.ARROW_PTR, m.arrows);
  writeEquipped(O.BOLTS, O.BOLT_PTR, m.bolts);
  // Armor
  writeEquipped(O.HELMET, O.HELMET_PTR, m.helmet);
  writeEquipped(O.CHEST, O.CHEST_PTR, m.chest);
  writeEquipped(O.GAUNTLETS, O.GAUNTLETS_PTR, m.gauntlets);
  writeEquipped(O.LEGGINGS, O.LEGGINGS_PTR, m.leggings);
  // Hairstyle — no pointer
  writeEquipped(O.HAIRSTYLE, null, m.hairstyle);
  // Rings
  writeEquipped(O.RING1, O.RING1_PTR, m.ring1);
  writeEquipped(O.RING2, O.RING2_PTR, m.ring2);
  // Quick slots (goods hotbar)
  writeEquipped(O.QUICK1, O.QUICK1_PTR, m.quickSlot1);
  writeEquipped(O.QUICK2, O.QUICK2_PTR, m.quickSlot2);
  writeEquipped(O.QUICK3, O.QUICK3_PTR, m.quickSlot3);
  writeEquipped(O.QUICK4, O.QUICK4_PTR, m.quickSlot4);
  writeEquipped(O.QUICK5, O.QUICK5_PTR, m.quickSlot5);

  /* ---- Spells ---- */
  wUInt32BE(bytes, O.SPELL_SLOTS, assertU32(m.spellSlots));
  wUInt32BE(bytes, O.MIRACLE_SLOTS, assertU32(m.miracleSlots));

  // Spell status is always numeric (reader produces numbers, UI reads from
  // a <select> with numeric values).  Non-numeric values are caught by
  // assertU32 → val() → Number() → NaN → throw.
  // Read the old spell count BEFORE overwriting it, so we can clear stale
  // records after the write loop (see below).
  const oldSpellCount = rUInt32BE(bytes, O.SPELL_COUNT);
  wUInt32BE(bytes, O.SPELL_COUNT, m.spells.length);
  for (let i = 0; i < m.spells.length; i++) {
    const sp = m.spells[i];
    const b = O.SPELL_BASE + i * O.SPELL_STRIDE;
    // Bounds-check: ensure this spell record fits within the buffer
    if (b + O.SPELL_STRIDE > bytes.length) {
      throw new Error(`Spell slot ${i} is out of bounds (too many spells for this save format)`);
    }
    wUInt32BE(bytes, b + O.SPELL_STATUS_OFFSET, assertU32(sp.status));
    wUInt32BE(bytes, b + O.SPELL_ID_OFFSET, assertU32(sp.itemId));
    wUInt32BE(bytes, b + O.SPELL_MISC1_OFFSET, assertU32(sp.misc1));
    wUInt32BE(bytes, b + O.SPELL_MISC2_OFFSET, assertU32(sp.misc2));
  }

  // Clear stale spell records beyond the new SPELL_COUNT so no old data
  // lingers in the buffer.
  if (oldSpellCount > m.spells.length) {
    const EMPTY_SPELL = new Uint8Array(O.SPELL_STRIDE); // all zeros
    for (let i = m.spells.length; i < oldSpellCount; i++) {
      const b = O.SPELL_BASE + i * O.SPELL_STRIDE;
      if (b + O.SPELL_STRIDE > bytes.length) break;
      bytes.set(EMPTY_SPELL, b);
    }
  }

  /* ---- Thomas Storage (Deposit) ----
   *
   * Empty-slot pattern matches the game-native format exactly:
   *   00 00 00 00 FF FF FF FF FF FF FF FF 00 00 00 00 FF FF FF FF
   *
   * Deposit entry layout (0x14 = 20 bytes):
   *   +0x00 unknown1     UInt32BE — preserved from original
   *   +0x04 type         UInt8    — 0x00=WPN, 0x10=ARM, 0x20=RNG, 0x40=GDS
   *   +0x05 itemId       UInt24BE — 3-byte item ID
   *   +0x08 sortIdDurPack UInt32BE — hi16=sortId, lo16=order index
   *   +0x0C count        UInt8    — stack count
   *   +0x0D flag         UInt8    — 0x21 for items, 0x00 for empty
   *   +0x0E pad          UInt32BE — 0x00000000 for items; 0x0000FFFF for empty slots
   *   +0x12 durability   UInt16BE — weapon/armor max durability
   */
  // Pre-computed empty-slot template for the blanking phase.
  const EMPTY_DEPOSIT = new Uint8Array([
    0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x00,
    0xff, 0xff, 0xff, 0xff,
  ]);
  for (let i = 0; i < O.DEPOSIT_MAX_ENTRIES; i++) {
    const b = O.DEPOSIT_BASE + i * O.DEPOSIT_STRIDE;
    // Bounds-check each deposit entry blank.
    assertBounds(bytes, b, O.DEPOSIT_STRIDE);
    bytes.set(EMPTY_DEPOSIT, b);
  }

  {
    const depositCount = (m.deposit || []).length;
    if (depositCount > O.DEPOSIT_MAX_ENTRIES) {
      throw new Error(
        `Deposit is full — cannot write ${depositCount} items (max ${O.DEPOSIT_MAX_ENTRIES})`,
      );
    }
    let slot = 0;
    for (const rec of m.deposit || []) {
      const b = O.DEPOSIT_BASE + slot * O.DEPOSIT_STRIDE;

      let typeByte;
      switch (rec.category) {
        case 'weapons':
          typeByte = 0x00;
          break;
        case 'armor':
          typeByte = 0x10;
          break;
        case 'rings':
          typeByte = 0x20;
          break;
        case 'goods':
          typeByte = 0x40;
          break;
        default:
          throw new Error(`Unknown deposit category: "${rec.category}"`);
      }
      // Deposit itemId is UInt24BE (3 bytes, max 0xFFFFFF). Validate
      // explicitly to prevent silent bit truncation in the byte-splitting
      // below for values above 0xFFFFFF.
      const itemId = assertU32(rec.itemId);
      if (itemId > 0xffffff) {
        throw new Error(`Deposit itemId ${itemId} exceeds 24-bit limit (0xFFFFFF)`);
      }

      // sortIdDurPack: hi16=sortId, lo16=deposit order index.
      // Preserve the original lo16 when non-zero (carries meaningful deposit
      // order data); fall back to the sequential slot index for new items.
      const sortId = (rec.sortOrder >> 16) & 0xffff;
      const origOrderIdx = rec.sortOrder & 0xffff;
      const orderIdx = origOrderIdx !== 0 ? origOrderIdx : slot & 0xffff;
      const sortIdDurPack = ((sortId << 16) | orderIdx) >>> 0;

      // Determine flag byte (low 6 bits): 0x21 for items, preserve existing
      // non-zero values.  The high 2 bits (bits 6-7) are used for the deposit
      // count overflow (bits 8-9 of the 10-bit count).
      let flagLow = 0x21;
      if (Array.isArray(rec.flags) && rec.flags[0] !== 0) {
        flagLow = rec.flags[0] & 0x3f;
      }

      // Deposit count is a 10-bit value: bits 0-7 in byte[b+12],
      // bits 8-9 merged into the high 2 bits of the flag byte (byte[b+13]).
      // Validate as a 10-bit value [0, 1023] — the UI caps at 999.
      const depositCountVal = val(rec.count);
      if (!Number.isInteger(depositCountVal) || depositCountVal < 0 || depositCountVal > 0x3ff) {
        throw new Error(`Deposit count ${depositCountVal} out of range [0, 1023] (10-bit field)`);
      }
      const countLow = depositCountVal & 0xff;
      const countHigh = (depositCountVal >> 8) & 0x03;
      const flagByte = (flagLow & 0x3f) | (countHigh << 6);

      // Determine durability for weapons/armor.
      // No silent defaults — if no value is provided anywhere, throw.
      let durability;
      if (rec.category === 'weapons' || rec.category === 'armor') {
        // Tier 1: named field from the model (UI-editable, includes 0)
        if (rec.durability !== undefined && rec.durability !== null) {
          durability = assertU16(rec.durability);
        }
        // Tier 2: flags[5..6] for legacy records that lack the named field.
        // This is preserved binary data, not user input — treat 0 as "no data".
        if (durability === undefined && Array.isArray(rec.flags) && rec.flags.length >= 7) {
          const dur2 = ((rec.flags[5] & 0xff) << 8) | (rec.flags[6] & 0xff);
          if (dur2) durability = dur2;
        }
        // No Tier 3 default — throw if still no value.
        if (durability === undefined) {
          throw new Error(`Deposit ${rec.category} item missing durability`);
        }
      }

      wUInt32BE(bytes, b, rec.unknown1 ?? 0);
      bytes[b + 4] = typeByte;
      bytes[b + 5] = (itemId >> 16) & 0xff;
      bytes[b + 6] = (itemId >> 8) & 0xff;
      bytes[b + 7] = itemId & 0xff;
      wUInt32BE(bytes, b + 8, sortIdDurPack);
      bytes[b + 12] = countLow;
      bytes[b + 13] = flagByte;
      // Preserve pad bytes (flags[1..4]) from the original record instead
      // of hardcoding zeros. In observed saves these are always 0x00 for items,
      // but preserving them ensures write-back fidelity for any edge case.
      bytes[b + 14] = Array.isArray(rec.flags) ? rec.flags[1] & 0xff : 0x00;
      bytes[b + 15] = Array.isArray(rec.flags) ? rec.flags[2] & 0xff : 0x00;
      bytes[b + 16] = Array.isArray(rec.flags) ? rec.flags[3] & 0xff : 0x00;
      bytes[b + 17] = Array.isArray(rec.flags) ? rec.flags[4] & 0xff : 0x00;
      wUInt16BE(bytes, b + 0x12, durability ?? 0);
      slot++;
    }

    wUInt32BE(bytes, O.DEPOSIT_COUNT, slot);
  }

  /* ---- Hair color ---- */
  dv.setFloat32(O.HAIR_R, val(m.hairR), false);
  dv.setFloat32(O.HAIR_G, val(m.hairG), false);
  dv.setFloat32(O.HAIR_B, val(m.hairB), false);

  /* ---- Tendency (dual writes) ---- */
  dv.setFloat32(O.CHAR_TENDENCY, val(m.charTendency), false);
  const nexus = val(m.nexusTendency);
  dv.setFloat32(O.NEXUS_TENDENCY, nexus, false);
  dv.setFloat32(O.NEXUS_TENDENCY_MIRROR, nexus, false);
  // Tendency writes in sequential order (w1→w5).
  const w1 = val(m.w1Tendency);
  dv.setFloat32(O.W1_TENDENCY, w1, false);
  dv.setFloat32(O.W1_TENDENCY_MIRROR, w1, false);
  const w2 = val(m.w2Tendency);
  dv.setFloat32(O.W2_TENDENCY, w2, false);
  dv.setFloat32(O.W2_TENDENCY_MIRROR, w2, false);
  const w3 = val(m.w3Tendency);
  dv.setFloat32(O.W3_TENDENCY, w3, false);
  dv.setFloat32(O.W3_TENDENCY_MIRROR, w3, false);
  const w4 = val(m.w4Tendency);
  dv.setFloat32(O.W4_TENDENCY, w4, false);
  dv.setFloat32(O.W4_TENDENCY_MIRROR, w4, false);
  const w5 = val(m.w5Tendency);
  dv.setFloat32(O.W5_TENDENCY, w5, false);
  dv.setFloat32(O.W5_TENDENCY_MIRROR, w5, false);

  /* ---- Misc ---- */
  bytes[O.CLEAR_COUNT] = assertU8(m.clearCount) & 0xff;

  bytes[O.ARCH_SEALED] = (bytes[O.ARCH_SEALED] & 0xbf) | (0x40 * (m.archSealed ? 0 : 1));

  /* ---- NPC flags (read-modify-write bit masking) ---- */
  bytes[O.SAGE_FREKE] = (bytes[O.SAGE_FREKE] & 0xfb) | (0x04 * (m.sageFreke.friendly ? 1 : 0));
  bytes[O.SAGE_FREKE] = (bytes[O.SAGE_FREKE] & 0xf7) | (0x08 * (m.sageFreke.hostile ? 1 : 0));
  bytes[O.SAGE_FREKE] = (bytes[O.SAGE_FREKE] & 0xef) | (0x10 * (m.sageFreke.dead ? 1 : 0));

  bytes[O.THOMAS] = (bytes[O.THOMAS] & 0xbf) | (0x40 * (m.thomas.friendly ? 1 : 0));
  bytes[O.THOMAS] = (bytes[O.THOMAS] & 0x7f) | (0x80 * (m.thomas.hostile ? 1 : 0));
  bytes[O.THOMAS_DEAD] = (bytes[O.THOMAS_DEAD] & 0xfe) | (0x01 * (m.thomas.dead ? 1 : 0));

  bytes[O.BOLDWIN] = (bytes[O.BOLDWIN] & 0xfe) | (0x01 * (m.boldwin.friendly ? 1 : 0));
  bytes[O.BOLDWIN] = (bytes[O.BOLDWIN] & 0xfd) | (0x02 * (m.boldwin.hostile ? 1 : 0));
  bytes[O.BOLDWIN] = (bytes[O.BOLDWIN] & 0xfb) | (0x04 * (m.boldwin.dead ? 1 : 0));

  // Return the mutated buffer (same reference passed in).
  return bytes;
}

/**
 * Serialize the form model into a new USER.DAT byte buffer (primary file).
 *
 * This is the cloning wrapper around {@link writeSaveInPlace}.  It clones
 * the input buffer, writes to the clone, and returns it.  The caller's
 * original buffer is never mutated.
 *
 * For internal callers that own their buffer and don't need the clone
 * (e.g. `decryptAndMergeSlots` in save-api.js), use `writeSaveInPlace`
 * directly to avoid the unnecessary ~512 KB allocation + copy.
 *
 * @param {Uint8Array} inputBytes               decrypted USER.DAT (left untouched)
 * @param {import('./model.js').FullModel} m    full model (after mergeModel)
 * @param {number[]} [deletedSlots]  inventory slot numbers to clear
 * @returns {Uint8Array} new buffer with the model written
 */
export function writeSave(inputBytes, m, deletedSlots) {
  if (!inputBytes) {
    throw new Error(
      `Save buffer too small (${inputBytes ? inputBytes.length : 0} bytes, need ≥ ${O.MIN_SAVE_SIZE})`,
    );
  }
  const bytes = inputBytes.slice();
  return writeSaveInPlace(bytes, m, deletedSlots);
}

// writeProfileNumber() is in ps3/param-sfo.js (the canonical location for SFO operations)

// ---------------------------------------------------------------------------
// Name writer (shared by primary + secondary files)
// ---------------------------------------------------------------------------

/** Maximum number of characters in a character name (16 chars = 32 bytes). */
const MAX_NAME_CHARS = 0x10;

/**
 * Write a character name as UTF-16LE character pairs at the given offset.
 *
 * Each character occupies 2 bytes in a UTF-16LE-like layout: low byte
 * first, then high byte. This supports full Unicode BMP characters
 * (including CJK, Cyrillic, etc.), not just Latin1. Character data
 * starts directly at `baseOffset` — there is NO length-prefix byte.
 *
 * The loop always writes all 16 character pairs (32 bytes), zero-filling
 * unused slots so no stale data from a previous name lingers.
 *
 * Validates:
 *   - Max 16 characters (the loop's hard limit — 16 UTF-16 code units).
 *
 * @param {Uint8Array} bytes  buffer (mutated in place)
 * @param {number} baseOffset  offset of the first character's data
 * @param {string} name
 */
function writeRUniStrName(bytes, baseOffset, name) {
  const nameStr = String(name || '');
  if (nameStr.length > MAX_NAME_CHARS) {
    throw new Error(`Name "${nameStr}" exceeds ${MAX_NAME_CHARS} characters`);
  }
  // Loop writes 16 character pairs (i=0..15), each 2 bytes (UTF-16LE-like).
  for (let i = 0; i < MAX_NAME_CHARS; i++) {
    if (i < nameStr.length) {
      const cc = nameStr.charCodeAt(i);
      // Write both bytes of each UTF-16 code unit. This naturally handles
      // surrogate pairs (each half is a separate code unit ≤ 0xFFFF,
      // stored as its own 2-byte pair). charCodeAt never returns > 0xFFFF.
      // Low byte of each character pair.
      bytes[baseOffset + i * 2] = cc & 0xff;
      // High byte of each character pair.
      bytes[baseOffset + i * 2 + 1] = (cc >> 8) & 0xff;
    } else {
      bytes[baseOffset + i * 2] = 0;
      bytes[baseOffset + i * 2 + 1] = 0;
    }
  }
}

/**
 * Write a character name into the primary USER.DAT name field.
 *
 * The name data occupies bytes 0xD5..0xF4 as 16 UTF-16LE character pairs
 * (32 bytes).  Byte 0xD4 (just before the data) is explicitly zeroed so
 * that when the game reads the name as UTF-16BE starting from 0xD4, the
 * first pair [0x00, char0] decodes correctly.  There is no length-prefix
 * byte — unused character slots are zero-filled.
 *
 * @param {Uint8Array} bytes  primary USER.DAT buffer (mutated in place)
 * @param {string} name
 */
function writeName(bytes, name) {
  // Zero the byte just before the name data so the game's UTF-16BE read
  // from 0xD4 sees [0x00, char0] for the first character pair.
  bytes[O.NAME] = 0;
  writeRUniStrName(bytes, O.NAME + 1, name);
}

// ---------------------------------------------------------------------------
// Secondary file writer
// ---------------------------------------------------------------------------

/**
 * Write the character name + world into the secondary file (04/104/204USER.DAT).
 *
 * The secondary file name field stores 16 UTF-16LE character pairs (32 bytes)
 * per slot at `SEC_NAME_BASE + slot * SEC_NAME_STRIDE`.  No length-prefix
 * byte — unused slots are zero-filled.
 *
 * NOTE: This function mutates the buffer in place. It is called multiple
 * times on the same shared secondary-file buffer (once per slot), so it
 * cannot clone like writeSave() does.
 *
 * @param {Uint8Array} bytes  secondary file bytes (mutated in place)
 * @param {string} name
 * @param {number} slot  save slot index (0-based, = nmbSaveNum - 1)
 * @param {number} world
 */
export function writeSecondaryFileInPlace(bytes, name, slot, world) {
  // Bounds-check: verify both the name (32 bytes) and world (1 byte)
  // offsets fit within the buffer.  Without this, JavaScript silently
  // no-ops on out-of-bounds TypedArray index assignment, producing a
  // corrupt secondary file with no error.
  const nameOffset = O.SEC_NAME_BASE + slot * O.SEC_NAME_STRIDE;
  const worldOffset = O.SEC_WORLD + slot * O.SEC_NAME_STRIDE;
  const nameEnd = nameOffset + MAX_NAME_CHARS * 2; // 16 chars × 2 bytes
  if (nameEnd > bytes.length || worldOffset >= bytes.length) {
    throw new Error(
      `Secondary file write out of bounds: slot=${slot}, nameEnd=0x${nameEnd.toString(16)}, worldOffset=0x${worldOffset.toString(16)}, buffer=${bytes.length}`,
    );
  }

  // Write name as UTF-16LE character pairs (no length prefix).
  writeRUniStrName(bytes, nameOffset, name);

  // World is per-slot, same stride as the name region.
  wInt8(bytes, worldOffset, assertU8(world) & 0xff);
}
