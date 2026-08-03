/**
 * AES primitives for PS3 save file encryption/decryption.
 *
 *  - decryptWithPortability / encryptWithPortability : AES-128-CBC with
 *    zero-padding, key = syscon_manager_key. Used for the 64-byte PFD
 *    signature block and entry key encryption.
 *
 *  - aesEcbEncrypt / aesEcbDecrypt : raw AES-128 block (ECB, zero-padding)
 *    used by the custom CTR-like transform.
 *
 * @noble/ciphers provides CBC and ECB with no built-in padding (caller
 * handles alignment). PS3 save crypto uses zero-padding semantics.
 */

import { cbc, ecb } from '@noble/ciphers/aes.js';
import { getStaticKey } from './static-keys.js';

/* ---- zero-padding helpers ---- */

/**
 * Zero-pad input to the next multiple of 16 bytes.
 *
 * Always returns a new buffer, even when the input is already aligned,
 * to eliminate aliasing bugs where the caller or crypto library might
 * mutate the returned buffer and corrupt the original input.
 *
 * @param {Uint8Array} input
 * @returns {Uint8Array} a new buffer, always independent of the input
 */
function zeroPadToBlock(input) {
  const rem = input.length % 16;
  if (rem === 0) return input.slice();
  const out = new Uint8Array(input.length + (16 - rem));
  out.set(input, 0);
  return out;
}

/* ---- CBC with manual zero-padding ---- */

/**
 * AES-128-CBC decrypt with zero-padding.
 *
 * @param {Uint8Array} iv       IV (resized to 16 bytes if not already)
 * @param {Uint8Array} data     ciphertext
 * @param {number} dataSize     number of bytes to decrypt
 * @returns {Uint8Array} plaintext (may be padded to block multiple by zero-padding)
 */
export function decryptWithPortability(iv, data, dataSize) {
  const key = getStaticKey('syscon_manager_key');
  // Resize IV to 16 bytes if needed.
  let ivBytes = iv;
  if (ivBytes.length !== 16) {
    ivBytes = new Uint8Array(16);
    ivBytes.set(iv.subarray(0, Math.min(iv.length, 16)));
  }
  const padded = zeroPadToBlock(data.slice(0, dataSize));
  const cipher = cbc(key, ivBytes, { disablePadding: true });
  return cipher.decrypt(padded);
}

/**
 * AES-128-CBC encrypt with zero-padding.
 *
 * @param {Uint8Array} iv
 * @param {Uint8Array} data
 * @param {number} dataSize
 * @returns {Uint8Array} ciphertext (same length as input after zero-pad to block)
 */
export function encryptWithPortability(iv, data, dataSize) {
  const key = getStaticKey('syscon_manager_key');
  // Resize IV to 16 bytes if needed.
  let ivBytes = iv;
  if (ivBytes.length !== 16) {
    ivBytes = new Uint8Array(16);
    ivBytes.set(iv.subarray(0, Math.min(iv.length, 16)));
  }
  const padded = zeroPadToBlock(data.slice(0, dataSize));
  const cipher = cbc(key, ivBytes, { disablePadding: true });
  return cipher.encrypt(padded);
}

/* ---- raw ECB block ops for the CTR-like transform ---- */

/**
 * AES-ECB encrypt one 16-byte block.
 *
 * @param {Uint8Array} key   16 bytes
 * @param {Uint8Array} block 16 bytes
 * @returns {Uint8Array} 16 bytes
 */
export function aesEcbEncryptBlock(key, block) {
  if (block.length !== 16) throw new Error('AES block must be exactly 16 bytes');
  const cipher = ecb(key, { disablePadding: true });
  return cipher.encrypt(block);
}

/**
 * AES-ECB decrypt one 16-byte block.
 *
 * @param {Uint8Array} key   16 bytes
 * @param {Uint8Array} block 16 bytes
 * @returns {Uint8Array} 16 bytes
 */
export function aesEcbDecryptBlock(key, block) {
  if (block.length !== 16) throw new Error('AES block must be exactly 16 bytes');
  const cipher = ecb(key, { disablePadding: true });
  return cipher.decrypt(block);
}
