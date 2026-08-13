/**
 * Endian / numeric helpers.
 *
 * Byte-swap helpers (UInt16/32/64) plus big-endian binary
 * readers/writers (rInt16/rInt32/rUInt16/rUInt32/rSingle,
 * wInt8/wInt16/wInt32/wUInt8/wUInt16/wUInt32/wSingle, rUniStr).
 *
 * PS3 is big-endian, so these readers/writers work for any PS3 save format.
 */

import { copy } from './hex.js';

/**
 * DataView cache keyed by Uint8Array.
 *
 * Avoids re-allocating DataView objects on every read/write call. In hot
 * paths, this eliminates dozens of short-lived DataView allocations per
 * save slot.
 *
 * The cache is keyed by the Uint8Array itself (not its .buffer) because a
 * single ArrayBuffer may be shared by multiple Uint8Array views with
 * different byteOffset/byteLength. WeakMap ensures entries are GC'd when
 * the Uint8Array is no longer referenced.
 */
const _dvCache = new WeakMap();

/**
 * Get (or create and cache) a DataView for the given Uint8Array.
 * @param {Uint8Array} bytes
 * @returns {DataView}
 */
function getDataView(bytes) {
  let dv = _dvCache.get(bytes);
  if (!dv) {
    dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    _dvCache.set(bytes, dv);
  }
  return dv;
}

/* ---- unsigned byte-swap helpers ---- */

/** @param {number} v  (uint16) @returns {number} uint16 */
export function swap16(v) {
  v = v >>> 0;
  return (((v & 0xff) << 8) | ((v & 0xff00) >> 8)) >>> 0;
}

/** @param {number} v  (uint32) @returns {number} uint32 */
export function swap32(v) {
  v = v >>> 0;
  return (
    (((v & 0xff) << 24) |
      ((v & 0xff00) << 8) |
      ((v & 0xff0000) >>> 8) |
      ((v & 0xff000000) >>> 24)) >>>
    0
  );
}

/**
 * Byte-swap a 64-bit value represented as [hi32, lo32] unsigned pair.
 * JS bitwise ops are 32-bit, so we operate on halves.
 * @param {number} hi  upper 32 bits (unsigned)
 * @param {number} lo  lower 32 bits (unsigned)
 * @returns {{hi:number, lo:number}} swapped halves
 */
export function swap64Halves(hi, lo) {
  const newLo = swap32(hi) >>> 0;
  const newHi = swap32(lo) >>> 0;
  return { hi: newHi >>> 0, lo: newLo >>> 0 };
}

/* ---- BigInt-based big-endian uint64 helpers ---- */

/**
 * Read 8 bytes as a big-endian unsigned 64-bit BigInt.
 *
 * @param {Uint8Array} buf
 * @param {number} off
 * @returns {bigint}
 */
export function readU64BE(buf, off) {
  if (off < 0 || off + 8 > buf.length) {
    throw new RangeError(
      `readU64BE out of bounds: offset ${off} + 8 > buffer length ${buf.length}`,
    );
  }
  // Use cached DataView to avoid allocating one per call.
  return getDataView(buf).getBigUint64(off, false); // false = big-endian
}

/**
 * Write a BigInt as 8 big-endian bytes.
 *
 * @param {Uint8Array} buf
 * @param {number} off
 * @param {bigint} val
 */
export function writeU64BE(buf, off, val) {
  if (off < 0 || off + 8 > buf.length) {
    throw new RangeError(
      `writeU64BE out of bounds: offset ${off} + 8 > buffer length ${buf.length}`,
    );
  }
  // Use cached DataView to avoid allocating one per call.
  getDataView(buf).setBigUint64(off, val & 0xffffffffffffffffn, false);
}

/* ---- little-endian uint64 helpers ---- */

/**
 * Read 8 bytes as a little-endian unsigned 64-bit BigInt.
 *
 * @param {Uint8Array} buf
 * @param {number} off
 * @returns {bigint}
 */
export function readU64LE(buf, off) {
  if (off < 0 || off + 8 > buf.length) {
    throw new RangeError(
      `readU64LE out of bounds: offset ${off} + 8 > buffer length ${buf.length}`,
    );
  }
  // Use cached DataView.
  return getDataView(buf).getBigUint64(off, true); // true = little-endian
}

