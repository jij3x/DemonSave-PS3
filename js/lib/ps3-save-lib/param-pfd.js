/**
 * PARAM.PFD envelope: header, signature, hash/entry tables, realkey derivation,
 * validation/repair, and file decrypt/encrypt.
 *
 * On-disk layout (version 3/4):
 *   offset 0   : magic  0x50464442 ("PFDB") as big-endian u64
 *   offset 8   : version (3 or 4) as big-endian u64
 *   offset 16  : header_table_iv (16 bytes)
 *   offset 32  : encrypted signature (64 bytes, AES-CBC with header_table_iv)
 *   offset 96  : hash table header (num_reserved, num_total, num_used as BE u64)
 *                + num_reserved × 8-byte entry pointers (BE u64)
 *   variable   : PFDEntries (num_used × 0x110 bytes)
 *   variable   : reserved padding (0x110 × (num_total - num_used) bytes, zeroed)
 *   variable   : signature table (num_reserved × 20-byte HMAC slots)
 *   padded to 0x8000 total
 *
 * Identity fields (consoleID, userID, authID, discHashKey) are initialized to
 * hardcoded defaults rather than parsed from the PFD binary. For non-trophy
 * saves, only hash index 0 is validated, so this is correct for game saves.
 * Trophy saves on real hardware would need actual identity fields parsed from
 * the appropriate PFD section.
 */

import { compareBytes, zeroize } from './util/hex.js';
import { encodeAscii, decodeAscii } from './util/ascii.js';
import { decryptWithPortability, encryptWithPortability } from './crypto/aes.js';
import { ctrDecrypt, ctrEncrypt } from './crypto/ctr-like.js';
import { hmacSha1, defaultHash } from './crypto/hmac-sha1.js';
import { getStaticKey } from './crypto/static-keys.js';
import { readU64BE, writeU64BE } from './util/endian.js';

/* ------------------------------------------------------------------ */
/* PFDEntry                                                            */
/* ------------------------------------------------------------------ */

/**
 * @typedef {Object} PFDEntry
 * @property {bigint} additionEntry   chain pointer (0xFFFFFFFFFFFFFFFF = end)
 * @property {string} fileName
 * @property {Uint8Array} padding0      7 bytes
 * @property {Uint8Array} key           64 bytes
 * @property {Uint8Array[]} fileHashes  4 × 20 bytes
 * @property {Uint8Array} padding1      40 bytes
 * @property {bigint} fileSize
 */

/**
 * @typedef {Object} ParamPFD
 * @property {bigint} magic            PFD magic (0x50464442n = "PFDB")
 * @property {bigint} version          PFD version (3 or 4)
 * @property {Uint8Array} headerTableIv  16-byte header table IV
 * @property {Uint8Array} bottomHash     20-byte HMAC bottom hash
 * @property {Uint8Array} topHash        20-byte HMAC top hash
 * @property {Uint8Array} hashKey        20-byte hash key (from signature)
 * @property {Uint8Array} padding        4-byte signature padding
 * @property {Uint8Array} realkey        20-byte derived realkey
 * @property {bigint} numReserved       hash table bucket count
 * @property {bigint} numTotal          total entry slots (used + reserved)
 * @property {bigint} numUsed           active entry count
 * @property {bigint[]} hashEntries     hash table entry pointers
 * @property {PFDEntry[]} entries       file entries
 * @property {Uint8Array[]} sigTable    signature table (numReserved × 20 bytes)
 * @property {Uint8Array} consoleID     32-byte console ID
 * @property {Uint8Array} userID        8-byte user ID
 * @property {Uint8Array} authID        8-byte auth ID
 * @property {Uint8Array} discHashKey   16-byte disc hash key
 * @property {Uint8Array|null} secureFileID  16-byte secure file ID
 * @property {boolean} isTrophy         whether this is a trophy save
 */

/**
 * Serialize a PFDEntry to its full 0x110-byte on-disk representation.
 * @param {PFDEntry} entry
 * @returns {Uint8Array}
 */
function entryData(entry) {
  // Validate filename fits in the 65-byte field (no silent truncation).
  const nameBytes = encodeAscii(entry.fileName);
  if (nameBytes.length > 65) {
    throw new Error(
      `PFD entry filename too long (${nameBytes.length} > 65 bytes): "${entry.fileName}"`,
    );
  }

  const buf = new Uint8Array(0x110);
  // additional_index as BE u64
  writeU64BE(buf, 0, entry.additionEntry);
  // filename: 65 bytes, ASCII, null-padded
  buf.set(nameBytes, 8);
  // padding_0: 7 bytes (already zero)
  buf.set(entry.padding0, 8 + 65);
  // key: 64 bytes
  buf.set(entry.key, 8 + 65 + 7);
  // 4 × file_hashes: 80 bytes
  let off = 8 + 65 + 7 + 64;
  for (let i = 0; i < 4; i++) {
    buf.set(entry.fileHashes[i], off);
    off += 20;
  }
  // padding_1: 40 bytes
  buf.set(entry.padding1, off);
  off += 40;
  // file_size as BE u64
  writeU64BE(buf, off, entry.fileSize);
  return buf;
}

/**
 * Write an entry's hash data directly into a pre-allocated buffer at the
 * given offset. Zero-allocation variant used by getBucketChainHash() for
 * chain validation.
 *
 * @param {PFDEntry} entry
 * @param {Uint8Array} buf  target buffer
 * @param {number} off      byte offset within buf
 */
function writeEntryHashData(entry, buf, off) {
  const ENTRY_HASH_SIZE = 65 + 64 + 80 + 40 + 8; // 257 bytes
  if (off + ENTRY_HASH_SIZE > buf.length) {
    throw new RangeError(
      `writeEntryHashData: buffer too small (need ${off + ENTRY_HASH_SIZE} bytes, ` +
        `have ${buf.length})`,
    );
  }
  // Validate filename length
  const nameBytes = encodeAscii(entry.fileName);
  if (nameBytes.length > 65) {
    throw new Error(
      `PFD entry filename too long (${nameBytes.length} > 65 bytes): "${entry.fileName}"`,
    );
  }
  // 65 (name) + 64 (key) + 80 (4×20 hashes) + 40 (padding1) + 8 (file_size) = 257
  buf.set(nameBytes.subarray(0, Math.min(nameBytes.length, 65)), off);
  // Zero-fill remaining name bytes (buffer may be reused)
  for (let i = nameBytes.length; i < 65; i++) buf[off + i] = 0;
  off += 65;
  buf.set(entry.key, off);
  off += 64;
  for (let i = 0; i < 4; i++) {
    buf.set(entry.fileHashes[i], off);
    off += 20;
  }
  buf.set(entry.padding1, off);
  off += 40;
  writeU64BE(buf, off, entry.fileSize);
}

