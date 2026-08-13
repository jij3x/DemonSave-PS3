/**
 * Save data factory for integration tests.
 *
 * Creates fully-populated, realistic save data with every field set to a
 * distinct, verifiable sentinel value.  Supports both encrypted and
 * unencrypted save folders, single and multi-slot configurations.
 *
 * The factory writes raw bytes directly to offsets (independent of the
 * writer) so tests can verify the reader + writer + save-api pipeline
 * without circular dependencies.
 */
import * as O from '../js/des-savefile/offsets.js';
import {
  wInt32BE,
  wUInt16BE,
  wUInt32BE,
  wSingleBE,
  fromHex,
  createPfdForFiles,
  getParamPfdCombinedData,
  validAllParamHashes,
  encryptFile,
} from '../js/lib/ps3-save-lib/index.js';

/** Buffer size matching real DeS save files (262,144 bytes = 256 KB). */
export const BUF_SIZE = 0x40000;

/** DeS SecureFileID (hardcoded in save-api.js). */
export const SECURE_ID = fromHex('0123456789ABCDEFFEDCBA9876543210');

// ---------------------------------------------------------------------------
// Sentinel values — distinct per slot for easy verification
// ---------------------------------------------------------------------------

/**
 * Generate a complete set of field values for a given slot number.
 *
 * Every value is derived from the slot number so that slots are easily
 * distinguishable and cross-contamination is immediately detectable.
 *
 * @param {number} slot  1-based slot number
 * Returns a plain model object with all fields populated (return type inferred).
 */
export function getExpectedModel(slot) {
  const s = slot * 1000;
  return {
    // World / position
    world: (slot * 3) & 0xff,
    block: (slot * 5) & 0xff,
    x: 100.5 + s,
    y: 200.25 + s,
    z: -50.75 + s,
    rot: 1.5708 * slot,

    // Vitals
    currHP: 400 + s,
    currMaxHP: 450 + s,
    maxHP: 500 + s,
    currMP: 30 + slot,
    currMaxMP: 40 + slot,
    maxMP: 50 + slot,
    currStam: 100 + slot * 10,
    currMaxStam: 110 + slot * 10,
    maxStam: 120 + slot * 10,

    // Stats
    vit: 10 + slot,
    int: 12 + slot,
    end: 14 + slot,
    str: 16 + slot,
    dex: 18 + slot,
    magic: 20 + slot,
    faith: 22 + slot,
    luck: 24 + slot,
    souls: 9999 + s,
    soulMem: 88888 + s,
    levelsPurchased: slot * 5,

    // Identity
    phantomType: slot & 0xff,
    name: `TestChar${slot}`,
    gender: slot % 2,
    startClass: slot % 10,

    // Equipment (use 0xFFFFFFFF for "empty" to test that too)
    leftHand1: 0x00010000 + slot,
    rightHand1: 0x00020000 + slot,
    leftHand2: 0x00030000 + slot,
    rightHand2: 0x00040000 + slot,
    arrows: 0x00050000 + slot,
    bolts: 0xffffffff, // empty slot test
    helmet: 0x00100000 + slot,
    chest: 0x00110000 + slot,
    gauntlets: 0x00120000 + slot,
    leggings: 0x00130000 + slot,
    hairstyle: 0x00140000 + slot,
    ring1: 0x00150000 + slot,
    ring2: 0xffffffff, // empty slot test
    quickSlot1: 0x00000300 + slot,
    quickSlot2: 0x00000310 + slot,
    quickSlot3: 0xffffffff, // empty slot test
    quickSlot4: 0x00000330 + slot,
    quickSlot5: 0x00000340 + slot,

    // Equipment pointers (hotbar inventory-index pointers).
    // Empty equipment slots (0xFFFFFFFF) get 0xFFFFFFFF pointer.
    // Non-empty slots get a deterministic sentinel derived from slot.
    leftHand1Ptr: 0x1000 + slot,
    rightHand1Ptr: 0x1010 + slot,
    leftHand2Ptr: 0x1020 + slot,
    rightHand2Ptr: 0x1030 + slot,
    arrowsPtr: 0x1040 + slot,
    boltsPtr: 0xffffffff, // empty
    helmetPtr: 0x1050 + slot,
    chestPtr: 0x1060 + slot,
    gauntletsPtr: 0x1070 + slot,
    leggingsPtr: 0x1080 + slot,
    ring1Ptr: 0x1090 + slot,
    ring2Ptr: 0xffffffff, // empty
    quickSlot1Ptr: 0x10a0 + slot,
    quickSlot2Ptr: 0x10b0 + slot,
    quickSlot3Ptr: 0xffffffff, // empty
    quickSlot4Ptr: 0x10c0 + slot,
    quickSlot5Ptr: 0x10d0 + slot,

    // Spell slots / appearance
    spellSlots: 3 + slot,
    miracleSlots: 2 + slot,
    hairR: 0.1 * slot,
    hairG: 0.2 * slot,
    hairB: 0.3 * slot,

    // Tendency
    charTendency: 50.0 + slot,
    nexusTendency: -20.0 + slot,
    w1Tendency: 10.5 + slot,
    w2Tendency: -30.25 + slot,
    w3Tendency: 40.75 + slot,
    w4Tendency: -10.5 + slot,
    w5Tendency: 60.0 + slot,

    // Misc
    clearCount: slot,
    archSealed: slot % 2 === 0,

    // NPC flags
    sageFreke: { friendly: true, hostile: slot % 3 === 0, dead: slot % 4 === 0 },
    thomas: { friendly: true, hostile: false, dead: slot % 5 === 0 },
    boldwin: { friendly: false, hostile: slot % 2 === 0, dead: false },

    // Inventory — items in all 4 categories
    weapons: [
      {
        itemId: 0x00010001 + slot,
        count: 1,
        idx1: 0,
        misc1: 0x1005,
        idx2: 0,
        misc2: 0x01000000,
        durability: 300 + slot,
      },
      {
        itemId: 0x00010002 + slot,
        count: 2,
        idx1: 1,
        misc1: 0x0ffc,
        idx2: 1,
        misc2: 0x01000000,
        durability: 200 + slot,
      },
    ],
    armor: [
      {
        itemId: 0x00100001 + slot,
        count: 1,
        idx1: 2,
        misc1: 0x000c,
        idx2: 2,
        misc2: 0x01000000,
        durability: 100 + slot,
      },
    ],
    rings: [
      {
        itemId: 0x00200001 + slot,
        count: 1,
        idx1: 3,
        misc1: 0x0001,
        idx2: 3,
        misc2: 0x01000000,
        durability: 0,
      },
    ],
    goods: [
      {
        itemId: 0x00400001 + slot,
        count: 99,
        idx1: 4,
        misc1: 0x0001,
        idx2: 4,
        misc2: 0x01000000,
        durability: 0,
      },
      {
        itemId: 0x00400002 + slot,
        count: 50,
        idx1: 5,
        misc1: 0x0007,
        idx2: 5,
        misc2: 0x01000000,
        durability: 0,
      },
      {
        itemId: 0x00400003 + slot,
        count: 10,
        idx1: 6,
        misc1: 0x0065,
        idx2: 6,
        misc2: 0x01000000,
        durability: 0,
      },
    ],

    // Deposit — items in all 4 categories
    // NOTE: flags[5..6] are the durability bytes (writer writes durability
    // to the same offset as flags[5..6] via wUInt16BE at b+0x12).  So the
    // expected flags must match the durability value.
    deposit: [
      {
        category: 'weapons',
        itemId: 0x00020001 + slot,
        count: 1,
        durability: 280 + slot,
        unknown1: 0x00000001,
        sortOrder: (0x1005 << 16) | 0,
        flags: [0x21, 0x00, 0x00, 0x00, 0x00, ((280 + slot) >> 8) & 0xff, (280 + slot) & 0xff],
      },
      {
        category: 'armor',
        itemId: 0x00110001 + slot,
        count: 3,
        durability: 180 + slot,
        unknown1: 0x00000002,
        sortOrder: (0x000c << 16) | 1,
        flags: [0x21, 0x00, 0x00, 0x00, 0x00, ((180 + slot) >> 8) & 0xff, (180 + slot) & 0xff],
      },
      {
        category: 'rings',
        itemId: 0x00210001 + slot,
        count: 1,
        durability: 0,
        unknown1: 0,
        sortOrder: (0x0001 << 16) | 2,
        flags: [0x21, 0, 0, 0, 0, 0, 0],
      },
      {
        category: 'goods',
        itemId: 0x00410001 + slot,
        count: 99,
        durability: 0,
        unknown1: 0,
        sortOrder: (0x0001 << 16) | 3,
        flags: [0x21, 0, 0, 0, 0, 0, 0],
      },
    ],

    // Spells
    spells: [
      { itemId: 0x01000001 + slot, status: 3, misc1: 1, misc2: 0 },
      { itemId: 0x01000002 + slot, status: 2, misc1: 8, misc2: 0 },
      { itemId: 0x01000003 + slot, status: 3, misc1: 11, misc2: 0 },
    ],
  };
}

