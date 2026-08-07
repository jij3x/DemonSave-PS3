/**
 * Reader/writer tests.
 *
 * Since we have no real DeS save fixture, we create a synthetic USER.DAT
 * buffer large enough for all offsets, populate known fields, then verify
 * that read→write→read is idempotent.
 *
 * Tests are organized by area:
 *   1. Reader parsing — inventory, spells, deposit, error handling
 *   2. Reader/writer idempotency — core round-trip stability
 *   3. Writer edge cases — inventory, spells, deposit, misc fields
 *   4. Secondary file writer
 */
import { readSave } from '../../js/des-savefile/reader.js';
import {
  writeSave,
  writeSaveInPlace,
  writeSecondaryFileInPlace,
} from '../../js/des-savefile/writer.js';

import {
  rInt32BE,
  rUInt32BE,
  wInt32BE,
  wUInt32BE,
  wUInt16BE,
  wUInt8,
} from '../../js/lib/ps3-save-lib/index.js';
import * as O from '../../js/des-savefile/offsets.js';
import * as db from '../../js/des-db/index.js';
import { BUF_SIZE, makeBlankSave, writeInvRecord, fillDepositEmpty } from './helpers.js';
import { setBad } from '../helpers.js';

const WEAPON_IDS = db.getItemIdsByCategory('weapons');
const ARMOR_IDS = db.getItemIdsByCategory('armor');
const RING_IDS = db.getItemIdsByCategory('rings');
const ITEM_IDS = db.getItemIdsByCategory('goods');
const SPELL_IDS = db.getItemIdsByCategory('spells');

/* ========================================================================
 * 1. Reader parsing tests
 * ==================================================================== */

describe('reader: inventory parsing', () => {
  // All four inventory categories follow the same parse pattern — only the
  // type byte, item ID, and count differ.  One test.each covers them all.
  test.each([
    { type: 0x00000000, cat: 'weapons', id: WEAPON_IDS[2], count: 1 },
    { type: 0x10000000, cat: 'armor', id: ARMOR_IDS[0], count: 1 },
    { type: 0x20000000, cat: 'rings', id: RING_IDS[1], count: 1 },
    { type: 0x40000000, cat: 'goods', id: ITEM_IDS[2], count: 50 },
  ])('reads $cat inventory item', ({ type, cat, id, count }) => {
    let buf = makeBlankSave();
    wUInt32BE(buf, O.INV_COUNT, 1);
    writeInvRecord(buf, 0, type, id, count, 0, 0, 0, 0x01000000);
    const m = readSave(buf);
    expect(m[cat]).toHaveLength(1);
    expect(m[cat][0].itemId).toBe(id);
    expect(m[cat][0].count).toBe(count);
  });

  test('throws on unknown inventory type', () => {
    let buf = makeBlankSave();
    wUInt32BE(buf, O.INV_COUNT, 1);
    writeInvRecord(buf, 0, 0x30000000, 0x1234, 1, 0, 0, 0, 0x01000000);
    expect(() => readSave(buf)).toThrow(/Unknown inventory type 0x30000000/);
  });

  test('throws when idx1 exceeds INV_SLOTS (corrupt/encrypted data)', () => {
    let buf = makeBlankSave();
    wUInt32BE(buf, O.INV_COUNT, 1);
    // idx1 = INV_SLOTS (0x800) — one past the max valid index
    writeInvRecord(buf, 0, 0x00000000, WEAPON_IDS[2], 1, O.INV_SLOTS, 0, 0, 0x01000000);
    expect(() => readSave(buf)).toThrow('Unexpected data');
  });
});

describe('reader: spell parsing', () => {
  test('reads spells with correct itemId', () => {
    let buf = makeBlankSave();
    wUInt32BE(buf, O.SPELL_COUNT, 2);

    // Spell 0
    wUInt32BE(buf, O.SPELL_BASE + 0 * O.SPELL_STRIDE + O.SPELL_STATUS_OFFSET, 3); // Memorized
    wUInt32BE(buf, O.SPELL_BASE + 0 * O.SPELL_STRIDE + O.SPELL_ID_OFFSET, SPELL_IDS[6]); // Soul Arrow
    wUInt32BE(buf, O.SPELL_BASE + 0 * O.SPELL_STRIDE + O.SPELL_MISC1_OFFSET, 0);
    wUInt32BE(buf, O.SPELL_BASE + 0 * O.SPELL_STRIDE + O.SPELL_MISC2_OFFSET, 0);

    // Spell 1
    wUInt32BE(buf, O.SPELL_BASE + 1 * O.SPELL_STRIDE + O.SPELL_STATUS_OFFSET, 2); // Known
    wUInt32BE(buf, O.SPELL_BASE + 1 * O.SPELL_STRIDE + O.SPELL_ID_OFFSET, SPELL_IDS[7]); // Flame Toss
    wUInt32BE(buf, O.SPELL_BASE + 1 * O.SPELL_STRIDE + O.SPELL_MISC1_OFFSET, 1);
    wUInt32BE(buf, O.SPELL_BASE + 1 * O.SPELL_STRIDE + O.SPELL_MISC2_OFFSET, 2);

    const m = readSave(buf);
    expect(m.spells).toHaveLength(2);
    expect(m.spells[0].itemId).toBe(SPELL_IDS[6]);
    expect(m.spells[0].status).toBe(3);
    expect(m.spells[1].itemId).toBe(SPELL_IDS[7]);
    expect(m.spells[1].status).toBe(2);
    expect(m.spells[1].misc1).toBe(1);
  });
});

describe('reader: deposit parsing', () => {
  test('skips deposit entries with invalid type (0xFF and unknown)', () => {
    let buf = makeBlankSave();
    fillDepositEmpty(buf);

    // First deposit entry is a valid weapon
    const b0 = O.DEPOSIT_BASE;
    wUInt8(buf, b0 + 4, 0x00); // weapon
    buf[b0 + 5] = 0x00;
    buf[b0 + 6] = 0x27;
    buf[b0 + 7] = 0x10; // itemId = 0x2710
    buf[b0 + 12] = 1; // count
    // Set DEPOSIT_COUNT so the reader's early-exit finds this entry.
    wUInt32BE(buf, O.DEPOSIT_COUNT, 1);

    // Third deposit entry is unknown type (0x99)
    const b2 = O.DEPOSIT_BASE + 2 * O.DEPOSIT_STRIDE;
    wUInt8(buf, b2 + 4, 0x99);

    const m = readSave(buf);
    expect(m.deposit).toHaveLength(1);
    expect(m.deposit[0].category).toBe('weapons');
  });
});

describe('reader: error handling', () => {
  test('throws on deleted character (sanity check is zero)', () => {
    let buf = new Uint8Array(BUF_SIZE); // all zeros → sanity check = 0
    expect(() => readSave(buf)).toThrow('Unexpected zeroes');
  });
});

/* ========================================================================
 * 1b. Reader: encrypted/corrupt data detection
 * ==================================================================== */

describe('reader: encrypted data detection', () => {
  /**
   * Create a buffer that passes the sanity check (non-zero at 0x170) but
   * has random-looking data everywhere else — simulating encrypted ciphertext
   * that was incorrectly treated as plaintext.
   */
  function makeEncryptedLikeBuffer() {
    let buf = new Uint8Array(BUF_SIZE);
    // Fill with pseudo-random bytes (deterministic for reproducibility)
    for (let i = 0; i < BUF_SIZE; i++) {
      buf[i] = (i * 137 + 43) & 0xff;
    }
    // Ensure sanity check is non-zero (encrypted data typically is)
    buf[O.SANITY_CHECK] = 0x01;
    buf[O.SANITY_CHECK + 1] = 0x7e;
    buf[O.SANITY_CHECK + 2] = 0xc7;
    buf[O.SANITY_CHECK + 3] = 0xc6;
    return buf;
  }

  test('allows world=0xFF (valid in some saves)', () => {
    let buf = makeBlankSave();
    buf[O.WORLD] = 0xff; // world=0xFF is valid (seen in real saves)
    const m = readSave(buf);
    expect(m.world).toBe(0xff);
  });

  test('throws early when invCount exceeds INV_SLOTS', () => {
    let buf = makeBlankSave();
    wUInt32BE(buf, O.INV_COUNT, 0xa6b9b6e6); // ~2.8 billion (real encrypted value)
    expect(() => readSave(buf)).toThrow('Unexpected data');
  });

  test('throws early when spellCount is implausibly large', () => {
    let buf = makeBlankSave();
    wUInt32BE(buf, O.SPELL_COUNT, 0x6b35941e); // ~1.8 billion (real encrypted value)
    expect(() => readSave(buf)).toThrow('Unexpected data');
  });

  test('throws on fully random (encrypted-like) buffer', () => {
    let buf = makeEncryptedLikeBuffer();
    expect(() => readSave(buf)).toThrow('Unexpected data');
  });

  test('does NOT throw for valid plaintext values', () => {
    // Real plaintext 2USER.DAT: world=4, invCount=100, spellCount=14
    let buf = makeBlankSave();
    buf[O.WORLD] = 4;
    wUInt32BE(buf, O.INV_COUNT, 100);
    wUInt32BE(buf, O.SPELL_COUNT, 14);
    expect(() => readSave(buf)).not.toThrow();
  });

  test('allows world=0 (Nexus is valid)', () => {
    let buf = makeBlankSave();
    buf[O.WORLD] = 0;
    expect(() => readSave(buf)).not.toThrow();
  });

  test('throws on truncated buffer (smaller than MIN_SAVE_SIZE)', () => {
    // Top-level buffer-size guard catches truncated/corrupt files before
    // any parsing begins.
    let buf = makeBlankSave();
    const smallSize = 0x400; // well below MIN_SAVE_SIZE
    const trimmedBuf = buf.slice(0, smallSize);
    wUInt32BE(trimmedBuf, O.INV_COUNT, 100); // would pass the early check
    // Fill inventory area with 0xFFFFFFFF types (would be skipped by while-loop)
    for (let i = O.INV_TYPE_BASE; i < smallSize; i += 4) {
      wUInt32BE(trimmedBuf, i, 0xffffffff);
    }
    expect(() => readSave(trimmedBuf)).toThrow('Save buffer too small');
  });
});

