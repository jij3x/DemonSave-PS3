/**
 * Hex / byte-array helpers.
 *
 * Hex string parsing, byte comparison, copy, concat, and related helpers.
 * These are generic utilities usable by any PS3 game save editor.
 */

/**
 * Lookup table for fast hex char → nibble conversion.
 * Indexed by char code (0-127). -1 = invalid character.
 */
const HEX_VAL = new Int8Array(128).fill(-1);
for (let i = 0; i < 10; i++) HEX_VAL[48 + i] = i; // '0'-'9'
for (let i = 0; i < 6; i++) {
  HEX_VAL[97 + i] = 10 + i; // 'a'-'f'
  HEX_VAL[65 + i] = 10 + i; // 'A'-'F'
}

/**
 * Convert a hex string to a Uint8Array.
 *
 * Requires an even-length hex string. Odd-length input is rejected with a
 * TypeError — the previous left-padding behavior was ambiguous and could
 * silently mask caller bugs. All internal callers pass even-length hex.
 *
 * Uses a 128-entry Int8Array lookup table for O(1) per-byte conversion.
 *
 * @param {string} hex
 * @returns {Uint8Array}
 */
export function fromHex(hex) {
  if (typeof hex !== 'string') {
    throw new TypeError('fromHex expects a string');
  }
  if (hex.length % 2 !== 0) {
    throw new TypeError(
      `fromHex: odd-length hex string (${hex.length} chars). Input must have an even number of hex digits.`,
    );
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    const hi = HEX_VAL[hex.charCodeAt(i * 2)];
    const lo = HEX_VAL[hex.charCodeAt(i * 2 + 1)];
    if (hi < 0 || lo < 0) {
      throw new TypeError('fromHex: input contains invalid hex characters');
    }
    out[i] = (hi << 4) | lo;
  }
  return out;
}

/**
 * Pre-computed lookup table for fast byte-to-hex conversion.
 * Each entry is the 2-character lowercase hex string for byte value 0x00-0xFF.
 */
/** @type {string[]} */
const HEX_CHARS = [];
for (let i = 0; i < 256; i++) {
  HEX_CHARS[i] = (i >>> 4).toString(16) + (i & 0xf).toString(16);
}

/**
 * Convert a Uint8Array (or array-like of bytes) to a lowercase hex string.
 *
 * Uses a pre-computed 256-entry lookup table for O(1) per-byte conversion.
 * The output array is pre-allocated to avoid dynamic resizing.
 *
 * @param {Uint8Array|number[]} bytes
 * @returns {string}
 */
export function toHex(bytes) {
  // Pre-allocate the array to avoid dynamic resizing.
  const parts = new Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    parts[i] = HEX_CHARS[bytes[i] & 0xff];
  }
  return parts.join('');
}

/**
 * Byte-for-byte comparison using a constant-time algorithm.
 *
 * Accumulates all byte differences via XOR before returning, avoiding the
 * early-exit timing leak of a naive loop. This is important when comparing
 * HMAC digests or other security-sensitive values.
 *
 * Note: The early `length !== length` exit leaks length information.
 * This is acceptable for PS3 HMAC digests (always 20 bytes), but should not
 * be used for variable-length secret comparison where length secrecy matters.
 *
 * @param {Uint8Array} a
 * @param {Uint8Array} b
 * @returns {boolean}
 */
export function compareBytes(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

/**
 * Constant-time comparison for fixed-length digests (HMAC-SHA1, etc.).
 *
 * Alias for `compareBytes` with a name that makes the security intent clear.
 * Use this instead of `compareBytes` when comparing hash digests to signal
 * that the inputs are fixed-length cryptographic values.
 *
 * @param {Uint8Array} a  expected digest (typically 20 bytes for HMAC-SHA1)
 * @param {Uint8Array} b  actual digest
 * @returns {boolean}
 */
export const compareDigests = compareBytes;

/**
 * Allocate a new zero-filled Uint8Array of the given length.
 * @param {number} length
 * @returns {Uint8Array}
 */
export function zeros(length) {
  return new Uint8Array(length);
}

/**
 * Best-effort zeroization of a Uint8Array.
 *
 * Fills the buffer with zeros immediately after sensitive material (keys,
 * decrypted plaintext, etc.) is no longer needed. This reduces the window
 * during which secrets are readable in memory.
 *
 * Note: JavaScript provides no guarantee that zeroed memory isn't still
 * referenced by GC internal copies. This is a best-effort hygiene measure,
 * not a cryptographic guarantee.
 *
 * @param {Uint8Array|null|undefined} buf
 */
export function zeroize(buf) {
  if (buf && buf.length > 0) buf.fill(0);
}

/**
 * Copy a range of bytes from src to dst.
 *
 * Uses Uint8Array.set() which throws a RangeError if the copy exceeds either
 * buffer — providing clear, immediate feedback on out-of-bounds access instead
 * of silently reading/writing undefined values.
 *
 * @param {Uint8Array} src
 * @param {number} srcStart
 * @param {Uint8Array} dst
 * @param {number} dstStart
 * @param {number} length
 */
export function copy(src, srcStart, dst, dstStart, length) {
  dst.set(src.subarray(srcStart, srcStart + length), dstStart);
}

/**
 * Concatenate multiple byte arrays.
 * @param  {...(Uint8Array|number[])} parts
 * @returns {Uint8Array}
 */
export function concat(...parts) {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}