// ---------------------------------------------------------------------------
// Raw buffer construction
// ---------------------------------------------------------------------------

/**
 * Write a fully-populated USER.DAT buffer for a given slot.
 *
 * Writes raw bytes to every offset the reader uses, independently of the
 * writer.  The values match {@link getExpectedModel}.
 *
 * @param {number} slot  1-based slot number
 * @returns {Uint8Array} populated USER.DAT buffer
 */
export function createPopulatedUserDat(slot) {
  const buf = new Uint8Array(BUF_SIZE);
  const m = getExpectedModel(slot);

  // Sanity check — must be non-zero or reader rejects the save
  wInt32BE(buf, O.SANITY_CHECK, 1);

  // ---- World / position ----
  buf[O.WORLD] = m.world & 0xff;
  buf[O.BLOCK] = m.block & 0xff;
  // Position: set selector to 0 so positions are at POS_TABLE_BASE
  wInt32BE(buf, O.POS_OFFSET_SELECTOR, 0);
  wSingleBE(buf, O.POS_TABLE_BASE + 0, m.x);
  wSingleBE(buf, O.POS_TABLE_BASE + 4, m.y);
  wSingleBE(buf, O.POS_TABLE_BASE + 8, m.z);
  wSingleBE(buf, O.POS_TABLE_BASE + 0x14, m.rot);

  // ---- Vitals ----
  wUInt32BE(buf, O.CURR_HP, m.currHP);
  wUInt32BE(buf, O.CURR_MAX_HP, m.currMaxHP);
  wUInt32BE(buf, O.MAX_HP, m.maxHP);
  wUInt32BE(buf, O.CURR_MP, m.currMP);
  wUInt32BE(buf, O.CURR_MAX_MP, m.currMaxMP);
  wUInt32BE(buf, O.MAX_MP, m.maxMP);
  wUInt32BE(buf, O.CURR_STAM, m.currStam);
  wUInt32BE(buf, O.CURR_MAX_STAM, m.currMaxStam);
  wUInt32BE(buf, O.MAX_STAM, m.maxStam);

  // ---- Stats (write to effective column — that's what the reader reads) ----
  wUInt32BE(buf, O.VIT, m.vit);
  wUInt32BE(buf, O.INT, m.int);
  wUInt32BE(buf, O.END, m.end);
  wUInt32BE(buf, O.STR, m.str);
  wUInt32BE(buf, O.DEX, m.dex);
  wUInt32BE(buf, O.MAGIC, m.magic);
  wUInt32BE(buf, O.FAITH, m.faith);
  wUInt32BE(buf, O.LUCK, m.luck);
  wUInt32BE(buf, O.SOULS, m.souls);
  wUInt32BE(buf, O.SOUL_MEMORY, m.soulMem);
  wUInt32BE(buf, O.LEVELS_PURCHASED, m.levelsPurchased);

  // ---- Identity ----
  buf[O.PHANTOM_TYPE] = m.phantomType & 0xff;
  // Name: 16 UTF-16LE-like char pairs at 0xD5 (no length prefix).
  // Byte 0xD4 is zeroed so the game reads [0x00, char0] as the first pair.
  buf[O.NAME] = 0;
  for (let i = 0; i < m.name.length; i++) {
    const cc = m.name.charCodeAt(i);
    buf[O.NAME + 1 + i * 2] = cc & 0xff;
    buf[O.NAME + 1 + i * 2 + 1] = (cc >> 8) & 0xff;
  }
  buf[O.GENDER] = m.gender & 0xff;
  buf[O.START_CLASS] = m.startClass & 0xff;

  // ---- Equipment IDs ----
  wUInt32BE(buf, O.LH1, m.leftHand1);
  wUInt32BE(buf, O.RH1, m.rightHand1);
  wUInt32BE(buf, O.LH2, m.leftHand2);
  wUInt32BE(buf, O.RH2, m.rightHand2);
  wUInt32BE(buf, O.ARROWS, m.arrows);
  wUInt32BE(buf, O.BOLTS, m.bolts);
  wUInt32BE(buf, O.HELMET, m.helmet);
  wUInt32BE(buf, O.CHEST, m.chest);
  wUInt32BE(buf, O.GAUNTLETS, m.gauntlets);
  wUInt32BE(buf, O.LEGGINGS, m.leggings);
  wUInt32BE(buf, O.HAIRSTYLE, m.hairstyle);
  wUInt32BE(buf, O.RING1, m.ring1);
  wUInt32BE(buf, O.RING2, m.ring2);
  wUInt32BE(buf, O.QUICK1, m.quickSlot1);
  wUInt32BE(buf, O.QUICK2, m.quickSlot2);
  wUInt32BE(buf, O.QUICK3, m.quickSlot3);
  wUInt32BE(buf, O.QUICK4, m.quickSlot4);
  wUInt32BE(buf, O.QUICK5, m.quickSlot5);

  // ---- Equipment pointers (hotbar inventory-index pointers) ----
  wUInt32BE(buf, O.LH1_PTR, m.leftHand1Ptr);
  wUInt32BE(buf, O.RH1_PTR, m.rightHand1Ptr);
  wUInt32BE(buf, O.LH2_PTR, m.leftHand2Ptr);
  wUInt32BE(buf, O.RH2_PTR, m.rightHand2Ptr);
  wUInt32BE(buf, O.ARROW_PTR, m.arrowsPtr);
  wUInt32BE(buf, O.BOLT_PTR, m.boltsPtr);
  wUInt32BE(buf, O.HELMET_PTR, m.helmetPtr);
  wUInt32BE(buf, O.CHEST_PTR, m.chestPtr);
  wUInt32BE(buf, O.GAUNTLETS_PTR, m.gauntletsPtr);
  wUInt32BE(buf, O.LEGGINGS_PTR, m.leggingsPtr);
  // RESERVED_PTR (0x260) is padding — set to 0xFFFFFFFF like real saves
  wUInt32BE(buf, O.RESERVED_PTR, 0xffffffff);
  wUInt32BE(buf, O.RING1_PTR, m.ring1Ptr);
  wUInt32BE(buf, O.RING2_PTR, m.ring2Ptr);
  wUInt32BE(buf, O.QUICK1_PTR, m.quickSlot1Ptr);
  wUInt32BE(buf, O.QUICK2_PTR, m.quickSlot2Ptr);
  wUInt32BE(buf, O.QUICK3_PTR, m.quickSlot3Ptr);
  wUInt32BE(buf, O.QUICK4_PTR, m.quickSlot4Ptr);
  wUInt32BE(buf, O.QUICK5_PTR, m.quickSlot5Ptr);

  // ---- Inventory ----
  // Fill the entire inventory region with the empty-slot pattern (0xFFFFFFFF)
  // so that only the slots we explicitly populate are considered "occupied".
  // Without this, zeroed bytes are interpreted as type=0 (weapon), making
  // all 0x800 slots appear occupied — the writer then can't place new items.
  for (let i = 0; i < O.INV_SLOTS; i++) {
    const emptyB = O.INV_TYPE_BASE + i * O.INV_STRIDE;
    if (emptyB + O.INV_STRIDE > buf.length) break;
    wUInt32BE(buf, emptyB, 0xffffffff);
  }

  const allItems = [
    ...m.weapons.map((r) => ({ ...r, type: 0x00000000 })),
    ...m.armor.map((r) => ({ ...r, type: 0x10000000 })),
    ...m.rings.map((r) => ({ ...r, type: 0x20000000 })),
    ...m.goods.map((r) => ({ ...r, type: 0x40000000 })),
  ];

  wUInt32BE(buf, O.INV_COUNT, allItems.length);
  for (let i = 0; i < allItems.length; i++) {
    const rec = allItems[i];
    const b = O.INV_TYPE_BASE + i * O.INV_STRIDE;
    wUInt32BE(buf, b + 0x00, rec.type);
    wUInt32BE(buf, b + 0x04, rec.itemId);
    wUInt32BE(buf, b + 0x08, rec.count);
    wUInt32BE(buf, b + 0x0c, rec.idx1);
    wUInt16BE(buf, b + 0x10, rec.misc1);
    wUInt16BE(buf, b + 0x12, rec.idx2);
    wUInt32BE(buf, b + 0x14, rec.misc2);
    // Durability (parallel table) — weapons and armor only
    if (rec.type === 0x00000000 || rec.type === 0x10000000) {
      wUInt32BE(buf, O.DURABILITY_BASE + rec.idx1 * 8, rec.durability);
    }
  }

  // ---- Deposit ----
  // First, fill all deposit slots with the empty-slot pattern
  for (let i = 0; i < O.DEPOSIT_MAX_ENTRIES; i++) {
    const b = O.DEPOSIT_BASE + i * O.DEPOSIT_STRIDE;
    buf[b + 4] = 0xff; // type = empty
  }

  wUInt32BE(buf, O.DEPOSIT_COUNT, m.deposit.length);
  for (let i = 0; i < m.deposit.length; i++) {
    const rec = m.deposit[i];
    const b = O.DEPOSIT_BASE + i * O.DEPOSIT_STRIDE;

    let typeByte = 0;
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
    }

    wUInt32BE(buf, b + 0, rec.unknown1);
    buf[b + 4] = typeByte;
    buf[b + 5] = (rec.itemId >> 16) & 0xff;
    buf[b + 6] = (rec.itemId >> 8) & 0xff;
    buf[b + 7] = rec.itemId & 0xff;
    wUInt32BE(buf, b + 8, rec.sortOrder);
    buf[b + 12] = rec.count & 0xff;
    // flags[0..6] → bytes b+13..b+19
    for (let j = 0; j < rec.flags.length; j++) {
      buf[b + 13 + j] = rec.flags[j] & 0xff;
    }
  }

  // ---- Spell slots / appearance ----
  wUInt32BE(buf, O.SPELL_SLOTS, m.spellSlots);
  wUInt32BE(buf, O.MIRACLE_SLOTS, m.miracleSlots);
  wSingleBE(buf, O.HAIR_R, m.hairR);
  wSingleBE(buf, O.HAIR_G, m.hairG);
  wSingleBE(buf, O.HAIR_B, m.hairB);

  // ---- Spells ----
  wUInt32BE(buf, O.SPELL_COUNT, m.spells.length);
  for (let i = 0; i < m.spells.length; i++) {
    const sp = m.spells[i];
    const b = O.SPELL_BASE + i * O.SPELL_STRIDE;
    wUInt32BE(buf, b + O.SPELL_STATUS_OFFSET, sp.status);
    wUInt32BE(buf, b + O.SPELL_ID_OFFSET, sp.itemId);
    wUInt32BE(buf, b + O.SPELL_MISC1_OFFSET, sp.misc1);
    wUInt32BE(buf, b + O.SPELL_MISC2_OFFSET, sp.misc2);
  }

  // ---- Tendency ----
  wSingleBE(buf, O.CHAR_TENDENCY, m.charTendency);
  wSingleBE(buf, O.NEXUS_TENDENCY, m.nexusTendency);
  wSingleBE(buf, O.W1_TENDENCY, m.w1Tendency);
  wSingleBE(buf, O.W2_TENDENCY, m.w2Tendency);
  wSingleBE(buf, O.W3_TENDENCY, m.w3Tendency);
  wSingleBE(buf, O.W4_TENDENCY, m.w4Tendency);
  wSingleBE(buf, O.W5_TENDENCY, m.w5Tendency);

  // ---- Misc ----
  buf[O.CLEAR_COUNT] = m.clearCount & 0xff;
  // archSealed: bit 6 (0x40), inverted — sealed=true means bit is CLEAR
  buf[O.ARCH_SEALED] = m.archSealed ? buf[O.ARCH_SEALED] & ~0x40 : buf[O.ARCH_SEALED] | 0x40;

  // ---- NPC flags ----
  // sageFreke: bit2=friendly, bit3=hostile, bit4=dead
  buf[O.SAGE_FREKE] =
    (m.sageFreke.friendly ? 0x04 : 0) |
    (m.sageFreke.hostile ? 0x08 : 0) |
    (m.sageFreke.dead ? 0x10 : 0);

  // thomas: bit6=friendly, bit7=hostile (at THOMAS offset)
  buf[O.THOMAS] = (m.thomas.friendly ? 0x40 : 0) | (m.thomas.hostile ? 0x80 : 0);
  // thomas dead: bit0 at THOMAS_DEAD offset
  buf[O.THOMAS_DEAD] = m.thomas.dead ? 0x01 : 0;

  // boldwin: bit0=friendly, bit1=hostile, bit2=dead
  buf[O.BOLDWIN] =
    (m.boldwin.friendly ? 0x01 : 0) | (m.boldwin.hostile ? 0x02 : 0) | (m.boldwin.dead ? 0x04 : 0);

  return buf;
}