/* ========================================================================
 * 2. Reader/writer idempotency
 * ==================================================================== */

describe('reader/writer idempotency', () => {
  test('read → write → read produces identical model (blank save)', () => {
    let buf = makeBlankSave();
    const m1 = readSave(buf);
    // Write it back
    buf = writeSave(buf, m1);
    // Read again
    const m2 = readSave(buf);

    // The model should be stable (fields match themselves)
    expect(m2.souls).toBe(m1.souls);
    expect(m2.vit).toBe(m1.vit);
    expect(m2.name).toBe(m1.name);
    expect(m2.world).toBe(m1.world);
  });

  test('stat writes are dual (base + effective)', () => {
    let buf = makeBlankSave();
    const m = readSave(buf);
    m.vit = 50;
    m.str = 30;
    buf = writeSave(buf, m);
    // Base and effective should both be 50/30
    expect(rInt32BE(buf, O.VIT_BASE)).toBe(50);
    expect(rInt32BE(buf, O.VIT)).toBe(50);
    expect(rInt32BE(buf, O.STR_BASE)).toBe(30);
    expect(rInt32BE(buf, O.STR)).toBe(30);
  });

  test('vitals round-trip through read→write unchanged', () => {
    let buf = makeBlankSave();
    // Pre-set vitals in the buffer
    wInt32BE(buf, O.CURR_MAX_HP, 600);
    wInt32BE(buf, O.CURR_MAX_MP, 40);
    wInt32BE(buf, O.CURR_MAX_STAM, 120);
    wInt32BE(buf, O.MAX_HP, 600);
    wInt32BE(buf, O.MAX_MP, 40);
    wInt32BE(buf, O.MAX_STAM, 120);

    const m = readSave(buf);
    // Reader should see the values
    expect(m.currMaxHP).toBe(600);
    expect(m.maxHP).toBe(600);

    // Writer writes vitals back — values preserved by idempotent round-trip
    buf = writeSave(buf, m);
    expect(rInt32BE(buf, O.CURR_MAX_HP)).toBe(600);
    expect(rInt32BE(buf, O.MAX_HP)).toBe(600);
    expect(rInt32BE(buf, O.CURR_MAX_MP)).toBe(40);
    expect(rInt32BE(buf, O.MAX_MP)).toBe(40);
    expect(rInt32BE(buf, O.CURR_MAX_STAM)).toBe(120);
    expect(rInt32BE(buf, O.MAX_STAM)).toBe(120);
  });

  test('souls and soul memory round-trip', () => {
    let buf = makeBlankSave();
    const m = readSave(buf);
    m.souls = 99999;
    m.soulMem = 123456;
    buf = writeSave(buf, m);
    const m2 = readSave(buf);
    expect(m2.souls).toBe(99999);
    expect(m2.soulMem).toBe(123456);
  });

  test('tendency dual writes', () => {
    let buf = makeBlankSave();
    const m = readSave(buf);
    m.w1Tendency = 50.5;
    m.nexusTendency = -20.0;
    buf = writeSave(buf, m);
    const m2 = readSave(buf);
    expect(m2.w1Tendency).toBeCloseTo(50.5, 1);
    expect(m2.nexusTendency).toBeCloseTo(-20.0, 1);
  });

  // Both directions of the inverted bit 6 must round-trip:
  //   sealed=true  → bit 6 CLEARED (0x40 absent)
  //   sealed=false → bit 6 SET     (0x40 present)
  test.each([
    { label: 'sealed=true (bit cleared)', setTo: true, expectBitAbsent: true },
    { label: 'sealed=false (bit set)', setTo: false, expectBitAbsent: false },
  ])('arch sealed flag: $label', ({ setTo, expectBitAbsent }) => {
    let buf = makeBlankSave();
    const m = readSave(buf);
    m.archSealed = setTo;
    buf = writeSave(buf, m);
    expect((buf[O.ARCH_SEALED] & 0x40) === 0).toBe(expectBitAbsent);

    const m2 = readSave(buf);
    expect(m2.archSealed).toBe(setTo);
  });

  // NPC flags round-trip: two test cases cover both mixed and all-true
  // combinations.  The all-true case also covers all bit-set arms.
  test.each([
    {
      label: 'mixed values',
      sageFreke: { friendly: true, hostile: false, dead: true },
      thomas: { friendly: true, hostile: false, dead: false },
      boldwin: { friendly: false, hostile: true, dead: false },
    },
    {
      label: 'all true (all bit-set arms)',
      sageFreke: { friendly: true, hostile: true, dead: true },
      thomas: { friendly: true, hostile: true, dead: true },
      boldwin: { friendly: true, hostile: true, dead: true },
    },
  ])('NPC flags round-trip: $label', ({ sageFreke, thomas, boldwin }) => {
    let buf = makeBlankSave();
    const m = readSave(buf);
    m.sageFreke = sageFreke;
    m.thomas = thomas;
    m.boldwin = boldwin;
    buf = writeSave(buf, m);
    const m2 = readSave(buf);
    expect(m2.sageFreke).toEqual(sageFreke);
    expect(m2.thomas).toEqual(thomas);
    expect(m2.boldwin).toEqual(boldwin);
  });

  test('deposit (Thomas storage) round-trip', () => {
    let buf = makeBlankSave();
    const m = readSave(buf);
    // Two categories exercise the multi-item round-trip: weapons + rings.
    // Armor/goods deposit read-back is covered by the writer deposit
    // edge-case tests below; the rings category mapping (reader 0x20 case)
    // is only exercised here, so it stays.
    m.deposit = [
      {
        category: 'weapons',
        itemId: WEAPON_IDS[2],
        count: 1,
        durability: 300,
        unknown1: 0,
        sortOrder: 0,
        flags: [0x21, 0, 0, 0, 0, 0x01, 0x2c],
      },
      {
        category: 'rings',
        itemId: RING_IDS[1],
        count: 1,
        durability: 0,
        unknown1: 0,
        sortOrder: 0,
        flags: [0x21, 0, 0, 0, 0, 0, 0],
      },
    ];
    buf = writeSave(buf, m);
    const m2 = readSave(buf);
    expect(m2.deposit.length).toBe(2);
    expect(m2.deposit[0].category).toBe('weapons');
    expect(m2.deposit[0].itemId).toBe(WEAPON_IDS[2]);
    expect(m2.deposit[0].count).toBe(1);
    expect(m2.deposit[1].category).toBe('rings');
    expect(m2.deposit[1].itemId).toBe(RING_IDS[1]);
  });

  test('inventory count is written to both offsets', () => {
    let buf = makeBlankSave();
    const m = readSave(buf);
    // No items → count should be 0
    buf = writeSave(buf, m);
    expect(rInt32BE(buf, O.INV_COUNT)).toBe(0);
    // INV_COUNT_MIRROR is at 0x10360 — our buffer is large enough
    const dv = new DataView(buf.buffer);
    expect(dv.getUint32(O.INV_COUNT_MIRROR, false)).toBe(0);
  });
});

/* ========================================================================
 * 3. Writer edge cases — inventory, spells, deposit, misc fields
 * ==================================================================== */

describe('writer: inventory in-place update', () => {
  test('writes inventory item back at correct slot', () => {
    let buf = makeBlankSave();
    wUInt32BE(buf, O.INV_COUNT, 1);
    writeInvRecord(buf, 1, 0x00000000, WEAPON_IDS[2], 1, 0, 0, 0, 0x01000000);

    const m = readSave(buf);
    m.weapons[0].itemId = WEAPON_IDS[5];
    m.weapons[0].count = 10;
    buf = writeSave(buf, m);

    const m2 = readSave(buf);
    expect(m2.weapons[0].itemId).toBe(WEAPON_IDS[5]);
    expect(m2.weapons[0].count).toBe(10);
  });

  test('skips inventory items without _slot (writes as new item)', () => {
    let buf = makeBlankSave();
    const m = readSave(buf);
    // Provide all fields a merged model would have (mergeModel fills defaults)
    m.weapons.push({
      itemId: WEAPON_IDS[2],
      count: 1,
      _slot: undefined,
      idx1: 999,
      misc1: 0,
      idx2: 999,
      misc2: 0x01000000,
      durability: 300,
    });
    // writeSave returns a new buffer; we just verify it doesn't throw.
    writeSave(buf, m);
  });
});

describe('writer: spell round-trip', () => {
  test('writes spells with numeric status values', () => {
    let buf = makeBlankSave();
    const m = readSave(buf);
    m.spells = [
      { itemId: SPELL_IDS[6], status: 3, misc1: 0, misc2: 0 }, // Memorized
      { itemId: SPELL_IDS[7], status: 2, misc1: 0, misc2: 0 }, // Known
    ];
    buf = writeSave(buf, m);
    const m2 = readSave(buf);
    expect(m2.spells).toHaveLength(2);
    expect(m2.spells[0].status).toBe(3);
    expect(m2.spells[1].status).toBe(2);
  });

  test('throws on non-numeric spell status string', () => {
    let buf = makeBlankSave();
    const m = readSave(buf);
    setBad(m, 'spells', [{ itemId: SPELL_IDS[0], status: 'Bogus', misc1: 0, misc2: 0 }]);
    expect(() => writeSave(buf, m)).toThrow(/invalid numeric string/);
  });
});

/* ========================================================================
 * Writer: deposit edge cases
 * ==================================================================== */

