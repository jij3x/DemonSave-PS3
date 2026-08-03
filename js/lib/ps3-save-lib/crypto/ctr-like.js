/**
 * Custom CTR-like transform used to encrypt/decrypt each protected PS3 save
 * file. Implements a custom counter-mode variant using AES-ECB.
 *
 * Algorithm per 16-byte block i:
 *   - Resize key to 16 bytes.
 *   - x1, x2 = AES-ECB instances with that key, zero-padding.
 *   - buffer = 16-byte zero block; first 8 bytes = big-endian block index i.
 *   - keystream = AES-ECB-Encrypt(x1, buffer).
 *
 *   Decrypt: block = AES-ECB-Decrypt(x2, cipher)  XOR keystream.
 *   Encrypt: block = AES-ECB-Encrypt(x2, plain XOR keystream).
 *
 * The counter only touches the low 8 bytes; bytes 8..15 of the buffer are
 * always zero. Since i is a block index (0, 1, 2, ...), only the low bytes
 * ever become nonzero, and the byte-swap of a 64-bit value puts the MSB of
 * `i` into the lowest memory address (big-endian representation of i).
 *
 * Performance: cipher context is created once (not per-block), and all
 * counter blocks are batch-encrypted in a single ECB call.
 */

import { ecb } from '@noble/ciphers/aes.js';

/**
 * Build a buffer containing all counter blocks for 0..numBlocks-1
 * concatenated. Each counter block is 16 bytes: bytes 0..7 are the
 * big-endian 64-bit block index, bytes 8..15 are zero.
 *
 * @param {number} numBlocks
 * @returns {Uint8Array} numBlocks × 16 bytes
 */
function buildAllCounters(numBlocks) {
  // Sanity cap to prevent OOM from accidental huge inputs. 1M blocks
  // (16 MB) is far beyond any PS3 save file size (~512 KB max).
  if (numBlocks > 0x100000) {
    throw new Error(
      `ctrDecrypt/ctrEncrypt: block count ${numBlocks} exceeds sanity limit (1M blocks = 16MB)`,
    );
  }
  const buf = new Uint8Array(numBlocks * 16);
  for (let i = 0; i < numBlocks; i++) {
    const off = i * 16;
    // Write `i` as big-endian 64-bit into bytes 0..7.
    // JS bitwise is 32-bit, so split into halves.
    const lo = i >>> 0;
    const hi = Math.floor(i / 0x100000000) >>> 0;
    buf[off + 0] = (hi >>> 24) & 0xff;
    buf[off + 1] = (hi >>> 16) & 0xff;
    buf[off + 2] = (hi >>> 8) & 0xff;
    buf[off + 3] = hi & 0xff;
    buf[off + 4] = (lo >>> 24) & 0xff;
    buf[off + 5] = (lo >>> 16) & 0xff;
    buf[off + 6] = (lo >>> 8) & 0xff;
    buf[off + 7] = lo & 0xff;
    // bytes 8..15 already zero
  }
  return buf;
}

/**
 * Resize key to exactly 16 bytes (extend with zeros if shorter, truncate
 * if longer).
 *
 * @param {Uint8Array} key
 * @returns {Uint8Array}
 */
function resizeKey16(key) {
  if (key.length === 16) return key;
  const out = new Uint8Array(16);
  out.set(key.subarray(0, Math.min(key.length, 16)), 0);
  return out;
}

/**
 * Decrypt using the custom CTR-like transform.
 *
 * Creates the AES-ECB cipher once, batch-generates all keystream blocks in
 * a single encrypt call, and batch-decrypts all cipher blocks in a single
 * decrypt call.
 *
 * @param {Uint8Array} key    file key (will be resized to 16 bytes)
 * @param {Uint8Array} input  ciphertext
 * @param {number} length     number of bytes to process (multiple of 16)
 * @returns {Uint8Array} plaintext, length = `length`
 */
export function ctrDecrypt(key, input, length) {
  const k = resizeKey16(key);
  const numBlocks = Math.floor(length / 16);
  if (numBlocks === 0) return new Uint8Array(0);

  // Separate cipher objects for keystream-gen and data-decrypt
  // (noble v2 cipher objects are single-use per operation type)
  const encCipher = ecb(k, { disablePadding: true });
  const decCipher = ecb(k, { disablePadding: true });

  // Batch keystream generation — one encrypt for all counter blocks
  const allCounters = buildAllCounters(numBlocks);
  const allKeystreams = encCipher.encrypt(allCounters);

  // Batch decrypt all cipher blocks at once
  const cipherBytes = input.subarray(0, numBlocks * 16);
  const allDecrypted = decCipher.decrypt(cipherBytes);

  // XOR decrypted blocks with keystream blocks
  const output = new Uint8Array(numBlocks * 16);
  for (let i = 0; i < numBlocks * 16; i++) {
    output[i] = allDecrypted[i] ^ allKeystreams[i];
  }
  return output;
}

/**
 * Encrypt using the custom CTR-like transform.
 *
 * Creates the AES-ECB cipher once, batch-generates all keystream blocks in
 * a single encrypt call, and batch-encrypts all XOR'd blocks in a single
 * encrypt call.
 *
 * @param {Uint8Array} key    file key (will be resized to 16 bytes)
 * @param {Uint8Array} input  plaintext
 * @param {number} length     number of bytes to process (multiple of 16)
 * @returns {Uint8Array} ciphertext, length = `length`
 */
export function ctrEncrypt(key, input, length) {
  const k = resizeKey16(key);
  const numBlocks = Math.floor(length / 16);
  if (numBlocks === 0) return new Uint8Array(0);

  // Separate cipher objects for keystream-gen and data-encrypt
  // (noble v2 cipher objects are single-use per operation type)
  const ksCipher = ecb(k, { disablePadding: true });
  const encCipher = ecb(k, { disablePadding: true });

  // Batch keystream generation — one encrypt for all counter blocks
  const allCounters = buildAllCounters(numBlocks);
  const allKeystreams = ksCipher.encrypt(allCounters);

  // XOR plaintext with keystream
  const xored = new Uint8Array(numBlocks * 16);
  for (let i = 0; i < numBlocks * 16; i++) {
    xored[i] = input[i] ^ allKeystreams[i];
  }

  // Batch encrypt all XOR'd blocks at once
  return encCipher.encrypt(xored);
}
