/**
 * Defensive bounds-check helpers for savefile parsing/writing.
 *
 * These exist to eliminate `istanbul ignore` annotations at call sites:
 * instead of an inline `if (…) throw` branch (which is unreachable due to
 * upstream guards and therefore can't be covered), the check is delegated
 * to a function call. The function itself is independently unit-tested,
 * so the defensive logic is verified without needing to trigger it from
 * the caller's context.
 */

/**
 * Assert that a byte range [offset, offset + size) fits within the buffer.
 *
 * @param {Uint8Array} bytes
 * @param {number} offset
 * @param {number} size
 * @throws {Error} if the range exceeds the buffer length
 */
export function assertBounds(bytes, offset, size) {
  if (offset < 0 || offset + size > bytes.length) {
    throw new Error(
      `Buffer out of bounds: offset ${offset} + size ${size} > length ${bytes.length}`,
    );
  }
}

/**
 * Assert that a value stays below a logical region boundary.
 *
 * Used to prevent one save-region scan (e.g. inventory) from crossing
 * into another region (e.g. the durability table) on corrupt data.
 *
 * @param {number} value
 * @param {number} limit
 * @param {string} label  human-readable context for the error message
 * @throws {Error} if `value >= limit`
 */
export function assertBelow(value, limit, label) {
  if (value >= limit) {
    throw new Error(
      `${label}: crossed region boundary (value ${value} >= limit ${limit})`,
    );
  }
}