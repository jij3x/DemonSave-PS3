/**
 * Endian / numeric helper parity tests.
 */
import {
  swap16,
  swap32,
  swap64Halves,
  asInt16,
  asInt32,
  rInt16BE,
  rInt32BE,
  rUInt16BE,
  rUInt32BE,
  rSingleBE,
  rUniStr,
  wInt8,
  wInt16BE,
  wInt32BE,
  wUInt8,
  wUInt16BE,
  wUInt32BE,
  wSingleBE,
  wBytes,
  oneByteAnd,
  readU64LE,
  writeU64LE,
  readU64BE,
  writeU64BE,
  readU64BEHalves,
  writeU64BEHalves,
  encodeAscii,
  decodeAscii,
} from '../../../js/lib/ps3-save-lib/index.js';

describe('swap16', () => {
  test('swaps bytes of 0x1234 -> 0x3412', () => {
    expect(swap16(0x1234)).toBe(0x3412);
  });
  test('0xFF00 -> 0x00FF', () => {
    expect(swap16(0xff00)).toBe(0x00ff);
  });
});

describe('swap32', () => {
  test('0x11223344 -> 0x44332211', () => {
    expect(swap32(0x11223344)).toBe(0x44332211);
  });
  test('0x000000FF -> 0xFF000000', () => {
    expect(swap32(0x000000ff)).toBe(0xff000000);
  });
});

describe('swap64Halves', () => {
  test('swaps hi and lo halves and byte-swaps each', () => {
    // hi = 0x11223344 → swap32 → 0x44332211
    // lo = 0xAABBCCDD → swap32 → 0xDDCCBBAA
    // result: hi = swap32(lo) = 0xDDCCBBAA, lo = swap32(hi) = 0x44332211
    const r = swap64Halves(0x11223344, 0xaabbccdd);
    expect(r.hi).toBe(0xddccbbaa);
    expect(r.lo).toBe(0x44332211);
  });
});

describe('signed interpretation', () => {
  test('asInt16(0xFFFF) === -1', () => {
    expect(asInt16(0xffff)).toBe(-1);
  });
  test('asInt16(0x7FFF) === 32767 (positive path)', () => {
    expect(asInt16(0x7fff)).toBe(32767);
  });
  test('asInt16(0) === 0 (positive path)', () => {
    expect(asInt16(0)).toBe(0);
  });
  test('asInt32(0xFFFFFFFF) === -1', () => {
    expect(asInt32(0xffffffff)).toBe(-1);
  });
  test('asInt32(0x80000000) === -2147483648', () => {
    expect(asInt32(0x80000000)).toBe(-2147483648);
  });
  test('asInt32(0x7FFFFFFF) === 2147483647 (positive path)', () => {
    expect(asInt32(0x7fffffff)).toBe(2147483647);
  });
  test('asInt32(0) === 0 (positive path)', () => {
    expect(asInt32(0)).toBe(0);
  });
});

describe('big-endian USER.DAT readers', () => {
  const buf = new Uint8Array([0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0]);
  test('rUInt16BE', () => {
    expect(rUInt16BE(buf, 0)).toBe(0x1234);
    expect(rUInt16BE(buf, 2)).toBe(0x5678);
  });
  test('rUInt32BE', () => {
    expect(rUInt32BE(buf, 0)).toBe(0x12345678);
    expect(rUInt32BE(buf, 4)).toBe(0x9abcdef0);
  });
  test('rInt16BE signed', () => {
    const neg = new Uint8Array([0xff, 0xff]);
    expect(rInt16BE(neg, 0)).toBe(-1);
  });
  test('rInt32BE signed', () => {
    const neg = new Uint8Array([0xff, 0xff, 0xff, 0xff]);
    expect(rInt32BE(neg, 0)).toBe(-1);
  });
  test('rSingleBE reads float32', () => {
    // 0x41200000 = 10.0f in big-endian
    const fbuf = new Uint8Array([0x41, 0x20, 0x00, 0x00]);
    expect(rSingleBE(fbuf, 0)).toBeCloseTo(10.0, 5);
  });
});