/* ------------------------------------------------------------------ */
/* Hash helpers                                                        */
/* ------------------------------------------------------------------ */

/**
 * PS3 string hash used to bucket entries.
 *
 * Computes (h*31+c) mod numReserved, with h as a 64-bit unsigned value.
 * This hash is **case-sensitive** — changing it to case-insensitive would
 * break compatibility with real PS3 saves.
 *
 * @param {string} name
 * @param {bigint} numReserved
 * @returns {bigint}
 */
export function calculateHashTableEntryIndex(name, numReserved) {
  if (numReserved <= 0n) {
    throw new Error('numReserved must be positive');
  }
  let hash = 0n;
  // BigInt is required for 64-bit unsigned wraparound. JS Number loses
  // precision beyond 2^53. (hash << 5) - hash == hash * 31.
  const mod = 1n << 64n; // 2^64
  for (let i = 0; i < name.length; i++) {
    const c = BigInt(name.charCodeAt(i) & 0xff); // low byte of char code
    hash = (((hash * 31n + c) % mod) + mod) % mod;
  }
  return hash % numReserved;
}

/**
 * Interleave a 16-byte SecureFileID into a 20-byte hash key with magic
 * bytes at positions 1, 2, 5, 8.
 *
 * @param {Uint8Array} secureId  16 bytes
 * @returns {Uint8Array} 20 bytes
 */
export function generateHashKeyForSecureFileID(secureId) {
  if (secureId.length !== 16) {
    throw new Error('SecureFileID must be 16 bytes in length');
  }
  const key = new Uint8Array(20);

  // Walk positions 0..19, inserting magic constants at fixed positions
  // (1, 2, 5, 8) and copying from secureId[j] at all other positions.
  // Exactly 16 bytes of secureId are consumed (20 positions - 4 magic).
  let i = 0;
  let j = 0;
  while (i < key.length) {
    switch (i) {
      case 1:
        key[i] = 11;
        break;
      case 2:
        key[i] = 15;
        break;
      case 5:
        key[i] = 14;
        break;
      case 8:
        key[i] = 10;
        break;
      default:
        key[i] = secureId[j];
        j++;
        break;
    }
    i++;
  }
  return key;
}

/* ------------------------------------------------------------------ */
/* ParamPFD class                                                      */
/* ------------------------------------------------------------------ */

/**
 * Default identity fields. These are hardcoded defaults, NOT parsed from
 * the PFD binary (see module-level note).
 */
const DEFAULT_CONSOLE_ID = new Uint8Array(32); // all zeros
const DEFAULT_USER_ID = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 1]);
const DEFAULT_AUTH_ID = new Uint8Array([0x10, 0x10, 0x00, 0x00, 0x01, 0x00, 0x00, 0x03]);
const DEFAULT_DISC_HASH_KEY = getStaticKey('fallback_disc_hash_key');

/** PFD total file size after padding */
const PFD_TOTAL_SIZE = 0x8000;

/**
 * Create an empty ParamPFD object.
 * @returns {ParamPFD}
 */
export function createParamPFD() {
  return {
    // Header
    magic: 0x50464442n,
    version: 4n,
    headerTableIv: new Uint8Array(16),
    // Signature (decrypted plaintext)
    bottomHash: new Uint8Array(20),
    topHash: new Uint8Array(20),
    hashKey: new Uint8Array(20),
    padding: new Uint8Array(4),
    // Derived
    realkey: new Uint8Array(20),
    // Hash table
    numReserved: 0n,
    numTotal: 0n,
    numUsed: 0n,
    hashEntries: [], // Array<bigint>
    // Entries
    entries: [], // Array<PFDEntry>
    // Signature table
    sigTable: [], // Array<Uint8Array(20)>
    // Identity (settable)
    consoleID: DEFAULT_CONSOLE_ID.slice(),
    userID: DEFAULT_USER_ID.slice(),
    authID: DEFAULT_AUTH_ID.slice(),
    discHashKey: DEFAULT_DISC_HASH_KEY.slice(),
    secureFileID: null,
    isTrophy: false,
  };
}

/**
 * Deep-clone a ParamPFD object, copying all Uint8Array fields so the clone
 * is fully independent of the original. Useful for preserving original PFD
 * state before applying modifications.
 *
 * @param {ParamPFD} pfd
 * @returns {ParamPFD}
 */
export function cloneParamPfd(pfd) {
  const clone = createParamPFD();
  clone.magic = pfd.magic;
  clone.version = pfd.version;
  clone.headerTableIv = pfd.headerTableIv.slice();
  clone.bottomHash = pfd.bottomHash.slice();
  clone.topHash = pfd.topHash.slice();
  clone.hashKey = pfd.hashKey.slice();
  clone.padding = pfd.padding.slice();
  clone.realkey = pfd.realkey.slice();
  clone.numReserved = pfd.numReserved;
  clone.numTotal = pfd.numTotal;
  clone.numUsed = pfd.numUsed;
  clone.hashEntries = [...pfd.hashEntries];
  clone.entries = pfd.entries.map((entry) => ({
    additionEntry: entry.additionEntry,
    fileName: entry.fileName,
    padding0: entry.padding0.slice(),
    key: entry.key.slice(),
    fileHashes: entry.fileHashes.map((h) => h.slice()),
    padding1: entry.padding1.slice(),
    fileSize: entry.fileSize,
  }));
  clone.sigTable = pfd.sigTable.map((s) => s.slice());
  clone.consoleID = pfd.consoleID.slice();
  clone.userID = pfd.userID.slice();
  clone.authID = pfd.authID.slice();
  clone.discHashKey = pfd.discHashKey.slice();
  clone.secureFileID = pfd.secureFileID ? pfd.secureFileID.slice() : null;
  clone.isTrophy = pfd.isTrophy;
  return clone;
}

/**
 * Parse a PARAM.PFD byte buffer.
 *
 * All parsed fields are copied into fresh buffers — the parsed PFD is fully
 * independent of the input `data` buffer. Callers can safely mutate or
 * discard `data` after parsing.
 *
 * @param {Uint8Array} data
 * @param {(msg:string)=>void} [onProgress]
 * @returns {ParamPFD}
 */
