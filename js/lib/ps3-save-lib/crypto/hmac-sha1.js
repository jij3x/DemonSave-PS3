/**
 * HMAC-SHA1 helpers for PFD hash computation.
 *
 * Uses @noble/hashes — auditable, zero-dependency, browser-compatible.
 */

import { hmac } from '@noble/hashes/hmac.js';
import { sha1 } from '@noble/hashes/legacy.js';

/** Module-level constant for empty-data HMAC. */
const EMPTY = new Uint8Array(0);

/**
 * HMAC-SHA1 over data[start..start+length].
 *
 * Validates start/length bounds to prevent silent truncation by subarray.
 * Uses Number.isInteger to reject NaN/Infinity — these bypass numeric
 * comparison checks and would silently produce a digest over an empty/wrong
 * slice.
 *
 * @param {Uint8Array} key
 * @param {Uint8Array} data
 * @param {number} [start=0]
 * @param {number} [length]  defaults to data.length - start
 * @returns {Uint8Array} 20-byte digest
 */
export function hmacSha1(key, data, start = 0, length) {
  if (length === undefined) length = data.length - start;
  if (!Number.isInteger(start) || !Number.isInteger(length)) {
    throw new RangeError('hmacSha1: start/length must be integers');
  }
  if (start < 0 || length < 0 || start + length > data.length) {
    throw new RangeError('hmacSha1: start/length out of bounds');
  }
  const slice = data.subarray(start, start + length);
  return hmac(sha1, key, slice);
}

/**
 * HMAC-SHA1 over the empty byte array with the given key.
 *
 * @param {Uint8Array} key
 * @returns {Uint8Array} 20-byte digest
 */
export function defaultHash(key) {
  return hmac(sha1, key, EMPTY);
}