/**
 * Write a BigInt as 8 little-endian bytes.
 *
 * @param {Uint8Array} buf
 * @param {number} off
 * @param {bigint} val
 */
export function writeU64LE(buf, off, val) {
  if (off < 0 || off + 8 > buf.length) {
    throw new RangeError(
      `writeU64LE out of bounds: offset ${off} + 8 > buffer length ${buf.length}`,
    );
  }
  // Use cached DataView.
  getDataView(buf).setBigUint64(off, val & 0xffffffffffffffffn, true);
}

/* ---- legacy [hi, lo] pair helpers ---- */

/**
 * Read 8 bytes as a big-endian uint64, returning [hi, lo].
 *
 * @deprecated Use {@link readU64BE} instead — it returns a native `bigint`
 *   which is more ergonomic and avoids manual half-word management.
 *
 * @param {Uint8Array} buf
 * @param {number} off
 * @returns {{hi:number, lo:number}}
 */
export function readU64BEHalves(buf, off) {
  if (off < 0 || off + 8 > buf.length) {
    throw new RangeError(
      `readU64BEHalves out of bounds: offset ${off} + 8 > buffer length ${buf.length}`,
    );
  }
  const hi = (buf[off] | (buf[off + 1] << 8) | (buf[off + 2] << 16) | (buf[off + 3] << 24)) >>> 0;
  const lo =
    (buf[off + 4] | (buf[off + 5] << 8) | (buf[off + 6] << 16) | (buf[off + 7] << 24)) >>> 0;
  return { hi, lo };
}

/**
 * Write [hi, lo] as 8 big-endian bytes.
 *
 * @deprecated Use {@link writeU64BE} instead — it accepts a native `bigint`
 *   which is more ergonomic and avoids manual half-word management.
 *
 * @param {Uint8Array} buf
 * @param {number} off
 * @param {number} hi
 * @param {number} lo
 */
export function writeU64BEHalves(buf, off, hi, lo) {
  if (off < 0 || off + 8 > buf.length) {
    throw new RangeError(
      `writeU64BEHalves out of bounds: offset ${off} + 8 > buffer length ${buf.length}`,
    );
  }
  buf[off] = (hi >>> 24) & 0xff;
  buf[off + 1] = (hi >>> 16) & 0xff;
  buf[off + 2] = (hi >>> 8) & 0xff;
  buf[off + 3] = hi & 0xff;
  buf[off + 4] = (lo >>> 24) & 0xff;
  buf[off + 5] = (lo >>> 16) & 0xff;
  buf[off + 6] = (lo >>> 8) & 0xff;
  buf[off + 7] = lo & 0xff;
}

/* ---- signed helpers ---- */

/** @param {number} u @returns {number} interpret uint32 as int32 */
export function asInt32(u) {
  return u > 0x7fffffff ? u - 0x100000000 : u;
}

/** @param {number} u @returns {number} interpret uint16 as int16 */
export function asInt16(u) {
  return u > 0x7fff ? u - 0x10000 : u;
}

/* ---- big-endian binary readers / writers ---- */

/**
 * Bounds-check helper. Throws RangeError if reading `size` bytes at `off`
 * would exceed the buffer.
 * @param {Uint8Array} bytes
 * @param {number} off
 * @param {number} size
 */
function assertBounds(bytes, off, size) {
  // Reject NaN/Infinity explicitly. Without this, NaN < 0 is false and
  // NaN + size > bytes.length is false, so NaN offsets would silently pass
  // and produce undefined reads.
  if (!Number.isInteger(off) || !Number.isInteger(size)) {
    throw new RangeError(
      `assertBounds: off and size must be integers (got off=${off}, size=${size})`,
    );
  }
  if (off < 0 || off + size > bytes.length) {
    throw new RangeError(
      `Read out of bounds: offset ${off} + size ${size} > buffer length ${bytes.length}`,
    );
  }
}