export function parseParamPfd(data, onProgress) {
  if (!(data instanceof Uint8Array)) {
    throw new TypeError('parseParamPfd: data must be a Uint8Array');
  }

  const p = createParamPFD();
  const log = onProgress || (() => {});

  log('Initializing Param.PFD stream..');

  // Validate minimum buffer size for header + encrypted signature + the three
  // count fields. The counts (numReserved/numTotal/numUsed) live at offsets
  // 96/104/112, so 120 bytes are required before the first table read; without
  // this, a 96–119 byte buffer would reach readU64BE and throw a RangeError
  // instead of a clean domain error.
  if (data.length < 120) {
    throw new Error('PFD data too short (minimum 120 bytes for header + signature + counts)');
  }

  // Magic (BE u64)
  p.magic = readU64BE(data, 0);
  if (p.magic !== 0x50464442n) {
    log('Invalid PFD File!');
    throw new Error(`Invalid PFD File! (magic: 0x${p.magic.toString(16)}, expected 0x50464442)`);
  }

  // Version (BE u64)
  p.version = readU64BE(data, 8);
  if (p.version !== 3n && p.version !== 4n) {
    log('Unsupported PFD version!');
    throw new Error(`Unsupported PFD version! (version: ${p.version}, expected 3 or 4)`);
  }

  log('Allocating Header Data..');
  // Copy header_table_iv into a fresh buffer.
  p.headerTableIv = data.subarray(16, 32).slice();

  // Encrypted signature (64 bytes at offset 32)
  const encSig = data.subarray(32, 96);
  const sig = decryptWithPortability(p.headerTableIv, encSig, 64);
  // sig is a fresh buffer from decrypt; subarray views are safe (never mutated)
  p.bottomHash = sig.subarray(0, 20).slice();
  p.topHash = sig.subarray(20, 40).slice();
  p.hashKey = sig.subarray(40, 60).slice();
  p.padding = sig.subarray(60, 64).slice();

  // Derive realkey
  if (p.version === 4n) {
    const keygenKey = getStaticKey('keygen_key');
    p.realkey = hmacSha1(keygenKey, p.hashKey, 0, 20);
  } else {
    p.realkey = p.hashKey.slice();
  }

  // Hash table (starts at offset 96)
  let off = 96;
  log('Reading Entries..');
  p.numReserved = readU64BE(data, off);
  off += 8;
  p.numTotal = readU64BE(data, off);
  off += 8;
  p.numUsed = readU64BE(data, off);
  off += 8;

  // Sanity-check header counts to prevent runaway loops / OOM on corrupt data.
  const capNum = Number(p.numReserved);
  if (!Number.isSafeInteger(capNum) || capNum < 0 || capNum > 100000) {
    throw new Error('Invalid PFD: numReserved is unreasonably large or corrupt');
  }
  const usedNum = Number(p.numUsed);
  if (!Number.isSafeInteger(usedNum) || usedNum < 0 || usedNum > capNum) {
    throw new Error('Invalid PFD: numUsed is corrupt');
  }
  // Validate numTotal >= numUsed to prevent negative reserved-padding skip.
  if (p.numTotal < p.numUsed) {
    throw new Error('Invalid PFD: numTotal < numUsed');
  }
  // Validate that the hash-entry pointers fit within the buffer.
  if (off + capNum * 8 > data.length) {
    throw new Error('Invalid PFD: hash table extends past buffer');
  }

  log(`Reading table numReserved (${p.numReserved} entries)..`);
  p.hashEntries = [];
  for (let i = 0; i < capNum; i++) {
    p.hashEntries.push(readU64BE(data, off));
    off += 8;
  }

  // PFDEntries
  log(`Reading used tables (${p.numUsed} entries)..`);
  // Validate entry table fits within the buffer.
  if (off + usedNum * 0x110 > data.length) {
    throw new Error(
      `Invalid PFD: entry table extends past buffer (${usedNum} entries × 0x110 = ${usedNum * 0x110} bytes from offset ${off}, buffer is ${data.length} bytes)`,
    );
  }
  p.entries = [];
  for (let i = 0; i < usedNum; i++) {
    const entry = readEntry(data, off);
    p.entries.push(entry);
    off += 0x110;
  }

  // Skip reserved padding
  off += 0x110 * Number(p.numTotal - p.numUsed);

  // Signature table
  log(`Reading file table hashes (${p.numReserved} entries)..`);
  // Validate signature table fits within the buffer.
  if (off + capNum * 20 > data.length) {
    throw new Error('Invalid PFD: signature table extends past buffer');
  }
  p.sigTable = [];
  for (let i = 0; i < capNum; i++) {
    // Copy sig table entries into fresh buffers.
    p.sigTable.push(data.subarray(off, off + 20).slice());
    off += 20;
  }

  return p;
}

/**
 * Read a single PFDEntry from a buffer at the given offset.
 *
 * All fields are copied into fresh buffers — the returned entry is fully
 * independent of the input `data` buffer.
 *
 * @param {Uint8Array} data
 * @param {number} off
 * @returns {PFDEntry}
 */
function readEntry(data, off) {
  const additionEntry = readU64BE(data, off);
  const fileName = decodeAscii(data, off + 8, 65);
  // Copy all fields into fresh buffers.
  const padding0 = data.subarray(off + 8 + 65, off + 8 + 65 + 7).slice();
  const key = data.subarray(off + 8 + 65 + 7, off + 8 + 65 + 7 + 64).slice();
  let ho = off + 8 + 65 + 7 + 64;
  const fileHashes = [];
  for (let j = 0; j < 4; j++) {
    fileHashes.push(data.subarray(ho, ho + 20).slice());
    ho += 20;
  }
  const padding1 = data.subarray(ho, ho + 40).slice();
  ho += 40;
  const fileSize = readU64BE(data, ho);
  return { additionEntry, fileName, padding0, key, fileHashes, padding1, fileSize };
}

/* ------------------------------------------------------------------ */
/* Key derivation                                                      */
/* ------------------------------------------------------------------ */

/**
 * Get the hash key for a SFO entry at the given hash index.
 *
 * Returns copies of identity fields (consoleID, discHashKey, authID) to
 * prevent mutation of the PFD's internal state. Throws RangeError for
 * hashIndex outside 0-3.
 *
 * @param {number} hashIndex  0-3
 * @param {ParamPFD} pfd
 * @returns {Uint8Array}
 */
function generateHashKeyForSFO(hashIndex, pfd) {
  switch (hashIndex) {
    case 0:
      return getStaticKey('savegame_param_sfo_key');
    case 1:
      return pfd.consoleID.slice();
    case 2:
      return pfd.discHashKey.slice();
    case 3:
      return pfd.authID.slice();
    default:
      throw new RangeError(
        `generateHashKeyForSFO: hashIndex ${hashIndex} out of range (expected 0-3)`,
      );
  }
}

/**
 * Get the per-entry-per-hash-index HMAC key.
 *
 * @param {PFDEntry} entry
 * @param {number} hashIndex
 * @param {ParamPFD} pfd
 * @returns {Uint8Array}
 */