describe('writer: deposit edge cases', () => {
  test('writes deposit weapon with preserved flags', () => {
    let buf = makeBlankSave();
    const m = readSave(buf);
    m.deposit = [
      {
        category: 'weapons',
        itemId: WEAPON_IDS[2],
        count: 1,
        durability: 300,
        unknown1: 0,
        sortOrder: 0x00100000,
        flags: [0x21, 0x00, 0x00, 0x00, 0x00, 0x01, 0x2c], // durability = 300
      },
    ];
    buf = writeSave(buf, m);
    const m2 = readSave(buf);
    expect(m2.deposit[0].category).toBe('weapons');
    expect(m2.deposit[0].itemId).toBe(WEAPON_IDS[2]);
  });

  test('throws when deposit armor has no durability and flags is empty', () => {
    let buf = makeBlankSave();
    const m = readSave(buf);
    m.deposit = [
      {
        category: 'armor',
        itemId: ARMOR_IDS[0],
        count: 1,
        durability: undefined, // no value
        unknown1: 0,
        sortOrder: 0,
        flags: [0, 0, 0, 0, 0, 0, 0], // also no durability data
      },
    ];
    expect(() => writeSave(buf, m)).toThrow(/missing durability/);
  });

  test('respects explicit durability=0 for deposit armor', () => {
    let buf = makeBlankSave();
    const m = readSave(buf);
    m.deposit = [
      {
        category: 'armor',
        itemId: ARMOR_IDS[0],
        count: 1,
        durability: 0, // explicit 0 — must NOT fall back to default
        unknown1: 0,
        sortOrder: 0,
        flags: [0, 0, 0, 0, 0, 0, 0],
      },
    ];
    buf = writeSave(buf, m);
    const m2 = readSave(buf);
    expect(m2.deposit[0].durability).toBe(0); // user's explicit 0
  });

  test('throws on unknown deposit category', () => {
    let buf = makeBlankSave();
    const m = readSave(buf);
    m.deposit = [
      { category: 'invalid', itemId: 0, count: 1, unknown1: 0, sortOrder: 0, flags: [] },
    ];
    expect(() => writeSave(buf, m)).toThrow(/Unknown deposit category/);
  });

  test('throws when deposit exceeds DEPOSIT_MAX_ENTRIES', () => {
    let buf = makeBlankSave();
    const m = readSave(buf);
    // Create one more than the max
    m.deposit = Array(O.DEPOSIT_MAX_ENTRIES + 1).fill({
      category: 'goods',
      itemId: ITEM_IDS[2],
      count: 1,
      unknown1: 0,
      sortOrder: 0,
      flags: [0x21, 0, 0, 0, 0, 0, 0],
    });
    expect(() => writeSave(buf, m)).toThrow(/Deposit is full/);
  });

  test('throws when deposit itemId exceeds 24-bit', () => {
    let buf = makeBlankSave();
    const m = readSave(buf);
    m.deposit = [
      {
        category: 'weapons',
        itemId: 0x1000000,
        count: 1,
        unknown1: 0,
        sortOrder: 0,
        flags: [0x21],
      },
    ];
    expect(() => writeSave(buf, m)).toThrow(/exceeds 24-bit limit/);
  });

  test('deposit weapon uses Tier 2 durability fallback from flags', () => {
    let buf = makeBlankSave();
    const m = readSave(buf);
    // No named durability, but flags[5..6] = 0x012C (300)
    m.deposit = [
      {
        category: 'weapons',
        itemId: WEAPON_IDS[2],
        count: 1,
        unknown1: 0,
        sortOrder: 0,
        durability: undefined,
        flags: [0x21, 0, 0, 0, 0, 0x01, 0x2c],
      },
    ];
    buf = writeSave(buf, m);
    const m2 = readSave(buf);
    // Durability from flags should be 300
    expect(m2.deposit[0].durability).toBe(0x012c);
  });

  test('deposit weapon throws when durability is null and flags empty', () => {
    let buf = makeBlankSave();
    const m = readSave(buf);
    m.deposit = [
      {
        category: 'weapons',
        itemId: WEAPON_IDS[2],
        count: 1,
        unknown1: 0,
        sortOrder: 0,
        durability: null,
        flags: [],
      },
    ];
    expect(() => writeSave(buf, m)).toThrow(/missing durability/);
  });

  test('deposit goods without durability field writes fine', () => {
    let buf = makeBlankSave();
    const m = readSave(buf);
    m.deposit = [
      {
        category: 'goods',
        itemId: ITEM_IDS[2],
        count: 99,
        unknown1: 0,
        sortOrder: 0,
        flags: [0x21],
      },
    ];
    buf = writeSave(buf, m);
    const m2 = readSave(buf);
    expect(m2.deposit).toHaveLength(1);
    expect(m2.deposit[0].count).toBe(99);
  });

  test('deposit preserves non-zero flag byte from flags[0]', () => {
    let buf = makeBlankSave();
    const m = readSave(buf);
    m.deposit = [
      {
        category: 'rings',
        itemId: RING_IDS[1],
        count: 1,
        unknown1: 0,
        sortOrder: 0,
        flags: [0x33, 0, 0, 0, 0, 0, 0],
      },
    ];
    buf = writeSave(buf, m);
    // Verify flag byte at deposit entry offset
    const b = O.DEPOSIT_BASE + 13;
    expect(buf[b]).toBe(0x33);
  });

  test('deposit with null unknown1 uses ?? 0', () => {
    let buf = makeBlankSave();
    const m = readSave(buf);
    m.deposit = [
      {
        category: 'weapons',
        itemId: WEAPON_IDS[2],
        count: 1,
        durability: 300,
        unknown1: null,
        sortOrder: 0,
        flags: [0x21, 0, 0, 0, 0, 0x01, 0x2c],
      },
    ];
    buf = writeSave(buf, m);
    const m2 = readSave(buf);
    expect(m2.deposit[0].unknown1).toBe(0);
  });

  test('deposit without flags array defaults pad bytes to 0x00', () => {
    let buf = makeBlankSave();
    const m = readSave(buf);
    m.deposit = [
      {
        category: 'weapons',
        itemId: WEAPON_IDS[2],
        count: 1,
        durability: 300,
        unknown1: 0,
        sortOrder: 0,
        flags: undefined,
      },
    ];
    buf = writeSave(buf, m);
    const m2 = readSave(buf);
    expect(m2.deposit[0].category).toBe('weapons');
    // The pad bytes should be 0x00 (fallback)
    expect(m2.deposit[0].flags[1]).toBe(0);
    expect(m2.deposit[0].flags[2]).toBe(0);
    expect(m2.deposit[0].flags[3]).toBe(0);
    expect(m2.deposit[0].flags[4]).toBe(0);
  });
});

/* ========================================================================
 * Writer: misc fields + val() edge cases
 * ==================================================================== */

describe('writer: misc fields', () => {
  test('hair color round-trip', () => {
    let buf = makeBlankSave();
    const m = readSave(buf);
    m.hairR = 0.5;
    m.hairG = 0.25;
    m.hairB = 0.75;
    buf = writeSave(buf, m);
    const m2 = readSave(buf);
    expect(m2.hairR).toBeCloseTo(0.5, 2);
    expect(m2.hairG).toBeCloseTo(0.25, 2);
    expect(m2.hairB).toBeCloseTo(0.75, 2);
  });

  test('clear count round-trip', () => {
    let buf = makeBlankSave();
    const m = readSave(buf);
    m.clearCount = 3;
    buf = writeSave(buf, m);
    const m2 = readSave(buf);
    expect(m2.clearCount).toBe(3);
  });

  test('throws when durability idx1 produces out-of-bounds offset', () => {
    let buf = makeBlankSave();
    const m = readSave(buf);
    // idx1 = 0xFFFF would compute durability offset far beyond buffer.
    // For existing items (_slot defined), the writer preserves the on-disk
    // idx1 — a corrupt save with idx1=0xFFFF must be caught at write time.
    // (New items always get a writer-assigned valid idx1, so they can't
    // trigger this path.)
    m.weapons.push({
      itemId: WEAPON_IDS[2],
      count: 1,
      _slot: 0,
      idx1: 0xffff,
      misc1: 0,
      idx2: 0,
      misc2: 0x01000000,
      durability: 300,
    });
    expect(() => writeSave(buf, m)).toThrow(/durability write out of bounds/);
  });
});

describe('writer: val() edge cases', () => {
  test('val() parses string values', () => {
    let buf = makeBlankSave();
    const m = readSave(buf);
    setBad(m, 'souls', '12345');
    setBad(m, 'vit', '99');
    buf = writeSave(buf, m);
    const m2 = readSave(buf);
    expect(m2.souls).toBe(12345);
    expect(m2.vit).toBe(99);
  });

  test('val() accepts trimmed numeric strings', () => {
    let buf = makeBlankSave();
    const m = readSave(buf);
    setBad(m, 'souls', '  42  ');
    buf = writeSave(buf, m);
    const m2 = readSave(buf);
    expect(m2.souls).toBe(42);
  });

  // All six val() rejection cases hit the same val() function
  // (writer.js:55-73); each triggers a distinct throw site. One test.each
  // covers them, keeping every sub-condition exercised.
  test.each([
    { label: 'NaN string', field: 'souls', value: 'notanumber', match: /invalid numeric string/ },
    { label: 'empty string', field: 'souls', value: '   ', match: /empty numeric string/ },
    { label: 'NaN number', field: 'vit', value: NaN, match: /NaN or Infinity/ },
    { label: 'Infinity number', field: 'souls', value: Infinity, match: /NaN or Infinity/ },
    { label: 'undefined value', field: 'souls', value: undefined, match: /expected number or string/ },
    { label: 'null value', field: 'vit', value: null, match: /expected number or string/ },
  ])('val() throws on $label', ({ field, value, match }) => {
    let buf = makeBlankSave();
    const m = readSave(buf);
    setBad(m, field, value);
    expect(() => writeSave(buf, m)).toThrow(match);
  });
});