// ---------------------------------------------------------------------------
// PARAM.SFO construction
// ---------------------------------------------------------------------------

/**
 * Build a realistic PARAM.SFO with proper header, index table, key table,
 * and data table — including ACCOUNT_ID and ATTRIBUTE entries.
 *
 * @param {number} profileNumber  byte value at offset 0x570
 * @param {string} [accountIdHex]  32-char hex string for ACCOUNT_ID
 * @returns {Uint8Array}
 */
export function createRealisticSfo(profileNumber, accountIdHex) {
  // SFO layout:
  //   Header: 20 bytes (0x00 - 0x13)
  //   Index entries: 2 × 16 = 32 bytes (0x14 - 0x33)
  //   Key table: "ACCOUNT_ID\0" (11) + "ATTRIBUTE\0" (10) = 21 bytes (0x34 - 0x48)
  //   Data table: ACCOUNT_ID (16) + ATTRIBUTE (4) = 20 bytes (0x49 - 0x5C)
  //   Padding to 0x600 (for profile number at 0x570)
  const sfo = new Uint8Array(0x600);
  const dv = new DataView(sfo.buffer);

  // Magic: \0PSF
  sfo[0] = 0x00;
  sfo[1] = 0x50;
  sfo[2] = 0x53;
  sfo[3] = 0x46;
  // Version: 1.1
  dv.setUint32(4, 0x00000101, true);

  const keyTableStart = 0x34;
  const dataTableStart = 0x49;
  const entryCount = 2;

  dv.setUint32(8, keyTableStart, true);
  dv.setUint32(12, dataTableStart, true);
  dv.setUint32(16, entryCount, true);

  // Index entry 0: ACCOUNT_ID
  //   key_offset = 0 (relative to keyTableStart)
  //   data_fmt = 0x0400 (UTF8_S, stored BE on disk)
  //   data_len = 16, data_max_len = 16
  //   data_offset = 0 (relative to dataTableStart)
  const e0 = 20;
  dv.setUint16(e0, 0, true); // key_offset (LE)
  dv.setUint16(e0 + 2, 0x0400, false); // data_fmt (BE!)
  dv.setUint32(e0 + 4, 16, true); // data_len (LE)
  dv.setUint32(e0 + 8, 16, true); // data_max_len (LE)
  dv.setUint32(e0 + 12, 0, true); // data_offset (LE)

  // Index entry 1: ATTRIBUTE
  //   key_offset = 11 (after "ACCOUNT_ID\0")
  //   data_fmt = 0x0404 (INT32, stored BE on disk)
  //   data_len = 4, data_max_len = 4
  //   data_offset = 16 (after ACCOUNT_ID data)
  const e1 = 20 + 16;
  dv.setUint16(e1, 11, true); // key_offset (LE)
  dv.setUint16(e1 + 2, 0x0404, false); // data_fmt (BE!)
  dv.setUint32(e1 + 4, 4, true); // data_len (LE)
  dv.setUint32(e1 + 8, 4, true); // data_max_len (LE)
  dv.setUint32(e1 + 12, 16, true); // data_offset (LE)

  // Key table
  const acctIdKey = 'ACCOUNT_ID';
  for (let i = 0; i < acctIdKey.length; i++) {
    sfo[keyTableStart + i] = acctIdKey.charCodeAt(i);
  }
  sfo[keyTableStart + acctIdKey.length] = 0; // null terminator

  const attrKey = 'ATTRIBUTE';
  const attrKeyOff = keyTableStart + acctIdKey.length + 1;
  for (let i = 0; i < attrKey.length; i++) {
    sfo[attrKeyOff + i] = attrKey.charCodeAt(i);
  }
  sfo[attrKeyOff + attrKey.length] = 0; // null terminator

  // Data table — ACCOUNT_ID (16 raw bytes)
  const acctIdOff = dataTableStart;
  if (accountIdHex) {
    const clean = accountIdHex.replace(/[^0-9a-fA-F]/g, '').padEnd(32, '0');
    const bytes = fromHex(clean);
    sfo.set(bytes, acctIdOff);
  }
  // If no accountId provided, leave as zeros (RPCS3 default).

  // Data table — ATTRIBUTE (4 bytes, LE u32 = 0 means no copy protection)
  dv.setUint32(dataTableStart + 16, 0, true);

  // Profile number at hardcoded game-specific offset
  sfo[0x570] = profileNumber & 0xff;

  return sfo;
}