function getEntryHashKey(entry, hashIndex, pfd) {
  const name = entry.fileName.toLowerCase();
  switch (name) {
    case 'param.sfo':
      return generateHashKeyForSFO(hashIndex, pfd);
    case 'tropsys.dat':
      return getStaticKey('tropsys_dat_key');
    case 'tropusr.dat':
      return getStaticKey('tropusr_dat_key');
    case 'troptrns.dat':
      return getStaticKey('troptrns_dat_key');
    case 'tropconf.sfm':
      return getStaticKey('tropconf_sfm_key');
    default:
      if (!pfd.secureFileID || pfd.secureFileID.length !== 16) {
        throw new Error('SecureFileID is not valid! length must be 16 bytes');
      }
      return generateHashKeyForSecureFileID(pfd.secureFileID);
  }
}

/**
 * Derive the 16-byte AES key used by the CTR-like file cipher.
 *
 * @param {PFDEntry} entry
 * @param {ParamPFD} pfd
 * @returns {Uint8Array} 16 bytes
 */
export function getEntryKey(entry, pfd) {
  const hashKey = getEntryHashKey(entry, 0, pfd);
  const decrypted = decryptWithPortability(hashKey, entry.key, entry.key.length);
  const key = decrypted.slice(0, 16);
  // Zeroize intermediate buffers containing the full decrypted entry key.
  zeroize(decrypted);
  zeroize(hashKey);
  return key;
}

/**
 * Iterate over the active hash indices for an entry, calling `cb(index, key)`
 * for each. Handles the SFO/trophy filtering logic and caches the
 * SecureFileID-derived key for non-SFO files.
 *
 * @param {PFDEntry} entry
 * @param {ParamPFD} pfd
 * @param {(hashIndex: number, hashKey: Uint8Array) => boolean | void} cb
 *   Return `false` to stop iteration (zeroizes cached key and returns).
 */
function forEachActiveHashIndex(entry, pfd, cb) {
  const isSfo = entry.fileName.toLowerCase() === 'param.sfo';
  let cachedKey = null;
  for (let i = 0; i < 4; i++) {
    if (isSfo && !pfd.isTrophy && i !== 0) continue;
    if (!pfd.isTrophy && i > 0) continue;
    if (!isSfo) {
      if (!cachedKey) cachedKey = getEntryHashKey(entry, i, pfd);
      // Zeroize the cached key before early-exit so the HMAC key doesn't
      // linger in memory.
      if (cb(i, cachedKey) === false) {
        zeroize(cachedKey);
        return;
      }
    } else {
      if (cb(i, getEntryHashKey(entry, i, pfd)) === false) return;
    }
  }
  // Zeroize the cached key after normal completion.
  zeroize(cachedKey);
}

/* ------------------------------------------------------------------ */
/* Top/Bottom/Default hashes                                           */
/* ------------------------------------------------------------------ */

/**
 * Serialize the hash table to its on-disk buffer.
 * @param {ParamPFD} pfd
 * @returns {Uint8Array}
 */
function hashTableBuffer(pfd) {
  const buf = new Uint8Array(24 + pfd.hashEntries.length * 8);
  writeU64BE(buf, 0, pfd.numReserved);
  writeU64BE(buf, 8, pfd.numTotal);
  writeU64BE(buf, 16, pfd.numUsed);
  for (let i = 0; i < pfd.hashEntries.length; i++) {
    writeU64BE(buf, 24 + i * 8, pfd.hashEntries[i]);
  }
  return buf;
}

/**
 * Serialize the signature table to its on-disk buffer.
 * @param {ParamPFD} pfd
 * @returns {Uint8Array}
 */
function sigTableBuffer(pfd) {
  const numSlots = pfd.sigTable.length;
  const buf = new Uint8Array(numSlots * 20);
  for (let i = 0; i < numSlots; i++) {
    buf.set(pfd.sigTable[i], i * 20);
  }
  return buf;
}

/**
 * Compute the top hash: HMAC-SHA1(realkey, hashTableBuffer).
 * @param {ParamPFD} pfd
 * @returns {Uint8Array}
 */
function getTopHash(pfd) {
  const buf = hashTableBuffer(pfd);
  return hmacSha1(pfd.realkey, buf, 0, buf.length);
}

/**
 * Compute the bottom hash: HMAC-SHA1(realkey, sigTableBuffer).
 * @param {ParamPFD} pfd
 * @returns {Uint8Array}
 */
function getBottomHash(pfd) {
  const buf = sigTableBuffer(pfd);
  return hmacSha1(pfd.realkey, buf, 0, buf.length);
}

/* ------------------------------------------------------------------ */
/* Entry-hash / chain validation (with fix mode)                       */
/* ------------------------------------------------------------------ */

/**
 * Compute the bucket-level chain hash for the hash-table bucket that the
 * given entry belongs to.
 *
 * Walks the `addition_index` chain starting from the bucket head and
 * computes a single HMAC-SHA1 over all entries in the chain concatenated.
 * All entries in the same chain share the same bucket hash, so calling this
 * with any entry index in the same bucket returns the same result.
 *
 * Returns null if the hash table is inconsistent (entry exists but its
 * bucket head pointer is 0xFFFF…F).
 *
 * @param {number} entryIndex  any entry index within the target bucket
 * @param {ParamPFD} pfd
 * @returns {Uint8Array|null} 20-byte bucket chain hash, or null
 */
function getBucketChainHash(entryIndex, pfd) {
  const entry = pfd.entries[entryIndex];
  const tableIndex = calculateHashTableEntryIndex(entry.fileName, pfd.numReserved);
  let currentIndex = pfd.hashEntries[Number(tableIndex)];

  // Bounds-check against numUsed (actual entries[] length), not numTotal
  // (which includes reserved padding slots never parsed).
  if (currentIndex < pfd.numUsed) {
    const chainEntries = [];
    let chainSteps = 0;
    while (currentIndex < pfd.numUsed) {
      // Guard against infinite loops from corrupted chain pointers.
      if (++chainSteps > Number(pfd.numUsed)) {
        throw new Error('PFD hash chain cycle detected');
      }
      const ent = pfd.entries[Number(currentIndex)];
      if (!ent) {
        throw new Error(`PFD hash chain corrupt: entry index ${currentIndex} out of range`);
      }
      chainEntries.push(ent);
      currentIndex = ent.additionEntry;
    }
    // Write all chain entries' hash data into a single pre-allocated buffer
    // to avoid per-entry allocations.
    const entryHashSize = 65 + 64 + 80 + 40 + 8; // 257 bytes per entry
    const hashData = new Uint8Array(chainEntries.length * entryHashSize);
    for (let i = 0; i < chainEntries.length; i++) {
      writeEntryHashData(chainEntries[i], hashData, i * entryHashSize);
    }
    return hmacSha1(pfd.realkey, hashData, 0, hashData.length);
  }
  return null;
}