/** @param {Uint8Array} bytes @param {number} off @returns {number} signed 16 */
export function rInt16BE(bytes, off) {
  assertBounds(bytes, off, 2);
  const u = (bytes[off] << 8) | bytes[off + 1];
  return asInt16(u & 0xffff);
}
/** @param {Uint8Array} bytes @param {number} off @returns {number} signed 32 */
export function rInt32BE(bytes, off) {
  assertBounds(bytes, off, 4);
  const u =
    ((bytes[off] << 24) | (bytes[off + 1] << 16) | (bytes[off + 2] << 8) | bytes[off + 3]) >>> 0;
  return asInt32(u);
}
/** @param {Uint8Array} bytes @param {number} off @returns {number} uint16 */
export function rUInt16BE(bytes, off) {
  assertBounds(bytes, off, 2);
  return ((bytes[off] << 8) | bytes[off + 1]) & 0xffff;
}
/** @param {Uint8Array} bytes @param {number} off @returns {number} uint32 */
export function rUInt32BE(bytes, off) {
  assertBounds(bytes, off, 4);
  return (
    ((bytes[off] << 24) | (bytes[off + 1] << 16) | (bytes[off + 2] << 8) | bytes[off + 3]) >>> 0
  );
}
/** @param {Uint8Array} bytes @param {number} off @returns {number} float32 */
export function rSingleBE(bytes, off) {
  assertBounds(bytes, off, 4);
  // Use cached DataView to avoid allocating one per call.
  return getDataView(bytes).getFloat32(off, false);
}

/**
 * Read a PS3 RUniStr string from a byte buffer.
 *
 * Each character occupies 2 bytes in a UTF-16LE-like layout: the character
 * code's low byte comes first, followed by the high byte. This function
 * reads both bytes of each pair to support full Unicode (BMP) characters,
 * not just Latin1. Terminates on the first zero-character code point
 * (both bytes zero).
 *
 * @param {Uint8Array} bytes  buffer
 * @param {number} loc        byte offset of the first character's data
 * @param {number} maxLen     maximum number of CHARACTERS to read (not bytes)
 * @returns {string}
 */
export function rUniStr(bytes, loc, maxLen) {
  assertBounds(bytes, loc, maxLen * 2);
  // Pre-allocate the array with a known upper bound to avoid dynamic
  // resizing. Actual length may be shorter (null terminator).
  const parts = new Array(maxLen);
  let count = 0;
  for (let i = 0; i < maxLen; i++) {
    const cc = bytes[loc + i * 2] | (bytes[loc + i * 2 + 1] << 8);
    if (cc === 0) break;
    parts[count++] = String.fromCharCode(cc);
  }
  // Slice to actual length to avoid trailing undefined elements in join.
  return parts.slice(0, count).join('');
}

/** @param {Uint8Array} bytes @param {number} loc @param {Uint8Array} byt */
export function wBytes(bytes, loc, byt) {
  copy(byt, 0, bytes, loc, byt.length);
}

/** @param {Uint8Array} bytes @param {number} loc @param {number} val (uint8) */
export function wUInt8(bytes, loc, val) {
  bytes[loc] = val & 0xff;
}
/** @param {Uint8Array} bytes @param {number} loc @param {number} val (uint16) */
export function wUInt16BE(bytes, loc, val) {
  const v = val & 0xffff;
  bytes[loc] = (v >> 8) & 0xff;
  bytes[loc + 1] = v & 0xff;
}
/** @param {Uint8Array} bytes @param {number} loc @param {number} val (uint32) */
export function wUInt32BE(bytes, loc, val) {
  const v = val >>> 0;
  bytes[loc] = (v >>> 24) & 0xff;
  bytes[loc + 1] = (v >>> 16) & 0xff;
  bytes[loc + 2] = (v >>> 8) & 0xff;
  bytes[loc + 3] = v & 0xff;
}

/** Signed alias for wUInt8 (identical bit-level write). */
export const wInt8 = wUInt8;
/** Signed alias for wUInt16BE (identical bit-level write). */
export const wInt16BE = wUInt16BE;
/** Signed alias for wUInt32BE (identical bit-level write). */
export const wInt32BE = wUInt32BE;

/** @param {Uint8Array} bytes @param {number} loc @param {number} val (float32) */
export function wSingleBE(bytes, loc, val) {
  assertBounds(bytes, loc, 4);
  // Use cached DataView to avoid allocating one per call.
  getDataView(bytes).setFloat32(loc, val, false);
}

/**
 * Bit-test helper.
 *
 * @param {Uint8Array} bytes
 * @param {number} loc
 * @param {number} mask
 * @returns {boolean}
 */
export function oneByteAnd(bytes, loc, mask) {
  assertBounds(bytes, loc, 1);
  return (bytes[loc] & mask) > 0;
}