/**
 * SFO index/data-table entry used while building a PARAM.SFO buffer.
 * @typedef {Object} SfoEntry
 * @property {string} key
 * @property {string|null} [str]   - string value (null for raw-byte ACCOUNT_ID)
 * @property {number} [int]        - INT32 value
 * @property {number} fmt          - data format code
 * @property {number} maxLen       - max field length in bytes
 * @property {number} [keyOff]     - assigned key-table offset
 * @property {number} [dataOff]    - assigned data-table offset
 */

/**
 * Build a rich PARAM.SFO carrying every entry the field accessors look up:
 * TITLE, SUB_TITLE, DETAIL, SAVEDATA_DIRECTORY, ACCOUNT_ID, ATTRIBUTE.
 *
 * Used by the `sfofields` fuzz corpus so the parsed-sfo getters
 * (`getTitle`/`getSubTitle`/`getDetail`/`getDirectoryName`/`getTitleId`/
 * `getAccountId`) exercise their *found* branch, and so the raw-byte
 * mutators (`removeCopyProtection`, `getSfoAccountId`, `writeSfoAccountId`)
 * have real targets to act on.
 *
 * @param {number} profileNumber  byte value at offset 0x570
 * @param {string} [accountIdHex]  32-char hex string for ACCOUNT_ID
 * @returns {Uint8Array}
 */