/**
 * Validate (or fix) all per-file entry hashes.
 *
 * For non-SFO files, the hash key (SecureFileID-derived) is the same for
 * all hash indices, so it is cached once per entry.
 *
 * @param {Map<string, Uint8Array>} fileData  filename → file bytes
 * @param {boolean} fix
 * @param {ParamPFD} pfd
 * @param {Set<string>|null} [skipSet]
 * @param {ParamPfdFailure[]|null} [failures]  if provided, failure details are pushed here
 * @returns {boolean}
 */
function validAllEntryHashes(fileData, fix, pfd, skipSet = null, failures = null) {
  let allValid = true;
  for (const entry of pfd.entries) {
    // Skip entries whose hashes are already known-correct
    if (skipSet && skipSet.has(entry.fileName.toLowerCase())) continue;
    const data = fileData.get(entry.fileName.toLowerCase());
    if (!data) {
      if (failures) failures.push({ entry: entry.fileName, reason: 'file data not found' });
      allValid = false;
      continue;
    }
    forEachActiveHashIndex(entry, pfd, (i, key) => {
      const hash = hmacSha1(key, data, 0, data.length);
      if (!compareBytes(hash, entry.fileHashes[i])) {
        if (fix) {
          entry.fileHashes[i] = hash;
        } else {
          if (failures) {
            failures.push({
              entry: entry.fileName,
              hashIndex: i,
              expected: entry.fileHashes[i],
              actual: hash,
            });
          }
          allValid = false;
        }
      }
    });
  }
  return allValid;
}

/**
 * Validate/fix the per-bucket signature hashes.
 *
 * Caches per-bucket chain hashes — entries in the same hash bucket share
 * the same chain HMAC, so without this cache, N entries in a chain each
 * recompute the full chain (O(N²) HMAC computations).
 *
 * @param {boolean} fix
 * @param {ParamPFD} pfd
 * @param {ParamPfdFailure[]|null} [failures]
 * @returns {boolean}
 */
function validDHKCID2(fix, pfd, failures = null) {
  const bucketCache = new Map();
  let allValid = true;
  for (let i = 0; i < pfd.entries.length; i++) {
    const index = Number(calculateHashTableEntryIndex(pfd.entries[i].fileName, pfd.numReserved));
    let hash = bucketCache.get(index);
    if (!hash) {
      hash = getBucketChainHash(i, pfd);
      // getBucketChainHash returns null when the hash table is inconsistent
      // (entry exists but its bucket head is 0xFFFF…F).
      if (hash === null) {
        if (fix) {
          throw new Error(
            `PFD hash table is inconsistent: entry "${pfd.entries[i].fileName}" has no valid bucket chain`,
          );
        }
        if (failures) {
          failures.push({ entry: pfd.entries[i].fileName, reason: 'no valid bucket chain' });
        }
        allValid = false;
        continue;
      }
      bucketCache.set(index, hash);
    }
    if (!compareBytes(hash, pfd.sigTable[index])) {
      if (fix) {
        pfd.sigTable[index] = hash;
      } else {
        if (failures) {
          failures.push({ bucket: index, reason: 'signature table mismatch' });
        }
        allValid = false;
      }
    }
  }
  return allValid;
}

/**
 * Validate/fix unused signature slots = default hash.
 *
 * @param {boolean} fix
 * @param {ParamPFD} pfd
 * @param {ParamPfdFailure[]|null} [failures]
 * @returns {boolean}
 */
function validFileCID(fix, pfd, failures = null) {
  const defHash = defaultHash(pfd.realkey);
  // Collect used bucket indices
  const usedIndices = new Set();
  for (const ent of pfd.entries) {
    usedIndices.add(Number(calculateHashTableEntryIndex(ent.fileName, pfd.numReserved)));
  }
  let allValid = true;
  for (let i = 0; i < pfd.sigTable.length; i++) {
    if (usedIndices.has(i)) continue;
    if (!compareBytes(defHash, pfd.sigTable[i])) {
      if (fix) {
        pfd.sigTable[i] = defHash.slice();
      } else {
        if (failures) {
          failures.push({ slot: i, reason: 'unused sig slot != default hash' });
        }
        allValid = false;
      }
    }
  }
  return allValid;
}

/**
 * Validate/fix top hash.
 * @param {boolean} fix
 * @param {ParamPFD} pfd
 * @param {ParamPfdFailure[]|null} [failures]
 * @returns {boolean}
 */
function validTopHash(fix, pfd, failures = null) {
  const hash = getTopHash(pfd);
  if (!compareBytes(hash, pfd.topHash)) {
    if (fix) {
      pfd.topHash = hash;
    } else {
      if (failures) failures.push({ hashType: 'topHash', reason: 'mismatch' });
      return false;
    }
  }
  return true;
}

/**
 * Validate/fix bottom hash.
 * @param {boolean} fix
 * @param {ParamPFD} pfd
 * @param {ParamPfdFailure[]|null} [failures]
 * @returns {boolean}
 */
function validBottomHash(fix, pfd, failures = null) {
  const hash = getBottomHash(pfd);
  if (!compareBytes(hash, pfd.bottomHash)) {
    if (fix) {
      pfd.bottomHash = hash;
    } else {
      if (failures) failures.push({ hashType: 'bottomHash', reason: 'mismatch' });
      return false;
    }
  }
  return true;
}

/**
 * Run all validators.
 *
 * Returns a simple boolean. For detailed failure information, use
 * `validateParamPfdDetailed` instead.
 *
 * @param {Map<string, Uint8Array>} fileData
 * @param {boolean} fix
 * @param {ParamPFD} pfd
 * @param {Set<string>|null} [skipSet]
 * @returns {boolean}
 */
export function validAllParamHashes(fileData, fix, pfd, skipSet = null) {
  return (
    validAllEntryHashes(fileData, fix, pfd, skipSet) &&
    validDHKCID2(fix, pfd) &&
    validFileCID(fix, pfd) &&
    validTopHash(fix, pfd) &&
    validBottomHash(fix, pfd)
  );
}

/**
 * A single validation failure reported by `validateParamPfdDetailed`.
 *
 * `reason` is always present; the identifying field varies by validator
 * (`entry` for per-file checks, `bucket`/`slot` for table checks,
 * `hashType` for the top/bottom hash checks).
 *
 * @typedef {{ entry?: string, bucket?: number, slot?: number, hashType?: string, hashIndex?: number, expected?: Uint8Array, actual?: Uint8Array, reason?: string }} ParamPfdFailure
 */

