/**
 * ASCII encoding/decoding helpers.
 *
 * Shared across PARAM.SFO and PARAM.PFD parsers.
 *
 * PS3 save formats use plain ASCII for filenames and field names (no
 * multi-byte UTF-8). These helpers are intentionally simple and fast.
 */

/**
 * Encode a string as a Uint8Array of ASCII bytes.
 *
 * Characters above U+00FF are masked to their low byte (& 0xFF).
 *
 * @param {string} str
 * @returns {Uint8Array}
 */
export function encodeAscii(str) {
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    out[i] = str.charCodeAt(i) & 0xff;
  }
  return out;
}

/**
 * Decode a null-terminated (or length-limited) ASCII string from a byte
 * buffer starting at `start`.
 *
 * Reads bytes until a null terminator (0x00) is encountered, or `maxLen`
 * bytes have been read (whichever comes first). If `maxLen` is omitted,
 * reads until the null terminator or end of buffer.
 *
 * @param {Uint8Array} data
 * @param {number} start   byte offset to begin reading
 * @param {number} [maxLen] maximum number of bytes to read
 * @returns {string}
 */
export function decodeAscii(data, start, maxLen) {
  // Guard against start pointing past the buffer. Without this, a corrupt
  // caller passing start > data.length would cause new Array(negative) to
  // throw an opaque "Invalid array length" RangeError with no context.
  if (start < 0 || start > data.length) {
    throw new RangeError(
      `decodeAscii: start ${start} out of bounds (buffer length ${data.length})`,
    );
  }
  const limit = maxLen !== undefined ? Math.min(start + maxLen, data.length) : data.length;
  // Pre-allocate the array with a known upper bound to avoid dynamic
  // resizing. Actual length may be shorter (null terminator).
  const parts = new Array(limit - start);
  let count = 0;
  for (let i = start; i < limit; i++) {
    const b = data[i];
    if (b === 0) break;
    parts[count++] = String.fromCharCode(b);
  }
  // Slice to actual length to avoid trailing undefined elements in join.
  return parts.slice(0, count).join('');
}