export function createRichSfo(profileNumber, accountIdHex) {
  const FMT_UTF8_S = 0x0400;
  const FMT_INT32 = 0x0404;

  // value === null marks a raw-bytes entry (ACCOUNT_ID); number marks INT32.
  /** @type {SfoEntry[]} */
  const entries = [
    { key: 'TITLE', str: "Demon's Souls", fmt: FMT_UTF8_S, maxLen: 32 },
    { key: 'SUB_TITLE', str: 'Action RPG', fmt: FMT_UTF8_S, maxLen: 32 },
    { key: 'DETAIL', str: 'Save data', fmt: FMT_UTF8_S, maxLen: 32 },
    { key: 'SAVEDATA_DIRECTORY', str: 'BLUS30443DEMONSS005', fmt: FMT_UTF8_S, maxLen: 32 },
    { key: 'ACCOUNT_ID', str: null, fmt: FMT_UTF8_S, maxLen: 16 },
    { key: 'ATTRIBUTE', int: 1, fmt: FMT_INT32, maxLen: 4 },
  ];

  const HEADER = 20;
  const INDEX_SIZE = entries.length * 16;
  const keyTableStart = HEADER + INDEX_SIZE;

  // Key offsets (relative to keyTableStart) + total key-table length.
  let keyCursor = 0;
  for (const e of entries) {
    e.keyOff = keyCursor;
    keyCursor += e.key.length + 1; // +null terminator
  }
  const dataTableStart = keyTableStart + keyCursor;

  // Data offsets (relative to dataTableStart) + total data-table length.
  let dataCursor = 0;
  for (const e of entries) {
    e.dataOff = dataCursor;
    dataCursor += e.maxLen;
  }

  const size = Math.max(dataTableStart + dataCursor, 0x600);
  const sfo = new Uint8Array(size);
  const dv = new DataView(sfo.buffer);

  // Header: "\0PSF", version 1.1, table offsets, entry count (all LE).
  sfo[0] = 0x00;
  sfo[1] = 0x50;
  sfo[2] = 0x53;
  sfo[3] = 0x46;
  dv.setUint32(4, 0x00000101, true);
  dv.setUint32(8, keyTableStart, true);
  dv.setUint32(12, dataTableStart, true);
  dv.setUint32(16, entries.length, true);

  // Index entries (data_fmt is stored big-endian on disk; the rest LE).
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const off = HEADER + i * 16;
    const dataLen = e.fmt === FMT_INT32 ? 4 : e.str === null ? 16 : (e.str?.length ?? 0);
    dv.setUint16(off, e.keyOff ?? 0, true);
    dv.setUint16(off + 2, e.fmt, false);
    dv.setUint32(off + 4, dataLen, true);
    dv.setUint32(off + 8, e.maxLen, true);
    dv.setUint32(off + 12, e.dataOff ?? 0, true);
  }

  // Key table.
  for (const e of entries) {
    for (let j = 0; j < e.key.length; j++) {
      sfo[keyTableStart + (e.keyOff ?? 0) + j] = e.key.charCodeAt(j);
    }
    // null terminator already zero
  }

  // Data table.
  for (const e of entries) {
    const doff = dataTableStart + (e.dataOff ?? 0);
    if (e.key === 'ACCOUNT_ID') {
      if (accountIdHex) {
        const clean = accountIdHex.replace(/[^0-9a-fA-F]/g, '').padEnd(32, '0');
        sfo.set(fromHex(clean), doff);
      }
    } else if (e.fmt === FMT_INT32) {
      dv.setUint32(doff, e.int ?? 0, true);
    } else if (e.str) {
      for (let j = 0; j < e.str.length; j++) {
        sfo[doff + j] = e.str.charCodeAt(j) & 0xff;
      }
    }
  }

  // Profile number at the game-specific offset.
  sfo[0x570] = profileNumber & 0xff;
  return sfo;
}