/**
 * Validate all PFD hashes WITHOUT fixing, returning detailed failure info.
 *
 * Collects and returns information about every validation failure, making
 * it easy to diagnose PFD corruption.
 *
 * @param {Map<string, Uint8Array>} fileData
 * @param {ParamPFD} pfd
 * @returns {{ valid: boolean, failures: ParamPfdFailure[] }}
 */
export function validateParamPfdDetailed(fileData, pfd) {
  /** @type {ParamPfdFailure[]} */
  const failures = [];
  let valid = true;

  // Run each validator, collecting failures.
  if (!validAllEntryHashes(fileData, false, pfd, null, failures)) valid = false;
  if (!validDHKCID2(false, pfd, failures)) valid = false;
  if (!validFileCID(false, pfd, failures)) valid = false;
  if (!validTopHash(false, pfd, failures)) valid = false;
  if (!validBottomHash(false, pfd, failures)) valid = false;

  return { valid, failures };
}

/* ------------------------------------------------------------------ */
/* Serialization                                                       */
/* ------------------------------------------------------------------ */

/**
 * Serialize the full PFD structure back to a byte array, padded to 0x8000.
 *
 * Uses a single pre-allocated Uint8Array(0x8000) with direct offset writes.
 *
 * @param {ParamPFD} pfd
 * @returns {Uint8Array}
 */
export function getParamPfdCombinedData(pfd) {
  const buf = new Uint8Array(PFD_TOTAL_SIZE);
  let off = 0;

  // magic (BE u64)
  writeU64BE(buf, off, pfd.magic);
  off += 8;

  // version (BE u64)
  writeU64BE(buf, off, pfd.version);
  off += 8;

  // header_table_iv (16 bytes)
  buf.set(pfd.headerTableIv, off);
  off += 16;

  // encrypted signature (64 bytes)
  const sigPlain = new Uint8Array(64);
  sigPlain.set(pfd.bottomHash, 0);
  sigPlain.set(pfd.topHash, 20);
  sigPlain.set(pfd.hashKey, 40);
  sigPlain.set(pfd.padding, 60);
  const sigEnc = encryptWithPortability(pfd.headerTableIv, sigPlain, 64);
  buf.set(sigEnc, off);
  off += 64;

  // hash table buffer
  const htBuf = hashTableBuffer(pfd);
  buf.set(htBuf, off);
  off += htBuf.length;

  // entries
  for (const entry of pfd.entries) {
    const ed = entryData(entry);
    buf.set(ed, off);
    off += ed.length;
  }

  // reserved padding (zeroed — buf is already zero-initialized)
  off += 0x110 * Number(pfd.numTotal - pfd.numUsed);

  // signature table
  const stBuf = sigTableBuffer(pfd);
  buf.set(stBuf, off);
  off += stBuf.length;

  // Validate serialized size fits.
  // Remaining bytes are already zero (padding to 0x8000).
  if (off > PFD_TOTAL_SIZE) {
    throw new Error(
      `PFD serialized size (${off}) exceeds maximum (${PFD_TOTAL_SIZE}). Too many entries or hash table buckets.`,
    );
  }

  return buf;
}

/* ------------------------------------------------------------------ */
/* File decrypt / encrypt                                              */
/* ------------------------------------------------------------------ */

/**
 * Align size up to a multiple of 16.
 * @param {number} size
 * @returns {number}
 */
function alignedSize(size) {
  return (size + 16 - 1) & ~(16 - 1);
}

/**
 * Decrypt a file's data.
 *
 * By default, validates the entry hash before decrypting and throws if the
 * data is corrupt. Pass `force=true` to skip validation and decrypt
 * regardless — useful for inspecting partially corrupted saves.
 *
 * @param {Uint8Array} fileData  the raw (encrypted) file bytes
 * @param {string} entryName
 * @param {ParamPFD} pfd
 * @param {boolean} [force=false]  if true, skip hash validation before decrypting
 * @returns {Uint8Array} decrypted bytes (trimmed to entry.file_size)
 */
export function decryptFile(fileData, entryName, pfd, force = false) {
  if (!(fileData instanceof Uint8Array)) {
    throw new TypeError('decryptFile: fileData must be a Uint8Array');
  }
  if (!pfd.secureFileID || pfd.secureFileID.length !== 16) {
    throw new Error('SecureFileID is not valid! length must be 16 bytes');
  }

  // Find the entry
  const entry = pfd.entries.find((e) => e.fileName.toLowerCase() === entryName.toLowerCase());
  if (!entry) {
    throw new Error('entryname does not exist inside the initialized Param.PFD');
  }

  // Validate entry hash before decrypting, unless force=true
  if (!force && !validEntryHashForFile(fileData, entry, pfd)) {
    throw new Error(
      'Encrypted data seems to be invalid, a validated file is required for this operation. ' +
        'Pass force=true to skip validation.',
    );
  }

  // Validate that entry.fileSize is valid for available data.
  const fileSizeNum = Number(entry.fileSize);
  if (fileSizeNum < 0 || fileSizeNum > fileData.length) {
    throw new Error('entry.fileSize exceeds available data');
  }

  const size = alignedSize(fileData.length);
  const data = new Uint8Array(size);
  data.set(fileData.subarray(0, Math.min(fileData.length, size)));

  const key = getEntryKey(entry, pfd);
  const decrypted = ctrDecrypt(key, data, size);

  // Resize to entry.file_size. Return a copy so we can zeroize the full
  // decrypted buffer (which includes padding bytes beyond fileSize) and the
  // padded ciphertext copy.
  const result = decrypted.subarray(0, fileSizeNum).slice();
  zeroize(decrypted);
  zeroize(data);
  zeroize(key);
  return result;
}

/**
 * Encrypt a file's data.
 *
 * The input `fileData` is always treated as **plaintext** and will be
 * encrypted unconditionally.
 *
 * **Double-encryption guard:** When `skipValidation` is `false` (the
 * default), the function checks whether the input data's hashes already
 * match the entry's stored hashes. If they do, the data appears to already
 * be encrypted, and the function **throws** to prevent accidental
 * double-encryption. Pass `skipValidation=true` to bypass this guard —
 * useful when you are certain the input is plaintext, or when intentionally
 * re-encrypting.
 *
 * Callers that need to skip redundant encryption should check
 * `isValidEntryHash(data, entryName, pfd)` before calling `encryptFile`.
 *
 * @param {Uint8Array} fileData  the PLAINTEXT file bytes to encrypt
 * @param {string} entryName
 * @param {ParamPFD} pfd
 * @param {boolean} [skipValidation=false]  if false, throws when input
 *   appears to already be encrypted (hashes match)
 * @returns {Uint8Array} encrypted bytes
 */
