/**
 * Hex / byte-array helper tests.
 */
import {
  fromHex,
  toHex,
  compareBytes,
  zeros,
  copy,
  concat,
} from '../../../js/lib/ps3-save-lib/index.js';

describe('fromHex', () => {
  test('parses even-length hex string', () => {
    expect(Array.from(fromHex('48656c6c6f'))).toEqual([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
  });
  test('rejects odd-length hex string', () => {
    // Strict mode: odd-length input is ambiguous (left-pad vs right-pad)
    // and must be rejected to prevent silent caller bugs.
    expect(() => fromHex('abc')).toThrow(TypeError);
    expect(() => fromHex('abc')).toThrow(/odd-length/i);
  });
  test('empty string produces empty array', () => {
    expect(fromHex('').length).toBe(0);
  });
  test('throws on non-string input', () => {
    expect(() => fromHex(123)).toThrow(TypeError);
    expect(() => fromHex(null)).toThrow(TypeError);
    expect(() => fromHex(undefined)).toThrow(TypeError);
  });
});

describe('toHex', () => {
  test('converts bytes to lowercase hex', () => {
    expect(toHex(new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]))).toBe('48656c6c6f');
  });
  test('zero-pads each byte', () => {
    expect(toHex(new Uint8Array([0x0, 0xff, 0x1]))).toBe('00ff01');
  });
  test('empty array → empty string', () => {
    expect(toHex(new Uint8Array(0))).toBe('');
  });
  test('works with regular array', () => {
    expect(toHex([0xde, 0xad])).toBe('dead');
  });
});

describe('compareBytes', () => {
  test('equal arrays', () => {
    expect(compareBytes(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(true);
  });
  test('different length', () => {
    expect(compareBytes(new Uint8Array([1, 2]), new Uint8Array([1, 2, 3]))).toBe(false);
  });
  test('same length different content', () => {
    expect(compareBytes(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]))).toBe(false);
  });
  test('both empty', () => {
    expect(compareBytes(new Uint8Array(0), new Uint8Array(0))).toBe(true);
  });
});

describe('zeros', () => {
  test('creates zero-filled array of given length', () => {
    const z = zeros(5);
    expect(z.length).toBe(5);
    expect(Array.from(z)).toEqual([0, 0, 0, 0, 0]);
  });
  test('zero length', () => {
    expect(zeros(0).length).toBe(0);
  });
});

describe('copy', () => {
  test('copies a range of bytes', () => {
    const src = new Uint8Array([1, 2, 3, 4, 5]);
    const dst = new Uint8Array(5);
    copy(src, 1, dst, 0, 3);
    expect(Array.from(dst)).toEqual([2, 3, 4, 0, 0]);
  });
  test('copies with offset in dst', () => {
    const src = new Uint8Array([10, 20, 30]);
    const dst = new Uint8Array([0, 0, 0, 0, 0, 0]);
    copy(src, 0, dst, 2, 3);
    expect(Array.from(dst)).toEqual([0, 0, 10, 20, 30, 0]);
  });
  test('copy zero bytes', () => {
    const src = new Uint8Array([1, 2, 3]);
    const dst = new Uint8Array([9, 9, 9]);
    copy(src, 0, dst, 0, 0);
    expect(Array.from(dst)).toEqual([9, 9, 9]);
  });
});

describe('concat', () => {
  test('concatenates multiple arrays', () => {
    const a = new Uint8Array([1, 2]);
    const b = new Uint8Array([3, 4, 5]);
    const c = new Uint8Array([6]);
    expect(Array.from(concat(a, b, c))).toEqual([1, 2, 3, 4, 5, 6]);
  });
  test('single array', () => {
    expect(Array.from(concat(new Uint8Array([1, 2, 3])))).toEqual([1, 2, 3]);
  });
  test('no arrays', () => {
    expect(concat().length).toBe(0);
  });
  test('with empty arrays', () => {
    expect(Array.from(concat(new Uint8Array(0), new Uint8Array([7])))).toEqual([7]);
  });
  test('with regular arrays', () => {
    expect(Array.from(concat([1], [2, 3]))).toEqual([1, 2, 3]);
  });
});

/* ========================================================================
 * Coverage: fromHex invalid hex characters
 * ==================================================================== */

describe('fromHex invalid characters', () => {
  test('throws on invalid hex characters', () => {
    expect(() => fromHex('xy')).toThrow(/invalid hex characters/);
  });

  test('throws on mix of valid and invalid chars', () => {
    expect(() => fromHex('abxz')).toThrow(/invalid hex characters/);
  });
});