/**
 * Build a minimal PARAM.SFO (compatible with existing test infrastructure).
 * @param {number} profileNumber
 * @returns {Uint8Array}
 */
export function createMinimalSfo(profileNumber = 42) {
  const sfo = new Uint8Array(0x600);
  sfo[0] = 0x00;
  sfo[1] = 0x50;
  sfo[2] = 0x53;
  sfo[3] = 0x46; // "\0PSF"
  sfo[0x570] = profileNumber & 0xff;
  return sfo;
}

// ---------------------------------------------------------------------------
// Secondary file (04USER.DAT)
// ---------------------------------------------------------------------------

/**
 * Create a blank secondary file (04USER.DAT).
 * @returns {Uint8Array}
 */
export function createSecondaryFile() {
  return new Uint8Array(0x800);
}

// ---------------------------------------------------------------------------
// Save folder builders (rawFiles Map format for openSave)
// ---------------------------------------------------------------------------

/**
 * Build the filename variants for a given slot.
 * @param {number} slot  1-based slot number
 * @returns {{primary: string, backup: string}}
 */
function getSlotFilenames(slot) {
  if (slot === 1) {
    return { primary: 'USER.DAT', backup: '2USER.DAT' };
  }
  const s = slot - 1;
  return { primary: `0${s}USER.DAT`, backup: `20${s}USER.DAT` };
}

/**
 * Build an unencrypted save folder as a rawFiles Map.
 *
 * @param {number[]} slots  array of 1-based slot numbers
 * @param {{profileNumber?: number, accountId?: string, realisticSfo?: boolean, assets?: boolean}} [opts]
 * @returns {Map<string, {name: string, bytes: Uint8Array}>}
 */
export function createUnencryptedSaveFolder(slots, opts = {}) {
  const profileNumber = opts.profileNumber ?? 42;
  const sfo = opts.realisticSfo
    ? createRealisticSfo(profileNumber, opts.accountId)
    : createMinimalSfo(profileNumber);

  const files = new Map();
  files.set('param.sfo', { name: 'PARAM.SFO', bytes: sfo });
  files.set('04user.dat', { name: '04USER.DAT', bytes: createSecondaryFile() });

  for (const slot of slots) {
    const userDat = createPopulatedUserDat(slot);
    const { primary, backup } = getSlotFilenames(slot);
    files.set(primary.toLowerCase(), { name: primary, bytes: userDat });
    // Backup file: a copy with distinct content so it's clearly separate
    files.set(backup.toLowerCase(), { name: backup, bytes: new Uint8Array(userDat) });
  }

  if (opts.assets) {
    files.set('icon0.png', { name: 'ICON0.PNG', bytes: createMockAsset(0x89, 200) });
    files.set('pic1.png', { name: 'PIC1.PNG', bytes: createMockAsset(0xff, 1000) });
  }

  return files;
}

/**
 * Build an encrypted save folder as a rawFiles Map.
 *
 * Encrypts each USER.DAT variant and creates a PARAM.PFD.
 *
 * @param {number[]} slots  array of 1-based slot numbers
 * @param {{profileNumber?: number, accountId?: string, realisticSfo?: boolean, assets?: boolean}} [opts]
 * @returns {Map<string, {name: string, bytes: Uint8Array}>}
 */