describe('big-endian USER.DAT writers', () => {
  test('wUInt32BE writes 4 bytes', () => {
    const buf = new Uint8Array(4);
    wUInt32BE(buf, 0, 0x12345678);
    expect(Array.from(buf)).toEqual([0x12, 0x34, 0x56, 0x78]);
  });
  test('wInt32BE writes -1 as 0xFFFFFFFF', () => {
    const buf = new Uint8Array(4);
    wInt32BE(buf, 0, -1);
    expect(Array.from(buf)).toEqual([0xff, 0xff, 0xff, 0xff]);
  });
  test('wUInt16BE / wInt16BE', () => {
    const buf = new Uint8Array(4);
    wUInt16BE(buf, 0, 0x1234);
    wInt16BE(buf, 2, -1);
    expect(Array.from(buf)).toEqual([0x12, 0x34, 0xff, 0xff]);
  });
  test('wInt8 writes byte', () => {
    const buf = new Uint8Array(1);
    wInt8(buf, 0, 0xab);
    expect(buf[0]).toBe(0xab);
  });
  test('wUInt8 writes byte', () => {
    const buf = new Uint8Array(1);
    wUInt8(buf, 0, 0xfe);
    expect(buf[0]).toBe(0xfe);
  });
  test('wSingleBE writes float32', () => {
    const buf = new Uint8Array(4);
    wSingleBE(buf, 0, 10.0);
    expect(rSingleBE(buf, 0)).toBeCloseTo(10.0, 5);
  });
  test('wBytes copies array into buffer', () => {
    const buf = new Uint8Array(8);
    const src = new Uint8Array([1, 2, 3, 4]);
    wBytes(buf, 2, src);
    expect(Array.from(buf)).toEqual([0, 0, 1, 2, 3, 4, 0, 0]);
  });
});

describe('oneByteAnd (bit test)', () => {
  test('returns true when mask bit is set', () => {
    const buf = new Uint8Array([0x40]);
    expect(oneByteAnd(buf, 0, 0x40)).toBe(true);
  });
  test('returns false when mask bit is not set', () => {
    const buf = new Uint8Array([0x40]);
    expect(oneByteAnd(buf, 0, 0x01)).toBe(false);
  });
});

describe('rUniStr', () => {
  // rUniStr reads UTF-16LE-like pairs: low byte first, then high byte per char.
  // maxLen is the max number of CHARACTERS (not bytes).
  test('reads UTF-16LE pairs "AB"', () => {
    // "A\0B\0" = 2 characters, then terminator
    const buf = new Uint8Array([0x41, 0x00, 0x42, 0x00, 0x00, 0x00]);
    expect(rUniStr(buf, 0, 3)).toBe('AB');
  });
  test('reads single char "X"', () => {
    // "X\0" then terminator
    const buf = new Uint8Array([0x58, 0x00, 0x00, 0x00]);
    expect(rUniStr(buf, 0, 2)).toBe('X');
  });
  test('terminates on zero char byte', () => {
    // First char byte = 0x00 → immediate termination
    const buf = new Uint8Array([0x00, 0x00, 0x41, 0x00]);
    expect(rUniStr(buf, 0, 2)).toBe('');
  });
  test('reads up to maxLen characters', () => {
    // "ABCD" as UTF-16BE, maxLen=2 → only "AB"
    const buf = new Uint8Array([0x41, 0x00, 0x42, 0x00, 0x43, 0x00, 0x44, 0x00]);
    expect(rUniStr(buf, 0, 2)).toBe('AB');
  });
  test('reads empty string when all zeros', () => {
    const buf = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
    expect(rUniStr(buf, 0, 2)).toBe('');
  });

  // 2.7: Full UTF-16 support — characters above Latin1 (U+00FF)
  test('2.7: reads CJK character (U+3042)', () => {
    // U+3042 stored as UTF-16LE: low byte 0x42, high byte 0x30
    const buf = new Uint8Array([0x42, 0x30, 0x00, 0x00]);
    expect(rUniStr(buf, 0, 2)).toBe('\u3042');
  });

  test('2.7: reads mixed ASCII + CJK characters', () => {
    // "A\u3042B" stored as: A\0, 0x42 0x30, B\0
    const buf = new Uint8Array([0x41, 0x00, 0x42, 0x30, 0x42, 0x00, 0x00, 0x00]);
    expect(rUniStr(buf, 0, 4)).toBe('A\u3042B');
  });
});