/* ========================================================================
 * Writer: range validation
 * ==================================================================== */

describe('writer: range validation', () => {
  // U8 range check (assertU8): overflow, underflow, and fractional values
  // all hit the same `out of range [0, 255]` branch (writer.js:85).
  test.each([
    { label: 'overflow (world > 255)', field: 'world', value: 256 },
    { label: 'underflow (gender < 0)', field: 'gender', value: -1 },
    { label: 'fractional (world = 3.5)', field: 'world', value: 3.5 },
  ])('throws on U8 $label', ({ field, value }) => {
    let buf = makeBlankSave();
    const m = readSave(buf);
    m[field] = value;
    expect(() => writeSave(buf, m)).toThrow(/out of range \[0, 255\]/);
  });

  // U16 range check (assertU16): misc1 is a U16 field on inventory items.
  // Both fractional and overflow hit `out of range [0, 65535]` (writer.js:100).
  test.each([
    { label: 'fractional misc1', misc1: 3.5 },
    { label: 'misc1 overflow', misc1: 65536 },
  ])('throws on U16 $label', ({ misc1 }) => {
    let buf = makeBlankSave();
    const m = readSave(buf);
    m.weapons.push({
      itemId: WEAPON_IDS[2],
      count: 1,
      _slot: undefined,
      idx1: 0,
      misc1,
      idx2: 0,
      misc2: 0x01000000,
      durability: 300,
    });
    expect(() => writeSave(buf, m)).toThrow(/out of range \[0, 65535\]/);
  });

  // U32 range check (assertU32): overflow and fractional hit
  // `out of range [0, 4294967295]` (writer.js:115).
  test.each([
    { label: 'overflow (vit > 4294967295)', field: 'vit', value: 4294967296 },
    { label: 'fractional (vit = 3.5)', field: 'vit', value: 3.5 },
  ])('throws on U32 $label', ({ field, value }) => {
    let buf = makeBlankSave();
    const m = readSave(buf);
    m[field] = value;
    expect(() => writeSave(buf, m)).toThrow(/out of range \[0, 4294967295\]/);
  });

  test('accepts 0xFFFFFFFF as valid U32 (empty equipment slot)', () => {
    let buf = makeBlankSave();
    const m = readSave(buf);
    m.bolts = 0xffffffff;
    expect(() => writeSave(buf, m)).not.toThrow();
  });

  test('throws on name exceeding 16 characters', () => {
    let buf = makeBlankSave();
    const m = readSave(buf);
    m.name = '0123456789ABCDEFG'; // 17 chars
    expect(() => writeSave(buf, m)).toThrow(/exceeds 16 characters/);
  });

  test('surrogate pair characters round-trip (each half is a UTF-16 code unit)', () => {
    let buf = makeBlankSave();
    const m = readSave(buf);
    // U+10000 requires a surrogate pair in JS. Each half (D800, DC00) is
    // a separate UTF-16 code unit that gets stored as its own 2-byte pair.
    m.name = 'A\uD800\uDC00B';
    buf = writeSave(buf, m);
    const m2 = readSave(buf);
    expect(m2.name).toBe('A\uD800\uDC00B');
  });
});

/* ========================================================================
 * Writer: equipped slots (item IDs + pointer back-resolution)
 * ==================================================================== */

describe('writer: equipped slots', () => {
  test('writes all equipped item IDs to their offsets', () => {
    let buf = makeBlankSave();
    const m = readSave(buf);
    m.leftHand1 = WEAPON_IDS[1];
    m.rightHand1 = WEAPON_IDS[2];
    m.helmet = ARMOR_IDS[3];
    m.ring1 = RING_IDS[4];
    m.quickSlot1 = ITEM_IDS[5];
    m.hairstyle = 0x1234;

    buf = writeSave(buf, m);

    expect(rUInt32BE(buf, O.LH1)).toBe(WEAPON_IDS[1]);
    expect(rUInt32BE(buf, O.RH1)).toBe(WEAPON_IDS[2]);
    expect(rUInt32BE(buf, O.HELMET)).toBe(ARMOR_IDS[3]);
    expect(rUInt32BE(buf, O.RING1)).toBe(RING_IDS[4]);
    expect(rUInt32BE(buf, O.QUICK1)).toBe(ITEM_IDS[5]);
    expect(rUInt32BE(buf, O.HAIRSTYLE)).toBe(0x1234);
  });

  test('back-resolves pointer to inventory idx1 when equipped item is owned', () => {
    let buf = makeBlankSave();
    wUInt32BE(buf, O.INV_COUNT, 1);
    // Inventory item at slot 0 (the first slot the reader parses on a blank
    // buffer, whose zeroed type bytes read as type=0=weapon) with idx1=42.
    writeInvRecord(buf, 0, 0x00000000, WEAPON_IDS[1], 1, 42, 0x1016, 0, 0x01000000);

    const m = readSave(buf);
    expect(m.weapons[0].idx1).toBe(42); // sanity: reader parsed our item
    m.leftHand1 = WEAPON_IDS[1]; // equip the owned weapon

    buf = writeSave(buf, m);

    // LH1_PTR should now point at idx1=42
    expect(rUInt32BE(buf, O.LH1_PTR)).toBe(42);
    expect(rUInt32BE(buf, O.LH1)).toBe(WEAPON_IDS[1]);
  });

  test('writes 0xFFFFFFFF to both ID and pointer for empty slot', () => {
    let buf = makeBlankSave();
    const m = readSave(buf);
    m.bolts = 0xffffffff; // empty bolt slot

    buf = writeSave(buf, m);

    expect(rUInt32BE(buf, O.BOLTS)).toBe(0xffffffff);
    expect(rUInt32BE(buf, O.BOLT_PTR)).toBe(0xffffffff);
  });

  test('foreign equipped ID (not in inventory) leaves pointer untouched', () => {
    let buf = makeBlankSave();
    // Pre-set the pointer to an existing idx1
    wUInt32BE(buf, O.RH1_PTR, 99);
    const m = readSave(buf);
    m.rightHand1 = 0xdeadbeef; // an ID the player does not own

    buf = writeSave(buf, m);

    expect(rUInt32BE(buf, O.RH1)).toBe(0xdeadbeef);
    // Pointer should be UNCHANGED (no invented idx1)
    expect(rUInt32BE(buf, O.RH1_PTR)).toBe(99);
  });

  // ---- Pointer resolution (Rules 0-2) ----
  // These tests cover duplicate-item scenarios.  The writer resolves
  // pointers from the binary buffer only (no model-side pointer data):
  //   Rule 0: ID unchanged → keep existing pointer
  //   Rule 1: current pointer already correct → keep
  //   Rule 2: first-wins fallback

  test('genuine swap to duplicate item falls back to first-wins', () => {
    // Setup: RH1=Falchion (bound to idx1=50).  Inventory has 2 Kilijs
    // (idx1=5, 37).  User swaps RH1 → Kilij.  Since the old pointer (50)
    // points to a Falchion (not Kilij), Rule 1 doesn't apply.  Rule 2
    // (first-wins fallback) picks idx1=5.
    let buf = makeBlankSave();
    wUInt32BE(buf, O.INV_COUNT, 3);
    writeInvRecord(buf, 0, 0x00000000, WEAPON_IDS[2], 1, 50, 0x0ffc, 0, 0x01000000); // Falchion
    writeInvRecord(buf, 1, 0x00000000, WEAPON_IDS[1], 1, 5, 0x1005, 0, 0x01000000); // Kilij
    writeInvRecord(buf, 2, 0x00000000, WEAPON_IDS[1], 1, 37, 0x1005, 0, 0x01000000); // Kilij
    wUInt32BE(buf, O.RH1, WEAPON_IDS[2]);
    wUInt32BE(buf, O.RH1_PTR, 50);

    const m = readSave(buf);
    m.rightHand1 = WEAPON_IDS[1]; // swap to Kilij

    buf = writeSave(buf, m);

    expect(rUInt32BE(buf, O.RH1)).toBe(WEAPON_IDS[1]);
    // Rule 2: first-wins → idx1=5 (the first Kilij in inventory).
    expect(rUInt32BE(buf, O.RH1_PTR)).toBe(5);
  });

  test('Rule 1: ID unchanged preserves the game binding (no-op re-save)', () => {
    // Setup: 3 identical weapons (Kilij) at idx1 5, 37, 99.
    // The game has the RH1 pointer bound to idx1=37 (the middle one).
    // A no-op re-save (RH1 still = Kilij) must NOT rebind to idx1=5.
    let buf = makeBlankSave();
    wUInt32BE(buf, O.INV_COUNT, 3);
    writeInvRecord(buf, 0, 0x00000000, WEAPON_IDS[1], 1, 5, 0x1005, 0, 0x01000000);
    writeInvRecord(buf, 1, 0x00000000, WEAPON_IDS[1], 1, 37, 0x1005, 0, 0x01000000);
    writeInvRecord(buf, 2, 0x00000000, WEAPON_IDS[1], 1, 99, 0x1005, 0, 0x01000000);
    // Pre-set the game's binding: RH1=Kilij, RH1_PTR=37
    wUInt32BE(buf, O.RH1, WEAPON_IDS[1]);
    wUInt32BE(buf, O.RH1_PTR, 37);

    const m = readSave(buf);
    // No change to RH1 — the model value matches what's on disk.
    m.rightHand1 = WEAPON_IDS[1];

    buf = writeSave(buf, m);

    // Pointer must be preserved at 37, not rebound to 5 (first-wins).
    expect(rUInt32BE(buf, O.RH1)).toBe(WEAPON_IDS[1]);
    expect(rUInt32BE(buf, O.RH1_PTR)).toBe(37);
  });

  test('Rule 2: swap then swap-back preserves the original instance', () => {
    // Setup: RH1=Kilij bound to idx1=37.  Inventory also has a Falchion.
    // User swaps RH1 → Falchion → back to Kilij.  After the final save the
    // pointer should resolve to idx1=37 (the originally-bound Kilij), not
    // to the first Kilij in inventory if a duplicate existed.
    let buf = makeBlankSave();
    wUInt32BE(buf, O.INV_COUNT, 2);
    writeInvRecord(buf, 0, 0x00000000, WEAPON_IDS[1], 1, 5, 0x1005, 0, 0x01000000); // Kilij
    writeInvRecord(buf, 1, 0x00000000, WEAPON_IDS[1], 1, 37, 0x1005, 0, 0x01000000); // Kilij
    wUInt32BE(buf, O.RH1, WEAPON_IDS[1]);
    wUInt32BE(buf, O.RH1_PTR, 37);

    // Simulate the swap-away-then-back by changing on-disk RH1 to something
    // else first (as if a prior save left it desynced), then asking the
    // writer to set RH1 back to Kilij.  The pointer (37) still points at a
    // Kilij, so Rule 2 should keep it.
    const m = readSave(buf);
    wUInt32BE(buf, O.RH1, 0x00000000); // simulate desync: ID no longer Kilij
    m.rightHand1 = WEAPON_IDS[1]; // writer asked to restore Kilij

    buf = writeSave(buf, m);

    expect(rUInt32BE(buf, O.RH1)).toBe(WEAPON_IDS[1]);
    // Rule 2: pointer 37 already resolves to a Kilij → keep it (not 5).
    expect(rUInt32BE(buf, O.RH1_PTR)).toBe(37);
  });
});

