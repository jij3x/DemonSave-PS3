/**
 * Reader: parse a DeS USER.DAT byte buffer into a structured form model.
 *
 * Parses the binary save data field-by-field using the known offset map.
 */

import * as O from './offsets.js';
import {
  rInt16BE,
  rInt32BE,
  rUInt16BE,
  rUInt32BE,
  rSingleBE,
  rUniStr,
  oneByteAnd,
} from '../lib/ps3-save-lib/index.js';
import { assertBounds, assertBelow } from './bounds.js';

/**
 * Parse the primary USER.DAT into a form model.
 * @param {Uint8Array} bytes
 * @returns {import('./model.js').FullModel} full model with all binary internals
 */
export function readSave(bytes) {
  // Top-level buffer-size guard. Ensures all fixed offsets used below are
  // in-bounds, preventing silent zero-reads on truncated/corrupt/partial files.
  if (!bytes || bytes.length < O.MIN_SAVE_SIZE) {
    throw new Error(
      `Save buffer too small (${bytes ? bytes.length : 0} bytes, need ≥ ${O.MIN_SAVE_SIZE})`,
    );
  }

  if (rInt32BE(bytes, O.SANITY_CHECK) === 0) {
    throw new Error('Unexpected zeroes, character deleted or false positive?');
  }

  // Early encrypted/corrupt data detection.
  //
  // When a save folder has been partially decrypted (PARAM.PFD removed but
  // some USER.DAT files still encrypted), the encrypted ciphertext will be
  // treated as plaintext. Random ciphertext at key offsets produces
  // implausibly large values that would cause runaway loops (e.g. an inventory
  // count of ~2.8 billion). Catch this early with a clear error message
  // before any heavy parsing begins.
  {
    // Use invCount and spellCount as the primary corrupt-data indicators.
    // World byte alone is unreliable — some valid saves use world=0xFF
    // (e.g. character in a special/menu state).
    const _invCount = rUInt32BE(bytes, O.INV_COUNT);
    const _spellCount = rUInt32BE(bytes, O.SPELL_COUNT);
    if (_invCount > O.INV_SLOTS || _spellCount > 0x200) {
      throw new Error('Unexpected data, file may be encrypted or corrupt?');
    }
  }

  const m = /** @type {Partial<import('./model.js').FullModel>} */ ({});

  /* ---- World / position ---- */
  m.world = bytes[O.WORLD];
  m.block = bytes[O.BLOCK];

  // Mask to unsigned 16-bit; rInt16BE returns signed, so negative values
  // (high bit set) would sign-extend to ~4 billion via >>> 0.
  const posOffset = rInt16BE(bytes, O.POS_OFFSET_SELECTOR) & 0xffff;
  if (O.POS_TABLE_BASE + posOffset + 0x18 > bytes.length) {
    throw new Error('Unexpected data, file may be encrypted or corrupt?');
  }
  m.x = rSingleBE(bytes, O.POS_TABLE_BASE + posOffset);
  m.y = rSingleBE(bytes, O.POS_TABLE_BASE + posOffset + 4);
  m.z = rSingleBE(bytes, O.POS_TABLE_BASE + posOffset + 8);
  m.rot = rSingleBE(bytes, O.POS_TABLE_BASE + posOffset + 0x14);

  /* ---- Vitals ---- */
  // Read as unsigned: these fields are semantically unsigned (HP/MP/Stamina
  // are never negative).  The writer validates them with assertU32, so using
  // rUInt32BE here keeps the contract consistent and avoids sign-extension
  // surprises on values > 0x7FFFFFFF (which would otherwise become negative).
  m.currHP = rUInt32BE(bytes, O.CURR_HP);
  m.currMaxHP = rUInt32BE(bytes, O.CURR_MAX_HP);
  m.maxHP = rUInt32BE(bytes, O.MAX_HP);
  m.currMP = rUInt32BE(bytes, O.CURR_MP);
  m.currMaxMP = rUInt32BE(bytes, O.CURR_MAX_MP);
  m.maxMP = rUInt32BE(bytes, O.MAX_MP);
  m.currStam = rUInt32BE(bytes, O.CURR_STAM);
  m.currMaxStam = rUInt32BE(bytes, O.CURR_MAX_STAM);
  m.maxStam = rUInt32BE(bytes, O.MAX_STAM);

  /* ---- Stats ---- */
  // Stats are stored as Int32BE on disk, but the game never uses negative
  // values.  Read as unsigned for a consistent contract with the writer's
  // assertU32 validation.
  m.vit = rUInt32BE(bytes, O.VIT);
  m.int = rUInt32BE(bytes, O.INT);
  m.end = rUInt32BE(bytes, O.END);
  m.str = rUInt32BE(bytes, O.STR);
  m.dex = rUInt32BE(bytes, O.DEX);
  m.magic = rUInt32BE(bytes, O.MAGIC);
  m.faith = rUInt32BE(bytes, O.FAITH);
  m.luck = rUInt32BE(bytes, O.LUCK);
  m.souls = rUInt32BE(bytes, O.SOULS);
  m.soulMem = rUInt32BE(bytes, O.SOUL_MEMORY);
  m.levelsPurchased = rUInt32BE(bytes, O.LEVELS_PURCHASED);

  /* ---- Identity ---- */
  m.phantomType = bytes[O.PHANTOM_TYPE];
  // NAME field: character data (16 UTF-16LE pairs = 32 bytes) starts at
  // NAME+1 (0xD5).  Byte 0xD4 is NOT a length prefix — the game reads
  // the name as zero-terminated UTF-16 from 0xD4, so pair [0x00, char0]
  // is the first character.  We skip byte 0xD4 and read from NAME+1.
  m.name = rUniStr(bytes, O.NAME + 1, 0x10);
  m.gender = bytes[O.GENDER];
  m.startClass = bytes[O.START_CLASS];

  /* ---- Equipped slots (raw item IDs) ---- */
  m.leftHand1 = rUInt32BE(bytes, O.LH1);
  m.rightHand1 = rUInt32BE(bytes, O.RH1);
  m.leftHand2 = rUInt32BE(bytes, O.LH2);
  m.rightHand2 = rUInt32BE(bytes, O.RH2);
  m.arrows = rUInt32BE(bytes, O.ARROWS);
  m.bolts = rUInt32BE(bytes, O.BOLTS);
  m.helmet = rUInt32BE(bytes, O.HELMET);
  m.chest = rUInt32BE(bytes, O.CHEST);
  m.gauntlets = rUInt32BE(bytes, O.GAUNTLETS);
  m.leggings = rUInt32BE(bytes, O.LEGGINGS);
  m.hairstyle = rUInt32BE(bytes, O.HAIRSTYLE);
  m.ring1 = rUInt32BE(bytes, O.RING1);
  m.ring2 = rUInt32BE(bytes, O.RING2);
  m.quickSlot1 = rUInt32BE(bytes, O.QUICK1);
  m.quickSlot2 = rUInt32BE(bytes, O.QUICK2);
  m.quickSlot3 = rUInt32BE(bytes, O.QUICK3);
  m.quickSlot4 = rUInt32BE(bytes, O.QUICK4);
  m.quickSlot5 = rUInt32BE(bytes, O.QUICK5);

  /* ---- Equipped slot pointers (read-only display data) ----
   * These index into the inventory via Idx1 — they tell the game which
   * physical copy of an item each slot is bound to.  Read here for
   * display only; the writer resolves pointers from the binary buffer
   * at save time (never from the model).
   */
  m.leftHand1Ptr = rUInt32BE(bytes, O.LH1_PTR);
  m.rightHand1Ptr = rUInt32BE(bytes, O.RH1_PTR);
  m.leftHand2Ptr = rUInt32BE(bytes, O.LH2_PTR);
  m.rightHand2Ptr = rUInt32BE(bytes, O.RH2_PTR);
  m.arrowsPtr = rUInt32BE(bytes, O.ARROW_PTR);
  m.boltsPtr = rUInt32BE(bytes, O.BOLT_PTR);
  m.helmetPtr = rUInt32BE(bytes, O.HELMET_PTR);
  m.chestPtr = rUInt32BE(bytes, O.CHEST_PTR);
  m.gauntletsPtr = rUInt32BE(bytes, O.GAUNTLETS_PTR);
  m.leggingsPtr = rUInt32BE(bytes, O.LEGGINGS_PTR);
  m.ring1Ptr = rUInt32BE(bytes, O.RING1_PTR);
  m.ring2Ptr = rUInt32BE(bytes, O.RING2_PTR);
  m.quickSlot1Ptr = rUInt32BE(bytes, O.QUICK1_PTR);
  m.quickSlot2Ptr = rUInt32BE(bytes, O.QUICK2_PTR);
  m.quickSlot3Ptr = rUInt32BE(bytes, O.QUICK3_PTR);
  m.quickSlot4Ptr = rUInt32BE(bytes, O.QUICK4_PTR);
  m.quickSlot5Ptr = rUInt32BE(bytes, O.QUICK5_PTR);

  /* ---- Inventory ---- */
  // invCount is read for the inventory loop limit, but not stored in the
  // model — the writer recomputes it from modelSlots.size.
  const invCount = rUInt32BE(bytes, O.INV_COUNT);
  m.weapons = [];
  m.armor = [];
  m.rings = [];
  m.goods = [];

  let offset = -0x20;
  let totalSlotsScanned = 0;
  // Empty inventory slots are all-0xFF on disk (confirmed by the game and
  // by the writer's EMPTY_INV template).  rInt32BE reads 0xFFFFFFFF as -1
  // (signed), so `type === -1` is the correct empty-slot check.  Unknown
  // type values (not 0x0/0x1/0x2/0x4 in the high nibble) are caught by the
  // switch default below with a throw.
  for (let i = 0; i < invCount; i++) {
    let type = -1;
    while (type === -1) {
      offset += O.INV_STRIDE;
      totalSlotsScanned++;
      // Cap total slots scanned at INV_SLOTS to prevent runaway on corrupt
      // data with plausible invCount.
      if (totalSlotsScanned > O.INV_SLOTS) {
        throw new Error('Unexpected data, file may be encrypted or corrupt?');
      }
      // Region-boundary check: prevent the inner loop from scanning past
      // the inventory region into the durability table (DURABILITY_BASE+).
      assertBelow(
        O.INV_TYPE_BASE + offset,
        O.DURABILITY_BASE,
        'Unexpected data, file may be encrypted or corrupt?',
      );
      // Bounds-check the record read.
      assertBounds(bytes, O.INV_TYPE_BASE + offset, O.INV_STRIDE);
      type = rInt32BE(bytes, O.INV_TYPE_BASE + offset);
    }

    const itemID = rUInt32BE(bytes, O.INV_ITEM_ID_BASE + offset);
    const itemCount = rUInt32BE(bytes, O.INV_ITEM_COUNT_BASE + offset);
    const idx1 = rUInt32BE(bytes, O.INV_IDX1_BASE + offset); // array index → durability table + hotbar ptrs
    // Validate idx1: it indexes into the durability table (INV_SLOTS entries)
    // and the hotbar pointer system.  A value >= INV_SLOTS (or with any bits
    // set above the low 16, since the table only has INV_SLOTS=0x800 entries)
    // indicates corrupt or encrypted data — catch it here before the OOB
    // durability read below.
    if (idx1 >= O.INV_SLOTS) {
      throw new Error('Unexpected data, file may be encrypted or corrupt?');
    }
    const misc1 = rUInt16BE(bytes, O.INV_MISC1_BASE + offset); // "sortId" — in-game inventory sort/group id
    const idx2 = rUInt16BE(bytes, O.INV_IDX2_BASE + offset); // display index (sequential row position)
    const misc2 = rUInt32BE(bytes, O.INV_MISC2_BASE + offset); // unknown; preserved verbatim (usually 0x01000000)
    const durability = rUInt32BE(bytes, O.DURABILITY_BASE + idx1 * 8);

    const slot = offset / O.INV_STRIDE; // original physical slot position
    const rec = {
      itemId: itemID,
      count: itemCount,
      idx1,
      misc1,
      idx2,
      misc2,
      durability,
      _slot: slot,
    };

    switch (type >>> 0) {
      case 0x00000000:
        m.weapons.push(rec);
        break;
      case 0x10000000:
        m.armor.push(rec);
        break;
      case 0x20000000:
        m.rings.push(rec);
        break;
      case 0x40000000:
        m.goods.push(rec);
        break;
      default:
        throw new Error(
          `Unknown inventory type 0x${(type >>> 0).toString(16).padStart(8, '0')} at slot ${slot}`,
        );
    }
  }

  /* ---- Thomas Storage (Deposit) ---- */
  // Items stored with Thomas in the Nexus.
  // Entry layout: unknown1(4) + type(1) + itemId(3) + sortOrder(4) + count(1) + flag(1) + pad(4) + durability(2)
  // Type: 0x00=weapon, 0x10=armor, 0x20=ring, 0x40=item, 0xFF=empty
  //
  // The reader captures bytes 13–19 (flag + pad + durability) as a 7-element
  // `flags` array for write-back fidelity. Durability is also extracted
  // separately from bytes 18–19 into the named model field.
  // Read DEPOSIT_COUNT for early exit — stop scanning once we've found
  // that many non-empty entries. Avoids scanning all 2048 slots when only
  // a handful are occupied (typical case).
  const depositCount = rUInt32BE(bytes, O.DEPOSIT_COUNT);
  m.deposit = [];
  let depositFound = 0;
  for (let i = 0; i < O.DEPOSIT_MAX_ENTRIES && depositFound < depositCount; i++) {
    const base = O.DEPOSIT_BASE + i * O.DEPOSIT_STRIDE;
    // Bounds-check each deposit entry read.
    assertBounds(bytes, base, O.DEPOSIT_STRIDE);
    const type = bytes[base + 4];
    if (type === 0xff) continue;
    if (type !== 0x00 && type !== 0x10 && type !== 0x20 && type !== 0x40) continue;

    const itemId = (bytes[base + 5] << 16) | (bytes[base + 6] << 8) | bytes[base + 7];
    const count = bytes[base + 12];

    let category;
    switch (type) {
      case 0x00:
        category = 'weapons';
        break;
      case 0x10:
        category = 'armor';
        break;
      case 0x20:
        category = 'rings';
        break;
      case 0x40:
        category = 'goods';
        break;
    }

    m.deposit.push({
      category,
      itemId,
      count,
      durability: (bytes[base + 18] << 8) | bytes[base + 19],
      // Preserve unknown fields for write-back fidelity
      unknown1:
        ((bytes[base] << 24) |
          (bytes[base + 1] << 16) |
          (bytes[base + 2] << 8) |
          bytes[base + 3]) >>>
        0,
      sortOrder:
        ((bytes[base + 8] << 24) |
          (bytes[base + 9] << 16) |
          (bytes[base + 10] << 8) |
          bytes[base + 11]) >>>
        0,
      flags: [...bytes.subarray(base + 13, base + 20)],
    });
    depositFound++;
  }

  /* ---- Spells ---- */
  m.spellSlots = rUInt32BE(bytes, O.SPELL_SLOTS);
  m.miracleSlots = rUInt32BE(bytes, O.MIRACLE_SLOTS);
  m.hairR = rSingleBE(bytes, O.HAIR_R);
  m.hairG = rSingleBE(bytes, O.HAIR_G);
  m.hairB = rSingleBE(bytes, O.HAIR_B);

  const spellCount = rUInt32BE(bytes, O.SPELL_COUNT);
  m.spells = [];
  for (let i = 0; i < spellCount; i++) {
    const base = O.SPELL_BASE + i * O.SPELL_STRIDE;
    // Bounds-check each spell record read.
    assertBounds(bytes, base, O.SPELL_STRIDE);
    const status = rUInt32BE(bytes, base + O.SPELL_STATUS_OFFSET);
    const id = rUInt32BE(bytes, base + O.SPELL_ID_OFFSET);
    const misc1 = rUInt32BE(bytes, base + O.SPELL_MISC1_OFFSET);
    const misc2 = rUInt32BE(bytes, base + O.SPELL_MISC2_OFFSET);
    m.spells.push({
      itemId: id,
      status,
      misc1,
      misc2,
    });
  }

  /* ---- Tendency ---- */
  m.charTendency = rSingleBE(bytes, O.CHAR_TENDENCY);
  m.nexusTendency = rSingleBE(bytes, O.NEXUS_TENDENCY);
  m.w1Tendency = rSingleBE(bytes, O.W1_TENDENCY);
  m.w2Tendency = rSingleBE(bytes, O.W2_TENDENCY);
  m.w3Tendency = rSingleBE(bytes, O.W3_TENDENCY);
  m.w4Tendency = rSingleBE(bytes, O.W4_TENDENCY);
  m.w5Tendency = rSingleBE(bytes, O.W5_TENDENCY);

  /* ---- Misc ---- */
  m.clearCount = bytes[O.CLEAR_COUNT];
  m.archSealed = !oneByteAnd(bytes, O.ARCH_SEALED, 0x40);

  /* ---- NPC flags ---- */
  m.sageFreke = {
    friendly: oneByteAnd(bytes, O.SAGE_FREKE, 0x04),
    hostile: oneByteAnd(bytes, O.SAGE_FREKE, 0x08),
    dead: oneByteAnd(bytes, O.SAGE_FREKE, 0x10),
  };
  m.thomas = {
    friendly: oneByteAnd(bytes, O.THOMAS, 0x40),
    hostile: oneByteAnd(bytes, O.THOMAS, 0x80),
    dead: oneByteAnd(bytes, O.THOMAS_DEAD, 0x01),
  };
  m.boldwin = {
    friendly: oneByteAnd(bytes, O.BOLDWIN, 0x01),
    hostile: oneByteAnd(bytes, O.BOLDWIN, 0x02),
    dead: oneByteAnd(bytes, O.BOLDWIN, 0x04),
  };

  return /** @type {import('./model.js').FullModel} */ (m);
}

// readProfileNumber() is in ps3/param-sfo.js (the canonical location for SFO operations)