export function createEncryptedSaveFolder(slots, opts = {}) {
  const profileNumber = opts.profileNumber ?? 42;
  const sfo = opts.realisticSfo
    ? createRealisticSfo(profileNumber, opts.accountId)
    : createMinimalSfo(profileNumber);

  // Build plaintext map
  const plaintext = new Map();
  plaintext.set('param.sfo', sfo);

  const secondary = createSecondaryFile();
  plaintext.set('04user.dat', secondary);

  const slotFiles = [];
  for (const slot of slots) {
    const userDat = createPopulatedUserDat(slot);
    const { primary, backup } = getSlotFilenames(slot);
    plaintext.set(primary.toLowerCase(), userDat);
    plaintext.set(backup.toLowerCase(), new Uint8Array(userDat));
    slotFiles.push({ primary, backup });
  }

  // Build PFD file list (only USER.DAT files + PARAM.SFO go in PFD)
  const fileList = [];
  fileList.push({ name: 'PARAM.SFO', size: sfo.length });
  fileList.push({ name: '04USER.DAT', size: secondary.length });
  for (const { primary, backup } of slotFiles) {
    fileList.push({ name: primary, size: plaintext.get(primary.toLowerCase()).length });
    fileList.push({ name: backup, size: plaintext.get(backup.toLowerCase()).length });
  }

  // Create PFD
  const pfd = createPfdForFiles(fileList, SECURE_ID);

  // Encrypt all files
  const encMap = new Map();
  encMap.set('param.sfo', sfo); // SFO is NOT encrypted
  for (const [lowerName, plainBytes] of plaintext) {
    if (lowerName === 'param.sfo') continue;
    const entryName = lowerName.toUpperCase().replace('.DAT', '.DAT');
    // Use the original case filename for PFD lookup
    const originalName =
      fileList.find((f) => f.name.toLowerCase() === lowerName)?.name || entryName;
    encMap.set(lowerName, encryptFile(plainBytes, originalName, pfd, true));
  }

  // Compute all PFD hashes
  validAllParamHashes(encMap, true, pfd);
  const pfdBytes = getParamPfdCombinedData(pfd);

  // Build rawFiles Map
  const files = new Map();
  files.set('param.sfo', { name: 'PARAM.SFO', bytes: sfo });
  files.set('param.pfd', { name: 'PARAM.PFD', bytes: pfdBytes });

  for (const [lowerName, encBytes] of encMap) {
    if (lowerName === 'param.sfo') continue;
    const originalName =
      fileList.find((f) => f.name.toLowerCase() === lowerName)?.name || lowerName;
    files.set(lowerName, { name: originalName, bytes: encBytes });
  }

  if (opts.assets) {
    files.set('icon0.png', { name: 'ICON0.PNG', bytes: createMockAsset(0x89, 200) });
    files.set('pic1.png', { name: 'PIC1.PNG', bytes: createMockAsset(0xff, 1000) });
  }

  return files;
}

/**
 * Create a mock asset file (PNG-like) with a given header byte and size.
 * @param {number} firstByte
 * @param {number} size
 * @returns {Uint8Array}
 */
function createMockAsset(firstByte, size) {
  const buf = new Uint8Array(size);
  buf[0] = firstByte;
  // Fill with a recognizable pattern
  for (let i = 1; i < size; i++) {
    buf[i] = (i * 7 + 13) & 0xff;
  }
  return buf;
}

// ---------------------------------------------------------------------------
// Realistic folder builders (mimic real BLUS30443DEMONSS005 structure)
// ---------------------------------------------------------------------------

/**
 * Return all 3 rotational primary variants for a slot.
 *
 * DeS uses a triple-naming convention where each slot has 3 variants
 * arranged as a circular rotation [A → B → C → A].  The active file is
 * the one whose successor is missing.
 *
 * Slot 1: USER.DAT, 1USER.DAT, 2USER.DAT
 * Slot N: 0(N-1)USER.DAT, 10(N-1)USER.DAT, 20(N-1)USER.DAT
 *
 * @param {number} slot  1-based slot number
 * @returns {string[]} exactly 3 uppercase filenames in rotation order
 */
export function getPrimaryVariants(slot) {
  if (slot === 1) {
    return ['USER.DAT', '1USER.DAT', '2USER.DAT'];
  }
  const s = slot - 1;
  return [`0${s}USER.DAT`, `10${s}USER.DAT`, `20${s}USER.DAT`];
}

/**
 * Return all 3 rotational secondary (04USER.DAT) variants.
 * @returns {string[]}
 */
export function getSecondaryVariants() {
  return ['04USER.DAT', '104USER.DAT', '204USER.DAT'];
}

/**
 * Build a realistic save folder mimicking the real BLUS30443DEMONSS005
 * structure, with full 3-variant rotations for each slot.
 *
 * For each slot, exactly 2 of the 3 primary variants are created (the
 * third is absent, which is how the game designates the active file via
 * resolveRotational).  The secondary file uses 04USER.DAT only.
 *
 * By default this creates the exact file set from the real save:
 *   Slot 1: USER.DAT + 2USER.DAT (1USER.DAT absent)
 *   Slot 2: 01USER.DAT + 201USER.DAT (102USER.DAT absent)
 *   Slot 3: 02USER.DAT + 202USER.DAT (103USER.DAT absent)
 *   Slot 4: 03USER.DAT + 103USER.DAT (203USER.DAT absent)
 *   Shared: 04USER.DAT
 *
 * @param {number[]} slots  which slots to populate (1-4)
 * @param {{profileNumber?: number, accountId?: string, realisticSfo?: boolean, assets?: boolean, encrypted?: boolean}} [opts]
 * @returns {Map<string, {name: string, bytes: Uint8Array}>}
 */
export function createRealisticSaveFolder(slots, opts = {}) {
  if (opts.encrypted) {
    return createRealisticEncryptedFolder(slots, opts);
  }
  return createRealisticUnencryptedFolder(slots, opts);
}