export function encryptFile(fileData, entryName, pfd, skipValidation = false) {
  if (!(fileData instanceof Uint8Array)) {
    throw new TypeError('encryptFile: fileData must be a Uint8Array');
  }
  if (!pfd.secureFileID || pfd.secureFileID.length !== 16) {
    throw new Error('SecureFileID is not valid! length must be 16 bytes');
  }

  // Find the entry once — reused for both validation and encryption
  const entry = pfd.entries.find((e) => e.fileName.toLowerCase() === entryName.toLowerCase());
  if (!entry) {
    throw new Error('entryname does not exist inside the initialized Param.PFD');
  }

  // Double-encryption guard. If the input data's hashes already match the
  // entry's stored hashes, the data is likely already encrypted. Refuse to
  // proceed unless the caller explicitly passes skipValidation=true.
  if (!skipValidation && validEntryHashForFile(fileData, entry, pfd)) {
    throw new Error(
      'Input data appears to already be encrypted (entry hashes match). ' +
        'Pass skipValidation=true to force encryption anyway.',
    );
  }

  // Update file_size
  entry.fileSize = BigInt(fileData.length);

  const size = alignedSize(fileData.length);
  const data = new Uint8Array(size);
  data.set(fileData.subarray(0, Math.min(fileData.length, size)));

  const key = getEntryKey(entry, pfd);
  const encrypted = ctrEncrypt(key, data, data.length);

  // Update entry hashes for the encrypted data
  forEachActiveHashIndex(entry, pfd, (i, hashKey) => {
    entry.fileHashes[i] = hmacSha1(hashKey, encrypted, 0, encrypted.length);
  });

  // Zeroize the padded plaintext copy and the AES key.
  zeroize(data);
  zeroize(key);

  return encrypted;
}

/**
 * Check if a single file's entry hash is valid.
 *
 * For non-SFO files, the hash key is the same for all indices, so it is
 * cached to avoid redundant recomputation.
 *
 * @param {Uint8Array} fileData
 * @param {PFDEntry|string} entryOrName
 * @param {ParamPFD} pfd
 * @returns {boolean}
 */
function validEntryHashForFile(fileData, entryOrName, pfd) {
  const entry =
    typeof entryOrName === 'string'
      ? pfd.entries.find((e) => e.fileName.toLowerCase() === entryOrName.toLowerCase())
      : entryOrName;
  if (!entry) return false;

  // Returns false (early exit) on first mismatch.
  let valid = true;
  forEachActiveHashIndex(entry, pfd, (i, key) => {
    const hash = hmacSha1(key, fileData, 0, fileData.length);
    if (!compareBytes(hash, entry.fileHashes[i])) {
      valid = false;
      return false; // early exit
    }
  });
  return valid;
}

/**
 * Check if a file is currently encrypted (hashes valid for encrypted data).
 *
 * @param {Uint8Array} fileData
 * @param {string} entryName
 * @param {ParamPFD} pfd
 * @returns {boolean}
 */
export function isValidEntryHash(fileData, entryName, pfd) {
  return validEntryHashForFile(fileData, entryName, pfd);
}

/**
 * Rebuild the PFD: optionally re-encrypt files, validate+fix all hashes,
 * then serialize.
 *
 * This is a **repair** operation — it always runs validators with
 * `fix=true`, silently recomputing any mismatched hashes. Callers that need
 * to detect corruption or tampering should call
 * `validAllParamHashes(fileData, false, pfd)` separately before rebuilding.
 *
 * The caller's `fileData` map is NOT mutated. Re-encrypted entries are
 * written to `fileUpdates` and a local validation map.
 *
 * @param {Map<string, Uint8Array>} fileData  filename → current file bytes (on disk)
 * @param {boolean} encryptFiles  if true, re-encrypt files before re-hashing
 * @param {ParamPFD} pfd
 * @param {(msg:string)=>void} [onProgress]
 * @returns {{pfdBytes: Uint8Array, fileUpdates: Map<string, Uint8Array>}}
 *   pfdBytes is the new PARAM.PFD content; fileUpdates contains files that
 *   were re-encrypted and need to be written back. Keys in fileUpdates are
 *   **lowercase** filenames (consistent with the `fileData` map convention).
 */
export function rebuildParamPfd(fileData, encryptFiles, pfd, onProgress) {
  const log = onProgress || (() => {});
  const fileUpdates = new Map();
  // Track entries whose hashes are already known-correct so
  // validAllParamHashes can skip re-computing their HMAC-SHA1.
  const hashedEntries = new Set();

  log('Rebuilding Param.PFD..');

  // Use a local validation map instead of mutating the caller's fileData.
  // This preserves the caller's original plaintext data while still allowing
  // validAllParamHashes to validate against encrypted data.
  const validationData = encryptFiles ? new Map(fileData) : fileData;

  if (encryptFiles) {
    log('ReEncrypting Files..');
    for (const entry of pfd.entries) {
      if (entry.fileName.toLowerCase() === 'param.sfo') continue;
      const data = fileData.get(entry.fileName.toLowerCase());
      if (!data) continue;
      // Only re-encrypt if not already valid
      if (!validEntryHashForFile(data, entry, pfd)) {
        // encryptFile updates entry.fileHashes internally.
        const enc = encryptFile(data, entry.fileName, pfd, true);
        // Use lowercase key for consistency with fileData map.
        fileUpdates.set(entry.fileName.toLowerCase(), enc);
        // Update the local validation map (not the caller's fileData)
        validationData.set(entry.fileName.toLowerCase(), enc);
      }
      // Mark this entry's hashes as already verified/computed
      hashedEntries.add(entry.fileName.toLowerCase());
    }
  }

  log('Validating Param.PFD Hashes..');
  validAllParamHashes(validationData, true, pfd, hashedEntries);

  log('Writing new Param.PFD..');
  const pfdBytes = getParamPfdCombinedData(pfd);
  log('Param.PFD Rebuilding complete!');

  return { pfdBytes, fileUpdates };
}

/* ------------------------------------------------------------------ */
/* PFD creation from scratch (for encrypted export)                    */
/* ------------------------------------------------------------------ */

/**
 * Generate a random 16-byte AES key for entry encryption.
 *
 * Uses the Web Crypto API (crypto.getRandomValues). Throws if a secure RNG
 * is not available — never falls back to Math.random() for cryptographic
 * material.
 *
 * @returns {Uint8Array} 16 bytes
 */
function generateRandomKey() {
  if (typeof crypto === 'undefined' || !crypto.getRandomValues) {
    throw new Error('Secure RNG unavailable: crypto.getRandomValues is required');
  }
  const key = new Uint8Array(16);
  crypto.getRandomValues(key);
  return key;
}