/* ========================================================================
 * 4. Secondary file writer
 * ==================================================================== */

describe('secondary file writer', () => {
  test('writes name + world (UTF-16LE pairs, no length prefix)', async () => {
    const { writeSecondaryFileInPlace } = await import('../../js/des-savefile/writer.js');
    let buf = new Uint8Array(0x400);
    writeSecondaryFileInPlace(buf, 'MyChar', 0, 2);
    // World at 0x24C (slot 0)
    expect(buf[O.SEC_WORLD]).toBe(2);
    // Secondary file name uses UTF-16LE pairs (no length prefix).
    // 'M' at SEC_NAME_BASE (low byte of first pair), 0 at SEC_NAME_BASE+1 (high byte).
    expect(buf[O.SEC_NAME_BASE]).toBe('M'.charCodeAt(0));
    expect(buf[O.SEC_NAME_BASE + 1]).toBe(0);
    // Second char 'y' at SEC_NAME_BASE+2.
    expect(buf[O.SEC_NAME_BASE + 2]).toBe('y'.charCodeAt(0));
  });

  // World must be written at per-slot offsets (SEC_WORLD + slot *
  // SEC_NAME_STRIDE), not a single fixed offset.
  test('writes world at per-slot offset', async () => {
    const { writeSecondaryFileInPlace } = await import('../../js/des-savefile/writer.js');
    let buf = new Uint8Array(0x800);
    writeSecondaryFileInPlace(buf, 'Slot0', 0, 3);
    writeSecondaryFileInPlace(buf, 'Slot1', 1, 7);

    // Slot 0 world at base offset
    expect(buf[O.SEC_WORLD + 0 * O.SEC_NAME_STRIDE]).toBe(3);
    // Slot 1 world at offset + stride
    expect(buf[O.SEC_WORLD + 1 * O.SEC_NAME_STRIDE]).toBe(7);
    // Slot 0's world must NOT have been overwritten by slot 1
    expect(buf[O.SEC_WORLD]).toBe(3);
  });

  // A 16-character name must NOT overflow into the GENDER field (offset
  // 0xF6 in the primary file). The name loop writes exactly 16 UTF-16BE
  // characters (i=0..15).
  test('16-char name does not overflow into GENDER field', () => {
    let buf = makeBlankSave();
    const m = readSave(buf);
    // 16-char name (the maximum)
    m.name = '0123456789ABCDEF';
    // Pre-set GENDER to a sentinel value
    m.gender = 0x42;
    buf = writeSave(buf, m);

    // GENDER at 0xF6 must be intact (not zeroed by name overflow)
    expect(buf[O.GENDER]).toBe(0x42);
    // Name should round-trip correctly
    const m2 = readSave(buf);
    expect(m2.name).toBe('0123456789ABCDEF');
  });
});

/* ========================================================================
 * 5. Name field format (no length prefix — UTF-16LE pairs at 0xD5)
 * ==================================================================== */

describe('reader: name field format', () => {
  // The name field starts at NAME (0xD4).  Character data (16 UTF-16LE
  // pairs) starts at NAME+1 (0xD5).  Byte 0xD4 is NOT a length prefix —
  // the game reads the name as zero-terminated UTF-16 from 0xD4.

  test('reads name correctly (UTF-16LE pairs at NAME+1)', () => {
    let buf = makeBlankSave();
    // Write "Test" as UTF-16LE pairs starting at NAME+1 (0xD5)
    buf[O.NAME + 1] = 0x54; // 'T' low byte
    buf[O.NAME + 2] = 0x00; // 'T' high byte
    buf[O.NAME + 3] = 0x65; // 'e' low byte
    buf[O.NAME + 4] = 0x00; // 'e' high byte
    buf[O.NAME + 5] = 0x73; // 's' low byte
    buf[O.NAME + 6] = 0x00; // 's' high byte
    buf[O.NAME + 7] = 0x74; // 't' low byte
    buf[O.NAME + 8] = 0x00; // 't' high byte
    buf[O.NAME + 9] = 0x00; // terminator (low)
    buf[O.NAME + 10] = 0x00; // terminator (high)

    const m = readSave(buf);
    expect(m.name).toBe('Test');
  });

  test('name does not progressively corrupt across multiple save cycles', () => {
    // Write a name, then round-trip 5 times — name must stay stable.
    let buf = makeBlankSave();
    buf[O.NAME + 1] = 0x41; // 'A' low byte
    buf[O.NAME + 2] = 0x00; // 'A' high byte
    buf[O.NAME + 3] = 0x42; // 'B' low byte
    buf[O.NAME + 4] = 0x00; // 'B' high byte
    buf[O.NAME + 5] = 0x00; // terminator
    buf[O.NAME + 6] = 0x00;

    let m = readSave(buf);
    expect(m.name).toBe('AB');

    for (let i = 0; i < 5; i++) {
      buf = writeSave(buf, m);
      m = readSave(buf);
      expect(m.name).toBe('AB');
      expect(m.name.length).toBe(2);
    }

    // Verify byte NAME is zeroed by the writer (no length prefix)
    expect(buf[O.NAME]).toBe(0);
  });

  test('writer writes name data at NAME+1 and zeros NAME', () => {
    let buf = makeBlankSave();
    // Start with a 3-char name
    buf[O.NAME + 1] = 0x41; // 'A'
    buf[O.NAME + 3] = 0x42; // 'B'
    buf[O.NAME + 5] = 0x43; // 'C'

    let m = readSave(buf);
    expect(m.name).toBe('ABC');

    // Change to a 5-char name
    m.name = 'HELLO';
    buf = writeSave(buf, m);

    // Byte NAME must be zeroed (no length prefix)
    expect(buf[O.NAME]).toBe(0);

    // Read back — should get the new name
    m = readSave(buf);
    expect(m.name).toBe('HELLO');
  });
});

/* ========================================================================
 * 6. UTF-16 name round-trip
 * ==================================================================== */

describe('reader/writer: UTF-16 name support', () => {
  test('CJK character round-trips through read→write→read', () => {
    let buf = makeBlankSave();
    // U+3042 (Hiragana あ) — charCode 0x3042, above Latin1 range (255).
    // UTF-16LE-like storage: low byte first (0x42), then high byte (0x30).
    // Character data starts at NAME+1 (0xD5); byte NAME (0xD4) stays 0.
    buf[O.NAME + 1] = 0x42; // low byte of U+3042
    buf[O.NAME + 2] = 0x30; // high byte of U+3042
    buf[O.NAME + 3] = 0x00; // terminator
    buf[O.NAME + 4] = 0x00;

    const m = readSave(buf);
    expect(m.name).toBe('\u3042');

    // Write back and re-read — must round-trip exactly
    buf = writeSave(buf, m);
    const m2 = readSave(buf);
    expect(m2.name).toBe('\u3042');
  });
});

/* ========================================================================
 * 7. Hair color full precision
 * ==================================================================== */

describe('reader/writer: hair color precision', () => {
  test('full float32 precision round-trip without rounding loss', () => {
    let buf = makeBlankSave();
    // Write a value that would lose precision under Math.round(x*1000)/1000
    // e.g. 0.1234567 → rounded would become 0.123
    const dv = new DataView(buf.buffer);
    dv.setFloat32(O.HAIR_R, 0.1234567, false);
    dv.setFloat32(O.HAIR_G, 0.9876543, false);
    dv.setFloat32(O.HAIR_B, 0.5555555, false);

    const m = readSave(buf);
    // The reader should preserve the full float32 value, not a rounded one
    expect(m.hairR).toBe(dv.getFloat32(O.HAIR_R, false));
    expect(m.hairG).toBe(dv.getFloat32(O.HAIR_G, false));
    expect(m.hairB).toBe(dv.getFloat32(O.HAIR_B, false));

    // Write back — must not lose precision
    buf = writeSave(buf, m);
    const m2 = readSave(buf);
    expect(m2.hairR).toBe(m.hairR);
    expect(m2.hairG).toBe(m.hairG);
    expect(m2.hairB).toBe(m.hairB);
  });
});

/* ========================================================================
 * 8. Inventory full clear on delete
 * ==================================================================== */