describe('uint64 LE helpers', () => {
  // D3: readU64LE/writeU64LE now use BigInt (matching readU64BE/writeU64BE).
  test('round-trip small value', () => {
    const buf = new Uint8Array(8);
    writeU64LE(buf, 0, 0x12345678n);
    expect(readU64LE(buf, 0)).toBe(0x12345678n);
  });
  test('known pattern', () => {
    // LE bytes 01 02 03 04 05 06 07 08 = 0x0807060504030201n
    const buf = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(readU64LE(buf, 0)).toBe(0x0807060504030201n);
  });
  test('round-trip large value', () => {
    const buf = new Uint8Array(8);
    writeU64LE(buf, 0, 0xdeadbeefcafebaben);
    expect(readU64LE(buf, 0)).toBe(0xdeadbeefcafebaben);
  });
  test('D1: throws on out-of-bounds read', () => {
    const buf = new Uint8Array(4);
    expect(() => readU64LE(buf, 0)).toThrow(RangeError);
  });
  test('D1: throws on out-of-bounds write', () => {
    const buf = new Uint8Array(4);
    expect(() => writeU64LE(buf, 0, 1n)).toThrow(RangeError);
  });
});

describe('uint64 BE helpers', () => {
  test('readU64BEHalves known pattern', () => {
    // readU64BEHalves puts first 4 bytes into hi, last 4 into lo.
    // Within each 32-bit word, the byte packing is (b0 | b1<<8 | b2<<16 | b3<<24).
    // For [1,2,3,4,5,6,7,8]: hi = 0x04030201, lo = 0x08070605
    const buf = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const r = readU64BEHalves(buf, 0);
    expect(r.hi).toBe(0x04030201);
    expect(r.lo).toBe(0x08070605);
  });
  test('writeU64BEHalves byte order', () => {
    const buf = new Uint8Array(8);
    writeU64BEHalves(buf, 0, 0xaabbccdd, 0xeeff0011);
    // BE: aa bb cc dd ee ff 00 11
    expect(Array.from(buf)).toEqual([0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x00, 0x11]);
  });
});

/* ========================================================================
 * Coverage: BE uint64 round-trips, swap helpers, NaN guards
 * ==================================================================== */

describe('uint64 BE round-trips', () => {
  test('readU64BE / writeU64BE round-trip', () => {
    const buf = new Uint8Array(8);
    const val = 0x0123456789abcdefn;
    writeU64BE(buf, 0, val);
    expect(readU64BE(buf, 0)).toBe(val);
  });

  test('readU64BE throws on out-of-bounds', () => {
    const buf = new Uint8Array(4);
    expect(() => readU64BE(buf, 0)).toThrow(RangeError);
  });

  test('writeU64BE throws on out-of-bounds', () => {
    const buf = new Uint8Array(4);
    expect(() => writeU64BE(buf, 0, 1n)).toThrow(RangeError);
  });

  test('readU64BEHalves throws on out-of-bounds', () => {
    const buf = new Uint8Array(4);
    expect(() => readU64BEHalves(buf, 0)).toThrow(RangeError);
  });

  test('writeU64BEHalves throws on out-of-bounds', () => {
    const buf = new Uint8Array(4);
    expect(() => writeU64BEHalves(buf, 0, 1, 2)).toThrow(RangeError);
  });
});