/**
 * Generate a random 20-byte key (for hashKey).
 *
 * @returns {Uint8Array} 20 bytes
 */
function generateRandomHashKey() {
  if (typeof crypto === 'undefined' || !crypto.getRandomValues) {
    throw new Error('Secure RNG unavailable: crypto.getRandomValues is required');
  }
  const key = new Uint8Array(20);
  crypto.getRandomValues(key);
  return key;
}

/**
 * Encrypt a 16-byte entry key with AES-CBC using the syscon_manager_key and
 * the file's hash key as IV. This produces the 64-byte entry.key field.
 *
 * The entry.key on disk is 64 bytes: a 64-byte plaintext buffer (16 bytes
 * random key + 48 bytes zero padding) encrypted as 4 AES-CBC blocks. This
 * matches the PS3 format, which decrypts all 64 bytes via CBC.
 *
 * The IV must be the file's hashKey (first 16 bytes) so that getEntryKey
 * can later decrypt it with the same hashKey as IV.
 *
 * @param {Uint8Array} hashKey   20-byte hash key (used as IV, first 16 bytes)
 * @returns {Uint8Array} 64-byte encrypted entry key
 */
export function createEncryptedEntryKey(hashKey) {
  // Build the 64-byte plaintext: 16 bytes random key + 48 bytes zero padding
  const buf = new Uint8Array(64);
  const plainKey = generateRandomKey();
  buf.set(plainKey, 0);
  // Encrypt the full 64-byte buffer with AES-CBC (4 blocks)
  const encrypted = encryptWithPortability(hashKey, buf, 64);
  // Zeroize the plaintext buffer and the random key.
  zeroize(buf);
  zeroize(plainKey);
  return encrypted;
}

/**
 * Create a fully populated PARAM.PFD structure from scratch for encrypted export.
 *
 * Builds a valid PFD with entries for all provided files, ready to have
 * hashes computed via validAllParamHashes() and serialized via
 * getParamPfdCombinedData().
 *
 * @param {Array<{name: string, size: number}>} fileList  files to include
 * @param {Uint8Array} secureFileId  16-byte SecureFileID
 * @param {{ isTrophy?: boolean }} [options]  optional configuration
 * @returns {ParamPFD}
 */
export function createPfdForFiles(fileList, secureFileId, options = {}) {
  const pfd = createParamPFD();
  pfd.version = 4n;

  // Allow caller to specify trophy mode (default: false).
  pfd.isTrophy = options.isTrophy === true;

  // Generate random PFD header key and hash key
  pfd.headerTableIv = generateRandomKey();
  pfd.hashKey = generateRandomHashKey();

  // Derive realkey = HMAC-SHA1(keygen_key, hashKey) for v4
  const keygenKey = getStaticKey('keygen_key');
  pfd.realkey = hmacSha1(keygenKey, pfd.hashKey, 0, 20);

  // Set secure file ID
  if (!secureFileId || secureFileId.length !== 16) {
    throw new Error('SecureFileID must be 16 bytes');
  }
  pfd.secureFileID = secureFileId.slice();

  // Detect duplicate filenames early. Without this, the hash chain builder
  // silently creates a cycle (caught later by the guard, but with a confusing
  // "Hash chain cycle detected" message).
  const seenNames = new Set();
  for (const file of fileList) {
    const upper = file.name.toUpperCase();
    if (seenNames.has(upper)) {
      throw new Error(`createPfdForFiles: duplicate filename "${file.name}"`);
    }
    seenNames.add(upper);
  }

  // Hash table: numReserved must be large enough to avoid hash collisions.
  // Real PS3 saves typically use numReserved=114. numTotal is kept equal to
  // numUsed to avoid wasting space in the entry table.
  const numFiles = fileList.length;
  const numReserved = BigInt(Math.max(114, numFiles * 8));
  pfd.numReserved = numReserved;
  pfd.numTotal = BigInt(numFiles); // no reserved padding — exact fit
  pfd.numUsed = BigInt(numFiles);

  // Initialize hash table entries to 0xFFFFFFFFFFFFFFFF (empty)
  const capNum = Number(numReserved);
  pfd.hashEntries = new Array(capNum);
  for (let i = 0; i < capNum; i++) {
    pfd.hashEntries[i] = 0xffffffffffffffffn;
  }

  // Create entries for each file
  pfd.entries = [];
  for (let i = 0; i < numFiles; i++) {
    const file = fileList[i];
    const fileName = file.name.toUpperCase();

    // Early filename length validation (also checked at serialization)
    if (fileName.length > 65) {
      throw new Error(`Filename too long (${fileName.length} > 65 chars): "${fileName}"`);
    }

    // Determine the hash key for this file type (for entry key creation)
    let fileHashKey;
    if (fileName === 'PARAM.SFO') {
      fileHashKey = getStaticKey('savegame_param_sfo_key');
    } else {
      fileHashKey = generateHashKeyForSecureFileID(secureFileId);
    }

    // Create encrypted entry key
    const encKey = createEncryptedEntryKey(fileHashKey);

    // Create entry
    const entry = {
      additionEntry: 0xffffffffffffffffn, // end of chain
      fileName: fileName,
      padding0: new Uint8Array(7),
      key: encKey,
      fileHashes: [new Uint8Array(20), new Uint8Array(20), new Uint8Array(20), new Uint8Array(20)],
      padding1: new Uint8Array(40),
      fileSize: BigInt(file.size),
    };

    pfd.entries.push(entry);

    // Assign this entry to its hash table bucket
    const bucket = Number(calculateHashTableEntryIndex(fileName, numReserved));
    if (pfd.hashEntries[bucket] === 0xffffffffffffffffn) {
      // Empty bucket — point directly to this entry
      pfd.hashEntries[bucket] = BigInt(i);
    } else {
      // Collision — chain from the existing entry
      let prevIdx = Number(pfd.hashEntries[bucket]);
      let guard = 0;
      while (pfd.entries[prevIdx].additionEntry !== 0xffffffffffffffffn) {
        // Guard against infinite loops from corrupted chain pointers.
        if (++guard > numFiles) {
          throw new Error('Hash chain cycle detected during PFD creation');
        }
        prevIdx = Number(pfd.entries[prevIdx].additionEntry);
      }
      pfd.entries[prevIdx].additionEntry = BigInt(i);
    }
  }

  // Initialize signature table with zeros (will be computed by validAllParamHashes)
  pfd.sigTable = new Array(capNum);
  for (let i = 0; i < capNum; i++) {
    pfd.sigTable[i] = new Uint8Array(20);
  }

  return pfd;
}