describe('writer: inventory full clear on delete', () => {
  test('deleted inventory slot has all 32 bytes set to 0xFF', () => {
    let buf = makeBlankSave();
    wUInt32BE(buf, O.INV_COUNT, 1);
    // Write an item at slot 1 with non-zero data in all fields
    writeInvRecord(buf, 1, 0x00000000, WEAPON_IDS[2], 10, 5, 0x1016, 3, 0x01000000);
    // Also write durability for this item
    wUInt32BE(buf, O.DURABILITY_BASE + 5 * 8, 300);

    const m = readSave(buf);
    // Delete the item by removing it from the model
    m.weapons = [];

    buf = writeSave(buf, m);

    // Verify that the entire 32-byte record at slot 1 is 0xFF
    const slotBase = O.INV_TYPE_BASE + 1 * O.INV_STRIDE;
    for (let i = 0; i < O.INV_STRIDE; i++) {
      expect(buf[slotBase + i]).toBe(0xff);
    }
  });
});

/* ========================================================================
 * 9. Deposit count early exit
 * ==================================================================== */

describe('reader: deposit count early exit', () => {
  test('reader stops scanning after finding DEPOSIT_COUNT items', () => {
    let buf = makeBlankSave();
    fillDepositEmpty(buf);

    // Write 2 valid deposit entries
    const b0 = O.DEPOSIT_BASE;
    wUInt8(buf, b0 + 4, 0x00); // weapon
    buf[b0 + 12] = 1;

    const b1 = O.DEPOSIT_BASE + 1 * O.DEPOSIT_STRIDE;
    wUInt8(buf, b1 + 4, 0x40); // goods
    buf[b1 + 12] = 5;

    // Write a "garbage" entry at slot 2 that would fail if scanned
    const b2 = O.DEPOSIT_BASE + 2 * O.DEPOSIT_STRIDE;
    wUInt8(buf, b2 + 4, 0x00); // weapon type (valid)
    buf[b2 + 12] = 99;

    // Set DEPOSIT_COUNT to 2 — reader should stop before reaching slot 2
    wUInt32BE(buf, O.DEPOSIT_COUNT, 2);

    const m = readSave(buf);
    expect(m.deposit).toHaveLength(2);
    expect(m.deposit[0].count).toBe(1);
    expect(m.deposit[1].count).toBe(5);
  });
});

/* ========================================================================
 * 10. Deposit sortOrder: lo16 preservation + hi16 bit safety
 * ==================================================================== */

describe('writer: deposit sortOrder round-trip', () => {
  // All four cases exercise the same sortIdDurPack write→read path:
  //   - lo16 non-zero → preserved
  //   - lo16 zero → falls back to slot index
  //   - hi16 bit 15 set → unsigned `>>> 0` prevents sign issues
  //   - hi16 0xFFFF → max value
  test.each([
    {
      label: 'non-zero lo16 preserved',
      sortOrder: 0x00100007,
      expectHi16: 0x0010,
      expectLo16: 0x0007,
    },
    {
      label: 'zero lo16 falls back to slot index',
      sortOrder: 0x00100000,
      expectHi16: 0x0010,
      expectLo16: 0,
    },
    {
      label: 'sortId bit 15 set round-trips',
      sortOrder: 0x80000001,
      expectHi16: 0x8000,
      expectLo16: 0x0001,
    },
    {
      label: 'sortId=0xFFFF round-trips (max value)',
      sortOrder: 0xffff0005,
      expectHi16: 0xffff,
      expectLo16: 0x0005,
    },
  ])('$label', ({ sortOrder, expectHi16, expectLo16 }) => {
    let buf = makeBlankSave();
    const m = readSave(buf);
    m.deposit = [
      {
        category: 'goods',
        itemId: ITEM_IDS[2],
        count: 1,
        durability: 0,
        unknown1: 0,
        sortOrder,
        flags: [0x21, 0, 0, 0, 0, 0, 0],
      },
    ];
    buf = writeSave(buf, m);
    const m2 = readSave(buf);
    expect((m2.deposit[0].sortOrder >> 16) & 0xffff).toBe(expectHi16);
    expect(m2.deposit[0].sortOrder & 0xffff).toBe(expectLo16);
  });
});

/* ========================================================================
 * 11. Inventory skip-loop iteration cap + reader bounds
 * ==================================================================== */

describe('reader: inventory scan cap + bounds', () => {
  test('throws when skip-loop exceeds INV_SLOTS iterations (all -1 types)', () => {
    let buf = makeBlankSave();
    wUInt32BE(buf, O.INV_COUNT, 1);
    // Fill the entire inventory region with 0xFFFFFFFF (empty markers)
    for (let i = 0; i < O.INV_SLOTS; i++) {
      writeInvRecord(buf, i, 0xffffffff, 0, 0, 0, 0, 0, 0);
    }
    wUInt32BE(buf, O.DEPOSIT_COUNT, 0);
    expect(() => readSave(buf)).toThrow('Unexpected data');
  });

  test('throws when scan reaches DURABILITY_BASE region', () => {
    let buf = makeBlankSave();
    wUInt32BE(buf, O.INV_COUNT, 1);
    // Fill all inventory slots with 0xFFFFFFFF so the skip-loop scans
    // forward until it hits DURABILITY_BASE.
    for (let i = 0; i < O.INV_SLOTS; i++) {
      const b = O.INV_TYPE_BASE + i * O.INV_STRIDE;
      if (b < O.DURABILITY_BASE) wUInt32BE(buf, b, 0xffffffff);
    }
    wUInt32BE(buf, O.DEPOSIT_COUNT, 0);
    expect(() => readSave(buf)).toThrow('Unexpected data');
  });

  test('throws when scan reaches buffer end', () => {
    // Create a buffer where INV_TYPE_BASE + offset + INV_STRIDE > bytes.length.
    // We truncate the buffer in the middle of the inventory region so the
    // scan hits the bounds check.
    const size = O.INV_TYPE_BASE + O.INV_STRIDE * 5; // 5 slots worth
    let buf = new Uint8Array(size);
    wInt32BE(buf, O.SANITY_CHECK, 1);
    wUInt32BE(buf, O.INV_COUNT, 1);
    // Fill available slots with empty type so scan advances past them
    for (let i = 0; i < 5; i++) {
      wUInt32BE(buf, O.INV_TYPE_BASE + i * O.INV_STRIDE, 0xffffffff);
    }
    // The scan will advance past all 5 empty slots then hit buffer end
    expect(() => readSave(buf)).toThrow();
  });
});

describe('reader: deposit bounds and type checks', () => {
  test('throws when buffer too small for deposit region', () => {
    const size = O.DEPOSIT_BASE + O.DEPOSIT_STRIDE * 3;
    let buf = new Uint8Array(size);
    wInt32BE(buf, O.SANITY_CHECK, 1);
    wUInt32BE(buf, O.INV_COUNT, 0);
    wUInt32BE(buf, O.DEPOSIT_COUNT, 5);
    expect(() => readSave(buf)).toThrow('Save buffer too small');
  });

  test('skips deposit entries with unknown type 0x99', () => {
    let buf = makeBlankSave();
    fillDepositEmpty(buf);
    wUInt32BE(buf, O.DEPOSIT_COUNT, 2);
    const b0 = O.DEPOSIT_BASE;
    buf[b0 + 4] = 0x00;
    buf[b0 + 12] = 1;
    const b1 = O.DEPOSIT_BASE + O.DEPOSIT_STRIDE;
    buf[b1 + 4] = 0x30;
    buf[b1 + 12] = 5;
    const b2 = O.DEPOSIT_BASE + 2 * O.DEPOSIT_STRIDE;
    buf[b2 + 4] = 0x40;
    buf[b2 + 12] = 3;
    const m = readSave(buf);
    expect(m.deposit.length).toBe(2);
    expect(m.deposit[0].category).toBe('weapons');
    expect(m.deposit[1].category).toBe('goods');
  });
});

describe('reader: spell bounds check', () => {
  test('throws when buffer too small for spell region', () => {
    const size = O.SPELL_BASE + O.SPELL_STRIDE * 2;
    let buf = new Uint8Array(size);
    wInt32BE(buf, O.SANITY_CHECK, 1);
    wUInt32BE(buf, O.INV_COUNT, 0);
    wUInt32BE(buf, O.DEPOSIT_COUNT, 0);
    wUInt32BE(buf, O.SPELL_COUNT, 5);
    expect(() => readSave(buf)).toThrow('Save buffer too small');
  });
});

/* ========================================================================
 * 12. writeSave / writeSaveInPlace buffer guards
 * ==================================================================== */

describe('writer: buffer guards', () => {
  // The model is never read in these tests — the buffer-size guard throws first.
  const EMPTY_MODEL = /** @type {import('../../js/des-savefile/model.js').FullModel} */ (
    /** @type {unknown} */ ({})
  );

  test('writeSave throws on null input', () => {
    expect(() => writeSave(null, EMPTY_MODEL)).toThrow(/Save buffer too small/);
  });

  test('writeSave throws on too-small buffer', () => {
    const small = new Uint8Array(0x100);
    expect(() => writeSave(small, EMPTY_MODEL)).toThrow(/Save buffer too small/);
  });

  test('writeSave throws on position table out of bounds', () => {
    let buf = makeBlankSave();
    const m = readSave(buf); // reads OK with posOffset = 0
    wUInt16BE(buf, O.POS_OFFSET_SELECTOR, 0x600); // 0x21AE3 + 0x600 + 0x18 > 0x22000
    expect(() => writeSave(buf, m)).toThrow('Unexpected data');
  });

  test('writeSaveInPlace throws on null bytes', () => {
    expect(() => writeSaveInPlace(null, EMPTY_MODEL)).toThrow(/Save buffer too small/);
  });

  test('writeSaveInPlace throws on too-small buffer', () => {
    const small = new Uint8Array(0x100);
    expect(() => writeSaveInPlace(small, EMPTY_MODEL)).toThrow(/Save buffer too small/);
  });

  test('writeSaveInPlace mutates buffer in place (returns same reference)', () => {
    let buf = makeBlankSave();
    const m = readSave(buf);
    m.vit = 77;
    const result = writeSaveInPlace(buf, m);
    expect(result).toBe(buf);
    expect(rInt32BE(buf, O.VIT)).toBe(77);
  });
});