/**
 * Options for the realistic save-folder builders.
 * @typedef {Object} RealisticFolderOptions
 * @property {number} [profileNumber]
 * @property {boolean} [realisticSfo]
 * @property {string} [accountId]
 * @property {boolean} [encrypted]
 * @property {boolean} [assets]
 */

/**
 * Build a realistic unencrypted folder with full rotational variants.
 * @param {number[]} slots
 * @param {RealisticFolderOptions} [opts]
 * @returns {Map<string, {name: string, bytes: Uint8Array}>}
 */
function createRealisticUnencryptedFolder(slots, opts = {}) {
  const profileNumber = opts.profileNumber ?? 42;
  const sfo = opts.realisticSfo
    ? createRealisticSfo(profileNumber, opts.accountId)
    : createMinimalSfo(profileNumber);

  const files = new Map();
  files.set('param.sfo', { name: 'PARAM.SFO', bytes: sfo });

  // Secondary file
  const secondary = createSecondaryFile();
  files.set('04user.dat', { name: '04USER.DAT', bytes: secondary });

  for (const slot of slots) {
    const userDat = createPopulatedUserDat(slot);
    const variants = getPrimaryVariants(slot);
    // Create variants 0 and 2 (skip variant 1) → variant 0 is active
    // because its successor (variant 1) is absent.
    files.set(variants[0].toLowerCase(), { name: variants[0], bytes: userDat });
    files.set(variants[2].toLowerCase(), { name: variants[2], bytes: new Uint8Array(userDat) });
  }

  if (opts.assets) {
    files.set('icon0.png', { name: 'ICON0.PNG', bytes: createMockAsset(0x89, 107203) });
    files.set('pic1.png', { name: 'PIC1.PNG', bytes: createMockAsset(0xff, 847976) });
  }

  return files;
}

/**
 * Build a realistic encrypted folder with full rotational variants.
 * @param {number[]} slots
 * @param {RealisticFolderOptions} [opts]
 * @returns {Map<string, {name: string, bytes: Uint8Array}>}
 */
function createRealisticEncryptedFolder(slots, opts = {}) {
  const profileNumber = opts.profileNumber ?? 42;
  const sfo = opts.realisticSfo
    ? createRealisticSfo(profileNumber, opts.accountId)
    : createMinimalSfo(profileNumber);

  // Build plaintext map
  const plaintext = new Map();
  plaintext.set('param.sfo', sfo);

  const secondary = createSecondaryFile();
  plaintext.set('04user.dat', secondary);

  const slotFileNames = [];
  for (const slot of slots) {
    const userDat = createPopulatedUserDat(slot);
    const variants = getPrimaryVariants(slot);
    // Create variants 0 and 2 (skip variant 1)
    plaintext.set(variants[0].toLowerCase(), userDat);
    plaintext.set(variants[2].toLowerCase(), new Uint8Array(userDat));
    slotFileNames.push(variants[0], variants[2]);
  }

  // Build PFD file list
  const fileList = [];
  fileList.push({ name: 'PARAM.SFO', size: sfo.length });
  fileList.push({ name: '04USER.DAT', size: secondary.length });
  for (const name of slotFileNames) {
    fileList.push({ name, size: plaintext.get(name.toLowerCase()).length });
  }

  // Create PFD
  const pfd = createPfdForFiles(fileList, SECURE_ID);

  // Encrypt all files
  const encMap = new Map();
  encMap.set('param.sfo', sfo);
  for (const [lowerName, plainBytes] of plaintext) {
    if (lowerName === 'param.sfo') continue;
    const originalName =
      fileList.find((f) => f.name.toLowerCase() === lowerName)?.name || lowerName;
    encMap.set(lowerName, encryptFile(plainBytes, originalName, pfd, true));
  }

  validAllParamHashes(encMap, true, pfd);
  const pfdBytes = getParamPfdCombinedData(pfd);

  // Build rawFiles Map
  const files = new Map();
  files.set('param.sfo', { name: 'PARAM.SFO', bytes: sfo });
  files.set('param.pfd', { name: 'PARAM.PFD', bytes: pfdBytes });

  for (const [lowerName, encBytes] of encMap) {
    if (lowerName === 'param.sfo') continue;
    const originalName =
      fileList.find((f) => f.name.toLowerCase() === lowerName)?.name || lowerName;
    files.set(lowerName, { name: originalName, bytes: encBytes });
  }

  if (opts.assets) {
    files.set('icon0.png', { name: 'ICON0.PNG', bytes: createMockAsset(0x89, 107203) });
    files.set('pic1.png', { name: 'PIC1.PNG', bytes: createMockAsset(0xff, 847976) });
  }

  return files;
}

/**
 * Create a stale (zeroed-out) USER.DAT buffer for testing the rotational
 * resolver's stale-file detection.
 *
 * A stale file is a leftover from a deleted character — the bytes are
 * zeroed out (including the sanity check at 0x170), so the reader would
 * reject it.  The resolver must skip stale files and pick the active one.
 *
 * @returns {Uint8Array}
 */
export function createStaleUserDat() {
  // All zeros — sanity check at 0x170 will be 0, so reader rejects it.
  return new Uint8Array(BUF_SIZE);
}

/**
 * Convert a Map<string, Uint8Array> (from filesToWrite) to the rawFiles
 * format expected by openSave: Map<string, {name, bytes}>.
 *
 * @param {Map<string, Uint8Array>} filesMap
 * @returns {Map<string, {name: string, bytes: Uint8Array}>}
 */
export function toRawFilesFormat(filesMap) {
  const rawFiles = new Map();
  for (const [name, bytes] of filesMap) {
    rawFiles.set(name.toLowerCase(), { name, bytes });
  }
  return rawFiles;
}