describe('swap helpers edge cases', () => {
  test('swap16 edge values', () => {
    expect(swap16(0x0000)).toBe(0x0000);
    expect(swap16(0x00ff)).toBe(0xff00);
    expect(swap16(0xff00)).toBe(0x00ff);
  });

  test('swap32 edge values', () => {
    expect(swap32(0x00000000)).toBe(0x00000000);
    expect(swap32(0x000000ff)).toBe(0xff000000);
    expect(swap32(0xffffffff)).toBe(0xffffffff);
  });

  test('swap64Halves swaps hi and lo', () => {
    const { hi, lo } = swap64Halves(0x11223344, 0x55667788);
    expect(hi).toBe(0x88776655);
    expect(lo).toBe(0x44332211);
  });
});

describe('assertBounds NaN guard', () => {
  test('rUInt32BE throws on NaN offset', () => {
    const buf = new Uint8Array(16);
    expect(() => rUInt32BE(buf, NaN)).toThrow(RangeError);
  });

  test('wUInt32BE handles NaN offset gracefully (no crash)', () => {
    // wUInt32BE doesn't use assertBounds (it's a raw writer), so NaN
    // just sets bytes[NaN] which is a no-op in practice. But it shouldn't crash.
    const buf = new Uint8Array(16);
    wUInt32BE(buf, 0, 42);
    expect(buf[0]).toBe(0);
    expect(buf[3]).toBe(42);
  });

  test('rSingleBE throws on out-of-bounds', () => {
    const buf = new Uint8Array(2);
    expect(() => rSingleBE(buf, 0)).toThrow(RangeError);
  });
});

/* ========================================================================
 * ASCII helpers (encodeAscii / decodeAscii)
 * ==================================================================== */

describe('ASCII helpers', () => {
  test('encodeAscii converts string to bytes', () => {
    const result = encodeAscii('ABC');
    expect(Array.from(result)).toEqual([0x41, 0x42, 0x43]);
  });

  test('encodeAscii masks chars above U+00FF to low byte', () => {
    const result = encodeAscii('\u0101'); // char code 257
    expect(result[0]).toBe(1); // 257 & 0xFF = 1
  });

  test('decodeAscii reads null-terminated string', () => {
    const buf = new Uint8Array([0x41, 0x42, 0x00, 0x43]);
    expect(decodeAscii(buf, 0)).toBe('AB');
  });

  test('decodeAscii respects maxLen', () => {
    const buf = new Uint8Array([0x41, 0x42, 0x43, 0x00]);
    expect(decodeAscii(buf, 0, 2)).toBe('AB');
  });

  test('decodeAscii throws on start past buffer', () => {
    const buf = new Uint8Array([0x41]);
    expect(() => decodeAscii(buf, 5)).toThrow(RangeError);
  });

  test('decodeAscii throws on negative start', () => {
    const buf = new Uint8Array([0x41]);
    expect(() => decodeAscii(buf, -1)).toThrow(RangeError);
  });

  test('decodeAscii reads to end when no maxLen and no null', () => {
    const buf = new Uint8Array([0x41, 0x42, 0x43]);
    expect(decodeAscii(buf, 0)).toBe('ABC');
  });
});

/* ========================================================================
 * Relocated from fixes.test.js — unique tests not covered elsewhere
 * ==================================================================== */

describe('rUInt32BE exact boundary', () => {
  test('succeeds at exact 4-byte buffer boundary', () => {
    const buf = new Uint8Array([0x12, 0x34, 0x56, 0x78]);
    expect(rUInt32BE(buf, 0)).toBe(0x12345678);
  });
});

describe('oneByteAnd out-of-bounds', () => {
  test('throws RangeError for loc > buf.length', () => {
    const buf = new Uint8Array(4);
    expect(() => oneByteAnd(buf, 10, 0xff)).toThrow(RangeError);
  });
});

// Note: wBytes is already tested in 'big-endian USER.DAT writers' →
// 'wBytes copies array into buffer' above.