/* ========================================================================
 * 13. Inventory edge cases
 * ==================================================================== */

describe('writer: inventory edge cases', () => {
  test('inventory slot out of bounds throws', () => {
    let buf = makeBlankSave();
    const m = readSave(buf);
    m.weapons.push({
      itemId: WEAPON_IDS[2],
      count: 1,
      _slot: 0xffff,
      idx1: 0,
      misc1: 0,
      idx2: 0,
      misc2: 0x01000000,
      durability: 300,
    });
    expect(() => writeSave(buf, m)).toThrow(/out of bounds/);
  });

  test('inventory full throws when no empty slots', () => {
    let buf = makeBlankSave();
    for (let i = 0; i < O.INV_SLOTS; i++) {
      writeInvRecord(buf, i, 0x00000000, WEAPON_IDS[2], 1, i, 0, i, 0x01000000);
    }
    wUInt32BE(buf, O.INV_COUNT, O.INV_SLOTS);

    const m = readSave(buf);
    m.weapons.push({
      itemId: WEAPON_IDS[5],
      count: 1,
      _slot: undefined,
      idx1: 999,
      misc1: 0,
      idx2: 0,
      misc2: 0x01000000,
      durability: 300,
    });
    expect(() => writeSave(buf, m)).toThrow(/Inventory is full/);
  });

  test('rings and goods items round-trip through write', () => {
    let buf = makeBlankSave();
    const m = readSave(buf);
    m.rings.push({
      itemId: RING_IDS[1],
      count: 1,
      _slot: undefined,
      idx1: 10,
      misc1: 0x13,
      idx2: 0,
      misc2: 0x01000000,
      durability: 0,
    });
    m.goods.push({
      itemId: ITEM_IDS[2],
      count: 50,
      _slot: undefined,
      idx1: 20,
      misc1: 0x01,
      idx2: 0,
      misc2: 0x01000000,
      durability: 0,
    });
    buf = writeSave(buf, m);
    const m2 = readSave(buf);
    expect(m2.rings).toHaveLength(1);
    expect(m2.rings[0].itemId).toBe(RING_IDS[1]);
    expect(m2.goods).toHaveLength(1);
    expect(m2.goods[0].count).toBe(50);
  });

  test('armor inventory items round-trip through write→read', () => {
    let buf = makeBlankSave();
    wUInt32BE(buf, O.INV_COUNT, 1);
    const slotBase = O.INV_TYPE_BASE;
    wUInt32BE(buf, slotBase, 0x10000000);
    wUInt32BE(buf, slotBase + 0x04, ARMOR_IDS[0]);
    wUInt32BE(buf, slotBase + 0x08, 1);
    wUInt32BE(buf, slotBase + 0x0c, 0);
    wUInt16BE(buf, slotBase + 0x10, 0x03f4);
    wUInt16BE(buf, slotBase + 0x12, 0);
    wUInt32BE(buf, slotBase + 0x14, 0x01000000);

    const m = readSave(buf);
    expect(m.armor).toHaveLength(1);
    expect(m.armor[0].itemId).toBe(ARMOR_IDS[0]);

    const written = writeSave(buf, m);
    const m2 = readSave(written);
    expect(m2.armor).toHaveLength(1);
    expect(m2.armor[0].itemId).toBe(ARMOR_IDS[0]);
  });

  test('new armor item with _slot=undefined gets placed and durability written', () => {
    let buf = makeBlankSave();
    const m = readSave(buf);
    m.armor.push({
      itemId: ARMOR_IDS[0],
      count: 1,
      _slot: undefined,
      idx1: 3,
      misc1: 0x000c,
      idx2: 0,
      misc2: 0x01000000,
      durability: 150,
    });
    buf = writeSave(buf, m);
    const m2 = readSave(buf);
    expect(m2.armor).toHaveLength(1);
    expect(m2.armor[0].itemId).toBe(ARMOR_IDS[0]);
    expect(m2.armor[0].durability).toBe(150);
  });

  test('new item skips occupied slot before finding empty one', () => {
    let buf = makeBlankSave();
    wUInt32BE(buf, O.INV_COUNT, 1);
    writeInvRecord(buf, 0, 0x00000000, WEAPON_IDS[2], 1, 0, 0x1016, 0, 0x01000000);

    const m = readSave(buf);
    m.weapons.push({
      itemId: WEAPON_IDS[5],
      count: 1,
      _slot: undefined,
      idx1: 1,
      misc1: 0x1016,
      idx2: 1,
      misc2: 0x01000000,
      durability: 300,
    });
    buf = writeSave(buf, m);
    const m2 = readSave(buf);
    expect(m2.weapons).toHaveLength(2);
    expect(m2.weapons[1]._slot).toBe(1);
  });

  test('existing ring item does not trigger durability write', () => {
    let buf = makeBlankSave();
    wUInt32BE(buf, O.INV_COUNT, 1);
    writeInvRecord(buf, 0, 0x20000000, RING_IDS[1], 1, 0, 0, 0, 0x01000000);
    const m = readSave(buf);
    m.rings[0].count = 5;
    expect(() => writeSave(buf, m)).not.toThrow();
  });

  test('existing goods item does not trigger durability write', () => {
    let buf = makeBlankSave();
    wUInt32BE(buf, O.INV_COUNT, 1);
    writeInvRecord(buf, 0, 0x40000000, ITEM_IDS[2], 1, 0, 0, 0, 0x01000000);
    const m = readSave(buf);
    m.goods[0].count = 10;
    expect(() => writeSave(buf, m)).not.toThrow();
  });
});

/* ========================================================================
 * 14. Deleted slots
 * ==================================================================== */

describe('writer: deletedSlots clearing', () => {
  test('deletedSlots clears durability and full record', () => {
    let buf = makeBlankSave();
    wUInt32BE(buf, O.INV_COUNT, 1);
    writeInvRecord(buf, 0, 0x00000000, WEAPON_IDS[2], 1, 5, 0x1016, 0, 0x01000000);
    wUInt32BE(buf, O.DURABILITY_BASE + 5 * 8, 300);

    const emptyModel = { ...readSave(buf), weapons: [], armor: [], rings: [], goods: [] };
    buf = writeSave(buf, emptyModel, [0]);

    expect(rUInt32BE(buf, O.DURABILITY_BASE + 5 * 8)).toBe(0);
    const slotBase = O.INV_TYPE_BASE;
    for (let i = 0; i < O.INV_STRIDE; i++) {
      expect(buf[slotBase + i]).toBe(0xff);
    }
  });

  test('full-scan fallback (no deletedSlots) clears stale items', () => {
    let buf = makeBlankSave();
    wUInt32BE(buf, O.INV_COUNT, 1);
    writeInvRecord(buf, 0, 0x00000000, WEAPON_IDS[2], 1, 3, 0x1016, 0, 0x01000000);
    wUInt32BE(buf, O.DURABILITY_BASE + 3 * 8, 250);

    const m = readSave(buf);
    m.weapons = [];
    buf = writeSave(buf, m);

    expect(rUInt32BE(buf, O.INV_TYPE_BASE)).toBe(0xffffffff);
    expect(rUInt32BE(buf, O.DURABILITY_BASE + 3 * 8)).toBe(0);
  });

  test('deleted slot with idx1 >= INV_SLOTS skips durability clear', () => {
    let buf = makeBlankSave();
    wUInt32BE(buf, O.INV_COUNT, 1);
    writeInvRecord(buf, 0, 0x00000000, WEAPON_IDS[2], 1, 0xffff, 0, 0, 0x01000000);
    const m = readSave(makeBlankSave());
    buf = writeSave(buf, m, [0]);
    expect(rUInt32BE(buf, O.INV_TYPE_BASE)).toBe(0xffffffff);
  });

  test('deletedSlots entry also in modelSlots is skipped (safety)', () => {
    let buf = makeBlankSave();
    wUInt32BE(buf, O.INV_COUNT, 1);
    writeInvRecord(buf, 0, 0x00000000, WEAPON_IDS[2], 1, 0, 0, 0, 0x01000000);
    const m = readSave(buf);
    expect(() => writeSave(buf, m, [0])).not.toThrow();
    const m2 = readSave(buf);
    expect(m2.weapons).toHaveLength(1);
  });

  test('deletedSlots entry out of buffer bounds is skipped', () => {
    let buf = makeBlankSave();
    const m = readSave(buf);
    expect(() => writeSave(buf, m, [999999])).not.toThrow();
  });

  test('deletedSlots entry with already-empty disk type is skipped', () => {
    let buf = makeBlankSave();
    writeInvRecord(buf, 5, 0xffffffff, 0, 0, 0, 0, 0, 0);
    const m = readSave(buf);
    expect(() => writeSave(buf, m, [5])).not.toThrow();
  });

  test('full-scan fallback skips already-empty slots', () => {
    let buf = makeBlankSave();
    wUInt32BE(buf, O.INV_COUNT, 1);
    writeInvRecord(buf, 0, 0x00000000, WEAPON_IDS[2], 1, 0, 0x1016, 0, 0x01000000);
    writeInvRecord(buf, 3, 0xffffffff, 0, 0, 0, 0, 0, 0);
    const m = readSave(buf);
    expect(() => writeSave(buf, m)).not.toThrow();
  });
});

/* ========================================================================
 * 15. Spell stale record clearing
 * ==================================================================== */

