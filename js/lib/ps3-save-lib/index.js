/**
 * ps3-save-lib — A generic, self-contained library for loading, decrypting,
 * and encrypting PS3 save files.
 *
 * This module provides everything needed to work with PS3 save data:
 *   - PARAM.SFO parsing and field manipulation
 *   - PARAM.PFD parsing, validation, and serialization
 *   - File-level decrypt/encrypt (custom CTR-like AES transform)
 *   - Save-folder orchestration
 *   - Low-level crypto primitives (AES, HMAC-SHA1, static keys)
 *
 * The library uses `@noble/ciphers` and `@noble/hashes` for all crypto.
 * All utility code (hex, endian) is bundled internally.
 *
 * ## Usage
 *
 * ```js
 * import {
 *   createSaveFolder, decryptToBytes, encryptBytes,
 *   rebuildChanges,
 * } from '../lib/ps3-save-lib/index.js';
 * ```
 *
 * ## API Sections
 * - **PARAM.SFO** — metadata parsing & field access (PUBLIC)
 * - **PARAM.PFD** — envelope parsing, hash validation, file encrypt/decrypt (PUBLIC)
 * - **Save Manager** — high-level save-folder orchestration (PUBLIC)
 * - **Crypto Primitives** — AES, HMAC-SHA1, static keys (LOW-LEVEL)
 * - **Utilities** — hex helpers, endian swap (LOW-LEVEL)
 */

/* ================================================================== */
/* PUBLIC API — PARAM.SFO                                              */
/* ================================================================== */

export {
  FMT,
  parseParamSfo,
  getTitle,
  getSubTitle,
  getDetail,
  getDirectoryName,
  getTitleId,
  getAccountId,
  getSfoAttribute,
  removeCopyProtection,
  getSfoAccountId,
  writeSfoAccountId,
} from './param-sfo.js';

/* ================================================================== */
/* PUBLIC API — PARAM.PFD                                              */
/* ================================================================== */

export {
  parseParamPfd,
  createParamPFD,
  cloneParamPfd,
  createPfdForFiles,
  getParamPfdCombinedData,
  decryptFile,
  encryptFile,
  isValidEntryHash,
  validAllParamHashes,
  validateParamPfdDetailed,
  rebuildParamPfd,
  getEntryKey,
  calculateHashTableEntryIndex,
  generateHashKeyForSecureFileID,
  createEncryptedEntryKey,
} from './param-pfd.js';

/* ================================================================== */
/* PUBLIC API — Save Folder                                            */
/* ================================================================== */

export {
  createSaveFolder,
  decryptToBytes,
  encryptBytes,
  isEncrypted,
  rebuildChanges,
  findEntry,
} from './save-folder.js';

/* ================================================================== */
/* LOW-LEVEL — Crypto Primitives (use with caution)                   */
/* ================================================================== */

export {
  aesEcbEncryptBlock,
  aesEcbDecryptBlock,
  encryptWithPortability,
  decryptWithPortability,
} from './crypto/aes.js';

export { ctrEncrypt, ctrDecrypt } from './crypto/ctr-like.js';

export { hmacSha1, defaultHash } from './crypto/hmac-sha1.js';

export { STATIC_KEYS, getStaticKey } from './crypto/static-keys.js';

/* ================================================================== */
/* LOW-LEVEL — Core Utilities (use with caution)                      */
/* ================================================================== */

export {
  fromHex,
  toHex,
  compareBytes,
  compareDigests,
  zeros,
  zeroize,
  copy,
  concat,
} from './util/hex.js';

export { encodeAscii, decodeAscii } from './util/ascii.js';

export {
  swap16,
  swap32,
  swap64Halves,
  readU64LE,
  writeU64LE,
  readU64BE,
  writeU64BE,
  readU64BEHalves,
  writeU64BEHalves,
  asInt32,
  asInt16,
  rInt16BE,
  rInt32BE,
  rUInt16BE,
  rUInt32BE,
  rSingleBE,
  rUniStr,
  wBytes,
  wInt8,
  wInt16BE,
  wInt32BE,
  wUInt8,
  wUInt16BE,
  wUInt32BE,
  wSingleBE,
  oneByteAnd,
} from './util/endian.js';