describe('writer: stale spell clearing', () => {
  test('removing spells zeroes stale records', () => {
    let buf = makeBlankSave();
    wUInt32BE(buf, O.SPELL_COUNT, 3);
    for (let i = 0; i < 3; i++) {
      wUInt32BE(buf, O.SPELL_BASE + i * O.SPELL_STRIDE + O.SPELL_STATUS_OFFSET, 3);
      wUInt32BE(buf, O.SPELL_BASE + i * O.SPELL_STRIDE + O.SPELL_ID_OFFSET, SPELL_IDS[i]);
    }

    const m = readSave(buf);
    expect(m.spells).toHaveLength(3);

    m.spells = [m.spells[0]];
    buf = writeSave(buf, m);

    const slot1Status = rUInt32BE(buf, O.SPELL_BASE + 1 * O.SPELL_STRIDE + O.SPELL_STATUS_OFFSET);
    const slot2Status = rUInt32BE(buf, O.SPELL_BASE + 2 * O.SPELL_STRIDE + O.SPELL_STATUS_OFFSET);
    expect(slot1Status).toBe(0);
    expect(slot2Status).toBe(0);
    expect(rUInt32BE(buf, O.SPELL_COUNT)).toBe(1);
  });

  test('clearing stale spells hits bounds check', () => {
    let buf = makeBlankSave();
    wUInt32BE(buf, O.SPELL_COUNT, 500);
    for (let i = 0; i < 500; i++) {
      const b = O.SPELL_BASE + i * O.SPELL_STRIDE;
      if (b + O.SPELL_STRIDE <= buf.length) {
        wUInt32BE(buf, b + O.SPELL_STATUS_OFFSET, 2);
      }
    }

    const m = readSave(buf);
    m.spells = [{ itemId: SPELL_IDS[0], status: 2, misc1: 0, misc2: 0 }];
    expect(() => writeSave(buf, m)).not.toThrow();
  });
});

describe('writer: spell OOB', () => {
  test('throws when spell record exceeds buffer bounds', () => {
    let buf = makeBlankSave();
    const m = readSave(buf);
    m.spells = [];
    for (let i = 0; i < 3600; i++) {
      m.spells.push({ itemId: SPELL_IDS[0], status: 3, misc1: 0, misc2: 0 });
    }
    expect(() => writeSave(buf, m)).toThrow(/out of bounds/);
  });
});

describe('reader: position table OOB', () => {
  test('throws when position offset selector points past buffer', () => {
    let buf = makeBlankSave();
    wUInt16BE(buf, O.POS_OFFSET_SELECTOR, 0x7fff);
    expect(() => readSave(buf)).toThrow('Unexpected data');
  });
});

/* ========================================================================
 * 16. Reader bounds checks
 * ==================================================================== */

describe('reader: bounds checks', () => {
  test('reader throws on null bytes', () => {
    expect(() => readSave(null)).toThrow(/Save buffer too small/);
  });

  test('reader handles large spellCount within bounds (no throw)', () => {
    let buf = makeBlankSave();
    wUInt32BE(buf, O.SPELL_COUNT, 0x1ff);
    expect(() => readSave(buf)).not.toThrow();
  });
});

// NPC flags all-true branch is now covered by the NPC flags round-trip
// test.each (all-true case) in section 2 above.  archSealed is covered
// by the dedicated archSealed test in section 2.

/* ========================================================================
 * 18. Writer: null/undefined category arrays
 * ==================================================================== */

describe('writer: null/undefined category arrays', () => {
  test('handles model with null inventory categories', () => {
    let buf = makeBlankSave();
    const m = readSave(buf);
    m.weapons = null;
    m.armor = undefined;
    m.rings = null;
    m.goods = undefined;
    expect(() => writeSave(buf, m)).not.toThrow();
  });

  test('handles model with null deposit array', () => {
    let buf = makeBlankSave();
    const m = readSave(buf);
    m.deposit = null;
    expect(() => writeSave(buf, m)).not.toThrow();
  });

  test('handles model with undefined deposit array', () => {
    let buf = makeBlankSave();
    const m = readSave(buf);
    m.deposit = undefined;
    expect(() => writeSave(buf, m)).not.toThrow();
  });
});

/* ========================================================================
 * 19. Writer: idx1 = slot invariant for newly added items
 * ==================================================================== */

describe('writer: idx1 = slot invariant for newly added items', () => {
  test('new weapon gets idx1 = slot number (not global-max+1)', () => {
    let buf = makeBlankSave();
    wUInt32BE(buf, O.INV_COUNT, 2);
    writeInvRecord(buf, 0, 0x00000000, WEAPON_IDS[2], 1, 0, 0x1016, 0, 0x01000000);
    writeInvRecord(buf, 1, 0x00000000, WEAPON_IDS[1], 1, 1, 0x1005, 1, 0x01000000);
    wUInt32BE(buf, O.DURABILITY_BASE + 0 * 8, 300);
    wUInt32BE(buf, O.DURABILITY_BASE + 1 * 8, 200);

    const m = readSave(buf);
    m.weapons.push(
      /** @type {import('../../js/des-savefile/model.js').FullInventoryItem} */ (
        /** @type {unknown} */ ({
          itemId: WEAPON_IDS[3],
          count: 1,
          misc1: 0x1016,
          misc2: 0x01000000,
          durability: 250,
        })
      ),
    );

    buf = writeSave(buf, m);

    const m2 = readSave(buf);
    const newWeapon = m2.weapons.find((w) => w.itemId === WEAPON_IDS[3] >>> 0);
    expect(newWeapon).toBeDefined();
    expect(newWeapon.idx1).toBe(newWeapon._slot);
    expect(newWeapon.idx1).not.toBe(2 + 100);
    expect(rUInt32BE(buf, O.DURABILITY_BASE + newWeapon._slot * 8)).toBe(250);
  });

  test('new weapon equipped via editor gets correct hotbar pointer', () => {
    let buf = makeBlankSave();
    wUInt32BE(buf, O.INV_COUNT, 1);
    writeInvRecord(buf, 0, 0x00000000, WEAPON_IDS[2], 1, 0, 0x1016, 0, 0x01000000);
    wUInt32BE(buf, O.DURABILITY_BASE + 0 * 8, 300);

    const m = readSave(buf);
    const newItemId = WEAPON_IDS[3];
    m.weapons.push(
      /** @type {import('../../js/des-savefile/model.js').FullInventoryItem} */ (
        /** @type {unknown} */ ({
          itemId: newItemId,
          count: 1,
          misc1: 0x1016,
          misc2: 0x01000000,
          durability: 250,
        })
      ),
    );
    m.rightHand1 = newItemId >>> 0;
    wUInt32BE(buf, O.RH1_PTR, 0xffffffff);

    buf = writeSave(buf, m);
    expect(rUInt32BE(buf, O.RH1)).toBe(newItemId >>> 0);
    expect(rUInt32BE(buf, O.RH1_PTR)).toBe(1);
  });

  test('new ring equipped via editor gets correct pointer', () => {
    let buf = makeBlankSave();
    wUInt32BE(buf, O.INV_COUNT, 1);
    writeInvRecord(buf, 0, 0x20000000, RING_IDS[0], 1, 0, 0x01, 0, 0x01000000);

    const m = readSave(buf);
    const newRingId = RING_IDS[1];
    m.rings.push(
      /** @type {import('../../js/des-savefile/model.js').FullInventoryItem} */ (
        /** @type {unknown} */ ({
          itemId: newRingId,
          count: 1,
          misc1: 0x02,
          misc2: 0x01000000,
          durability: 0,
        })
      ),
    );
    m.ring1 = newRingId >>> 0;
    wUInt32BE(buf, O.RING1_PTR, 0xffffffff);

    buf = writeSave(buf, m);
    expect(rUInt32BE(buf, O.RING1)).toBe(newRingId >>> 0);
    expect(rUInt32BE(buf, O.RING1_PTR)).toBe(1);
  });
});

// Deposit sortIdDurPack high-bit safety is now covered by the
// deposit sortOrder round-trip test.each in section 10 above.

/* ========================================================================
 * _slot null safety
 * ==================================================================== */

describe('writer: _slot null safety', () => {
  test('inventory item with _slot=null is treated as new (not slot 0)', () => {
    // A null _slot must be treated as "new item", not slot 0.  The type
    // check (typeof !== 'number') ensures null is correctly skipped.
    let buf = makeBlankSave();
    // Initialize inventory slots to 0xFFFFFFFF so new items can be placed
    const m0 = readSave(buf);
    buf = writeSave(buf, m0);

    const m = readSave(buf);
    m.weapons.push({
      itemId: WEAPON_IDS[2],
      count: 1,
      _slot: null, // null, not undefined
      idx1: 0,
      misc1: 0,
      idx2: 0,
      misc2: 0x01000000,
      durability: 300,
    });
    buf = writeSave(buf, m);
    const m2 = readSave(buf);
    // The item should have been placed as new (at slot 0 or later), not
    // silently treated as slot 0 and overwritten.
    expect(m2.weapons).toHaveLength(1);
    expect(m2.weapons[0].itemId).toBe(WEAPON_IDS[2]);
  });
});

/* ========================================================================
 * Secondary file bounds check
 * ==================================================================== */

describe('writer: secondary file bounds check', () => {
  test('throws on tiny buffer instead of silent no-op', () => {
    const buf = new Uint8Array(0x10); // way too small for any slot
    expect(() => writeSecondaryFileInPlace(buf, 'Test', 0, 1)).toThrow(/out of bounds/);
  });

  test('throws when slot index produces out-of-bounds offsets', () => {
    // Slot 10 would be at SEC_NAME_BASE + 10 * 0x140 = 0x21D + 0xC80 = 0xE9D
    // which is way beyond a 0x400 buffer.
    const buf = new Uint8Array(0x400);
    expect(() => writeSecondaryFileInPlace(buf, 'Test', 10, 1)).toThrow(/out of bounds/);
  });
});
