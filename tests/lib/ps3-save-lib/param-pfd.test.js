/**
 * PFD helper tests: hash-table index, SecureFileID key mangling,
 * entry/hashtable serialization round-trip, parse errors, validation,
 * decrypt/encrypt edge cases, rebuild, and creation edge cases.
 */
import {
  calculateHashTableEntryIndex,
  generateHashKeyForSecureFileID,
  parseParamPfd,
  createParamPFD,
  cloneParamPfd,
  createPfdForFiles,
  getParamPfdCombinedData,
  validAllParamHashes,
  validateParamPfdDetailed,
  decryptFile,
  encryptFile,
  isValidEntryHash,
  getEntryKey,
  createEncryptedEntryKey,
  rebuildParamPfd,
  fromHex,
  toHex,
  hmacSha1,
  getStaticKey,
} from '../../../js/lib/ps3-save-lib/index.js';
import { decryptWithPortability } from '../../../js/lib/ps3-save-lib/crypto/aes.js';
import { bad } from '../../helpers.js';

const SECURE_ID = fromHex('0123456789ABCDEFFEDCBA9876543210');

/**
 * Build a single-entry USER.DAT PFD (size 32) with the test SecureFileID.
 * The most common fixture in this file; centralised to avoid repeating the
 * literal createPfdForFiles(...) call ~20×.
 * @returns {ReturnType<typeof createPfdForFiles>}
 */
function makeUserPfd() {
  return createPfdForFiles([{ name: 'USER.DAT', size: 32 }], SECURE_ID);
}

/* ------------------------------------------------------------------ */
/* Hash helpers                                                        */
/* ------------------------------------------------------------------ */

describe('calculateHashTableEntryIndex', () => {
  test('returns 0n for empty string with numReserved 16', () => {
    expect(calculateHashTableEntryIndex('', 16n)).toBe(0n);
  });

  test('produces values within [0, numReserved)', () => {
    const names = ['param.sfo', 'user.dat', '1user.dat', '04user.dat', 'icon0.png'];
    for (const name of names) {
      const idx = calculateHashTableEntryIndex(name, 64n);
      expect(idx).toBeGreaterThanOrEqual(0n);
      expect(idx).toBeLessThan(64n);
    }
  });

  test('deterministic for same input', () => {
    const a = calculateHashTableEntryIndex('user.dat', 100n);
    const b = calculateHashTableEntryIndex('user.dat', 100n);
    expect(a).toBe(b);
  });
});

describe('generateHashKeyForSecureFileID', () => {
  const secureId = fromHex('0123456789ABCDEFFEDCBA9876543210');

  test('produces the known 20-byte mangled key', () => {
    // Magic constants at positions 1,2,5,8 (0x0b,0x0f,0x0e,0x0a); all
    // other bytes are secureId copied in order. The pinned hex encodes
    // both contracts, so the full-output check subsumes per-position checks.
    const key = generateHashKeyForSecureFileID(secureId);
    expect(key.length).toBe(20);
    const expected = '01' + '0b0f' + '2345' + '0e' + '6789' + '0a' + 'abcdeffedcba9876543210';
    expect(toHex(key)).toBe(expected);
  });

  test('throws for wrong length', () => {
    expect(() => generateHashKeyForSecureFileID(new Uint8Array(15))).toThrow();
    expect(() => generateHashKeyForSecureFileID(new Uint8Array(17))).toThrow();
  });
});

/* ------------------------------------------------------------------ */
/* PFD creation and structure                                          */
/* ------------------------------------------------------------------ */

describe('createParamPFD', () => {
  test('creates a PFD with default fields', () => {
    const pfd = createParamPFD();
    expect(pfd.magic).toBe(0x50464442n);
    expect(pfd.version).toBe(4n);
    expect(pfd.numReserved).toBe(0n);
    expect(pfd.entries).toEqual([]);
    expect(pfd.hashEntries).toEqual([]);
    expect(pfd.sigTable).toEqual([]);
    expect(pfd.secureFileID).toBeNull();
    expect(pfd.isTrophy).toBe(false);
    // Default identity fields
    expect(pfd.consoleID.length).toBe(32);
    expect(pfd.authID.length).toBe(8);
    expect(pfd.discHashKey.length).toBe(16);
  });
});

describe('createEncryptedEntryKey', () => {
  test('produces 64-byte entry key fully encrypted via CBC', () => {
    const hashKey = new Uint8Array(20).fill(0x42);
    const entryKey = createEncryptedEntryKey(hashKey);
    expect(entryKey.length).toBe(64);

    // The FULL 64 bytes should be CBC ciphertext, not just the first
    // 16 bytes. The remaining 48 bytes should NOT be literal zeros — they
    // should be CBC-encrypted zero padding blocks.
    const first16 = entryKey.subarray(0, 16);
    expect(first16.some((b) => b !== 0)).toBe(true);

    // The last 48 bytes should also be non-trivial CBC ciphertext.
    // (CBC of zero blocks is non-zero because of IV chaining.)
    const last48 = entryKey.subarray(16);
    expect(last48.some((b) => b !== 0)).toBe(true);
  });

  test('decrypts back to 16-byte key + 48 zero bytes (CBC round-trip)', () => {
    // The 64-byte entry key, when decrypted with syscon_manager_key and the
    // hashKey as IV, should produce: 16 bytes random key + 48 bytes zeros.
    const hashKey = new Uint8Array(20).fill(0x42);
    const entryKey = createEncryptedEntryKey(hashKey);

    // Decrypt using decryptWithPortability (same as getEntryKey uses)
    const decrypted = decryptWithPortability(hashKey, entryKey, 64);

    // Bytes 16-63 should all be zero (padding in the plaintext)
    expect(toHex(decrypted.subarray(16))).toBe('00'.repeat(48));
  });

  test('produces different keys on successive calls (random)', () => {
    const hashKey = new Uint8Array(20).fill(0x42);
    const k1 = createEncryptedEntryKey(hashKey);
    const k2 = createEncryptedEntryKey(hashKey);
    // The first 16 bytes (encrypted random key) should differ
    expect(toHex(k1.subarray(0, 16))).not.toBe(toHex(k2.subarray(0, 16)));
  });
  // Note: getEntryKey determinism is tested in the 'getEntryKey' describe block below.
});

/* ------------------------------------------------------------------ */
/* createPfdForFiles edge cases                                        */
/* ------------------------------------------------------------------ */

describe('createPfdForFiles edge cases', () => {
  test('throws for null secureFileId', () => {
    expect(() => createPfdForFiles([], null)).toThrow('SecureFileID must be 16 bytes');
  });

  test('throws for wrong-length secureFileId', () => {
    expect(() => createPfdForFiles([], new Uint8Array(15))).toThrow(
      'SecureFileID must be 16 bytes',
    );
    expect(() => createPfdForFiles([], new Uint8Array(17))).toThrow(
      'SecureFileID must be 16 bytes',
    );
  });

  test('numReserved scales with file count (≥114)', () => {
    // 3 files → max(114, 24) = 114
    const files3 = [
      { name: 'PARAM.SFO', size: 100 },
      { name: 'USER.DAT', size: 200 },
      { name: '2USER.DAT', size: 200 },
    ];
    const pfd3 = createPfdForFiles(files3, SECURE_ID);
    expect(pfd3.numReserved).toBe(114n);

    // 20 files → max(114, 160) = 160
    const files20 = [];
    for (let i = 0; i < 20; i++) {
      files20.push({ name: `FILE${i}.DAT`, size: 100 });
    }
    const pfd20 = createPfdForFiles(files20, SECURE_ID);
    expect(pfd20.numReserved).toBe(160n);
  });

  // Note: hash collision chain construction is tested more thoroughly in
  // 'createPfdForFiles: hash collision chain construction' below.
});

/* ------------------------------------------------------------------ */
/* Parse errors                                                        */
/* ------------------------------------------------------------------ */

describe('parseParamPfd error handling', () => {
  test('throws on invalid magic bytes', () => {
    const buf = new Uint8Array(0x8000);
    // Write wrong magic: 0xDEADBEEF instead of 0x50464442
    buf[0] = 0xde;
    buf[1] = 0xad;
    buf[2] = 0xbe;
    buf[3] = 0xef;
    expect(() => parseParamPfd(buf)).toThrow('Invalid PFD File!');
  });

  test('throws on unsupported version', () => {
    // Create a valid-looking PFD header with wrong version
    const pfd = createParamPFD();
    pfd.version = 99n;
    pfd.secureFileID = SECURE_ID;
    const data = getParamPfdCombinedData(pfd);
    expect(() => parseParamPfd(data)).toThrow('Unsupported PFD version!');
  });

  test('accepts version 3 (realkey = hashKey)', () => {
    // Create a version 3 PFD and parse it
    const pfd = createParamPFD();
    pfd.version = 3n;
    // For v3, realkey is derived differently during parse (realkey = hashKey)
    // We need to set up proper hash key and entries
    pfd.numReserved = 16n;
    pfd.numTotal = 0n;
    pfd.numUsed = 0n;
    pfd.hashEntries = new Array(16).fill(0xffffffffffffffffn);
    pfd.sigTable = new Array(16).fill(new Uint8Array(20));
    const data = getParamPfdCombinedData(pfd);
    const parsed = parseParamPfd(data);
    expect(parsed.version).toBe(3n);
    // For v3, realkey should equal hashKey (not HMAC-derived)
    expect(toHex(parsed.realkey)).toBe(toHex(parsed.hashKey));
  });

  test('calls onProgress callback', () => {
    const pfd = createParamPFD();
    pfd.numReserved = 16n;
    pfd.numTotal = 0n;
    pfd.numUsed = 0n;
    pfd.hashEntries = new Array(16).fill(0xffffffffffffffffn);
    pfd.sigTable = new Array(16).fill(new Uint8Array(20));
    const data = getParamPfdCombinedData(pfd);
    const messages = [];
    parseParamPfd(data, (msg) => messages.push(msg));
    expect(messages.length).toBeGreaterThan(0);
    expect(messages.some((m) => m.includes('Param.PFD'))).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* Decrypt / encrypt error paths                                       */
/* ------------------------------------------------------------------ */

describe('decryptFile error paths', () => {
  test('throws when secureFileID is not set', () => {
    const pfd = createParamPFD();
    // No secureFileID set
    expect(() => decryptFile(new Uint8Array(16), 'USER.DAT', pfd)).toThrow(
      'SecureFileID is not valid!',
    );
  });

  test('throws when secureFileID is wrong length', () => {
    const pfd = createParamPFD();
    pfd.secureFileID = new Uint8Array(15);
    expect(() => decryptFile(new Uint8Array(16), 'USER.DAT', pfd)).toThrow(
      'SecureFileID is not valid!',
    );
  });

  test('throws when entry not found', () => {
    const pfd = makeUserPfd();
    expect(() => decryptFile(new Uint8Array(16), 'NONEXIST.DAT', pfd)).toThrow(
      'entryname does not exist',
    );
  });
});

describe('encryptFile error paths', () => {
  test('throws when secureFileID is not set', () => {
    const pfd = createParamPFD();
    expect(() => encryptFile(new Uint8Array(16), 'USER.DAT', pfd)).toThrow(
      'SecureFileID is not valid!',
    );
  });

  test('throws when entry not found', () => {
    const pfd = makeUserPfd();
    expect(() => encryptFile(new Uint8Array(16), 'NONEXIST.DAT', pfd)).toThrow(
      'entryname does not exist',
    );
  });

  test('double-encryption guard: throws when input appears already encrypted', () => {
    const fileList = [{ name: 'USER.DAT', size: 32 }];
    const pfd = createPfdForFiles(fileList, SECURE_ID);

    // Encrypt some plaintext (skipValidation=true since this is the
    // initial encryption of fresh plaintext)
    const plain = new Uint8Array(32).fill(0xab);
    const enc = encryptFile(plain, 'USER.DAT', pfd, true);

    // S3: Passing the already-encrypted data WITHOUT skipValidation should
    // throw because the hashes match — the data looks already encrypted.
    expect(() => encryptFile(enc, 'USER.DAT', pfd, false)).toThrow(
      'appears to already be encrypted',
    );
  });

  test('double-encryption guard: skipValidation=true forces re-encryption', () => {
    const fileList = [{ name: 'USER.DAT', size: 32 }];
    const pfd = createPfdForFiles(fileList, SECURE_ID);

    // Encrypt some plaintext
    const plain = new Uint8Array(32).fill(0xab);
    const enc = encryptFile(plain, 'USER.DAT', pfd, true);

    // S3: With skipValidation=true, the guard is bypassed and the data is
    // re-encrypted (double-encrypted). This is intentional for callers
    // who know what they're doing.
    const result = encryptFile(enc, 'USER.DAT', pfd, true);
    // Result should NOT equal the input (it was re-encrypted)
    expect(toHex(result)).not.toBe(toHex(enc));
    // But decrypting the result should give us back the ciphertext `enc`
    const decrypted = decryptFile(result, 'USER.DAT', pfd, true);
    expect(toHex(decrypted)).toBe(toHex(enc));
  });
});

/* ------------------------------------------------------------------ */
/* isValidEntryHash                                                    */
/* ------------------------------------------------------------------ */

describe('isValidEntryHash', () => {
  test('returns false for non-existent entry', () => {
    const pfd = makeUserPfd();
    expect(isValidEntryHash(new Uint8Array(16), 'NONEXIST.DAT', pfd)).toBe(false);
  });

  test('returns true for valid encrypted data', () => {
    const pfd = makeUserPfd();
    const plain = new Uint8Array(32).fill(0xcd);
    const enc = encryptFile(plain, 'USER.DAT', pfd, true);

    // Update hashes to match the encrypted data
    const hashKey = generateHashKeyForSecureFileID(SECURE_ID);
    pfd.entries[0].fileHashes[0] = hmacSha1(hashKey, enc, 0, enc.length);

    expect(isValidEntryHash(enc, 'USER.DAT', pfd)).toBe(true);
  });

  test('returns false for modified data', () => {
    const pfd = makeUserPfd();
    const plain = new Uint8Array(32).fill(0xee);
    const enc = encryptFile(plain, 'USER.DAT', pfd, true);

    // Set up valid hashes
    const hashKey = generateHashKeyForSecureFileID(SECURE_ID);
    pfd.entries[0].fileHashes[0] = hmacSha1(hashKey, enc, 0, enc.length);

    // Tamper with the data
    const tampered = enc.slice();
    tampered[0] ^= 0x01;

    expect(isValidEntryHash(tampered, 'USER.DAT', pfd)).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* validAllParamHashes (non-fix mode)                                  */
/* ------------------------------------------------------------------ */

describe('validAllParamHashes non-fix mode', () => {
  test('returns false when file data is missing', () => {
    const pfd = makeUserPfd();
    const fileData = new Map();
    // Don't add any file data
    expect(validAllParamHashes(fileData, false, pfd)).toBe(false);
  });

  test('returns true after fix mode produces valid PFD', () => {
    const fileList = [
      { name: 'PARAM.SFO', size: 32 },
      { name: 'USER.DAT', size: 48 },
    ];
    const pfd = createPfdForFiles(fileList, SECURE_ID);
    const sfo = new Uint8Array(32).fill(0x11);
    const user = new Uint8Array(48).fill(0x22);

    // Encrypt USER.DAT
    const userEnc = encryptFile(user, 'USER.DAT', pfd, true);

    const fileData = new Map();
    fileData.set('param.sfo', sfo);
    fileData.set('user.dat', userEnc);

    // Fix all hashes
    expect(validAllParamHashes(fileData, true, pfd)).toBe(true);

    // Now non-fix mode should also pass
    expect(validAllParamHashes(fileData, false, pfd)).toBe(true);
  });

  test('returns false with tampered data (non-fix)', () => {
    const fileList = [
      { name: 'PARAM.SFO', size: 32 },
      { name: 'USER.DAT', size: 48 },
    ];
    const pfd = createPfdForFiles(fileList, SECURE_ID);
    const sfo = new Uint8Array(32).fill(0x11);
    const user = new Uint8Array(48).fill(0x22);

    const userEnc = encryptFile(user, 'USER.DAT', pfd, true);

    const fileData = new Map();
    fileData.set('param.sfo', sfo);
    fileData.set('user.dat', userEnc);

    // Fix all hashes
    validAllParamHashes(fileData, true, pfd);

    // Tamper with SFO data
    fileData.set('param.sfo', new Uint8Array(32).fill(0xff));

    // Non-fix should detect mismatch
    expect(validAllParamHashes(fileData, false, pfd)).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* rebuildParamPfd with encryptFiles=true                              */
/* ------------------------------------------------------------------ */

describe('rebuildParamPfd', () => {
  test('re-encrypts modified files when encryptFiles=true', () => {
    const fileList = [
      { name: 'PARAM.SFO', size: 32 },
      { name: 'USER.DAT', size: 48 },
    ];
    const pfd = createPfdForFiles(fileList, SECURE_ID);
    const sfo = new Uint8Array(32).fill(0x33);
    const user = new Uint8Array(48).fill(0x44);

    // First, encrypt and fix hashes so the initial state is valid
    const userEnc = encryptFile(user, 'USER.DAT', pfd, true);
    const fileData = new Map();
    fileData.set('param.sfo', sfo);
    fileData.set('user.dat', userEnc);
    validAllParamHashes(fileData, true, pfd);

    // Now modify user.dat (replace with plaintext — this will be invalid)
    fileData.set('user.dat', new Uint8Array(48).fill(0x99));

    // Rebuild with encryption
    const { pfdBytes, fileUpdates } = rebuildParamPfd(fileData, true, pfd);

    expect(pfdBytes.length).toBe(0x8000);
    expect(fileUpdates.has('user.dat')).toBe(true);

    // The updated file should be encrypted (different from plaintext).
    // fileUpdates keys are lowercase (consistent with fileData map).
    const encFile = fileUpdates.get('user.dat');
    expect(toHex(encFile)).not.toBe(toHex(new Uint8Array(48).fill(0x99)));
  });

  test('skips already-valid files during rebuild', () => {
    const fileList = [
      { name: 'PARAM.SFO', size: 32 },
      { name: 'USER.DAT', size: 48 },
    ];
    const pfd = createPfdForFiles(fileList, SECURE_ID);
    const sfo = new Uint8Array(32).fill(0x55);
    const user = new Uint8Array(48).fill(0x66);

    const userEnc = encryptFile(user, 'USER.DAT', pfd, true);
    const fileData = new Map();
    fileData.set('param.sfo', sfo);
    fileData.set('user.dat', userEnc);

    // Fix hashes
    validAllParamHashes(fileData, true, pfd);

    // Rebuild with encryptFiles=true — data is already valid, no re-encryption needed
    const { fileUpdates } = rebuildParamPfd(fileData, true, pfd);
    expect(fileUpdates.size).toBe(0);
  });

  test('rebuild without encryption', () => {
    const fileList = [
      { name: 'PARAM.SFO', size: 32 },
      { name: 'USER.DAT', size: 32 },
    ];
    const pfd = createPfdForFiles(fileList, SECURE_ID);
    const sfo = new Uint8Array(32).fill(0x77);
    const userEnc = encryptFile(new Uint8Array(32).fill(0x88), 'USER.DAT', pfd, true);

    const fileData = new Map();
    fileData.set('param.sfo', sfo);
    fileData.set('user.dat', userEnc);

    const { pfdBytes } = rebuildParamPfd(fileData, false, pfd);
    expect(pfdBytes.length).toBe(0x8000);
  });
});

/* ------------------------------------------------------------------ */
/* getEntryKey                                                         */
/* ------------------------------------------------------------------ */

describe('getEntryKey', () => {
  test('derives 16-byte AES key from entry', () => {
    const pfd = makeUserPfd();
    const key = getEntryKey(pfd.entries[0], pfd);
    expect(key.length).toBe(16);
    // Key should be non-trivial (not all zeros)
    expect(key.some((b) => b !== 0)).toBe(true);
  });

  test('derives same key for same entry + PFD', () => {
    const pfd = makeUserPfd();
    const k1 = getEntryKey(pfd.entries[0], pfd);
    const k2 = getEntryKey(pfd.entries[0], pfd);
    expect(toHex(k1)).toBe(toHex(k2));
  });
});

/* ------------------------------------------------------------------ */
/* Serialize → parse round-trip with reserved padding                  */
/* ------------------------------------------------------------------ */

describe('PFD with reserved padding (numTotal > numUsed)', () => {
  test('serializes and parses PFD with reserved slots', () => {
    // Create a PFD where numTotal > numUsed (has reserved padding)
    const pfd = createParamPFD();
    pfd.version = 4n;
    pfd.headerTableIv = new Uint8Array(16).fill(0x42);
    pfd.hashKey = new Uint8Array(20).fill(0x55);
    const keygenKey = getStaticKey('keygen_key');
    pfd.realkey = hmacSha1(keygenKey, pfd.hashKey, 0, 20);

    pfd.numReserved = 4n;
    pfd.numTotal = 3n; // 2 used + 1 reserved
    pfd.numUsed = 2n;
    pfd.hashEntries = [0n, 1n, 0xffffffffffffffffn, 0xffffffffffffffffn];
    pfd.secureFileID = SECURE_ID;

    // Create two entries
    for (let i = 0; i < 2; i++) {
      pfd.entries.push({
        additionEntry: 0xffffffffffffffffn,
        fileName: `FILE${i}.DAT`,
        padding0: new Uint8Array(7),
        key: new Uint8Array(64).fill(i + 1),
        fileHashes: [
          new Uint8Array(20),
          new Uint8Array(20),
          new Uint8Array(20),
          new Uint8Array(20),
        ],
        padding1: new Uint8Array(40),
        fileSize: 16n,
      });
    }

    pfd.sigTable = [
      new Uint8Array(20).fill(0xaa),
      new Uint8Array(20).fill(0xbb),
      new Uint8Array(20).fill(0xcc),
      new Uint8Array(20).fill(0xdd),
    ];

    const data = getParamPfdCombinedData(pfd);
    expect(data.length).toBe(0x8000);

    // Parse it back
    const parsed = parseParamPfd(data);
    expect(parsed.numReserved).toBe(4n);
    expect(parsed.numTotal).toBe(3n);
    expect(parsed.numUsed).toBe(2n);
    expect(parsed.entries.length).toBe(2);
    expect(parsed.entries[0].fileName).toBe('FILE0.DAT');
    expect(parsed.entries[1].fileName).toBe('FILE1.DAT');
  });
});

/* ------------------------------------------------------------------ */
/* Trophy save paths (getEntryHashKey for trophy files)                */
/* ------------------------------------------------------------------ */

// Note: SFO hash indices 0-3 in trophy mode are covered by the dedicated
// 'Trophy SFO hash indices 0-3' test below.

describe('Validation non-fix false paths (corrupted PFD)', () => {
  test('validDHKCID2 returns false for mismatched sig table (non-fix)', () => {
    // Create a PFD, fix hashes, then corrupt the sig table
    const fileList = [{ name: 'PARAM.SFO', size: 32 }];
    const pfd = createPfdForFiles(fileList, SECURE_ID);
    const sfo = new Uint8Array(32).fill(0x11);
    const fileData = new Map();
    fileData.set('param.sfo', sfo);

    // Fix all hashes
    validAllParamHashes(fileData, true, pfd);

    // Corrupt a signature table entry
    pfd.sigTable[0] = new Uint8Array(20).fill(0xff);

    // Now non-fix validation should fail at validDHKCID2
    expect(validAllParamHashes(fileData, false, pfd)).toBe(false);
  });

  test('validFileCID returns false for mismatched unused sig slot', () => {
    const fileList = [{ name: 'PARAM.SFO', size: 32 }];
    const pfd = createPfdForFiles(fileList, SECURE_ID);
    const sfo = new Uint8Array(32).fill(0x22);
    const fileData = new Map();
    fileData.set('param.sfo', sfo);

    validAllParamHashes(fileData, true, pfd);

    // Corrupt an unused sig slot (not the one for PARAM.SFO's bucket)
    const sfoBucket = Number(calculateHashTableEntryIndex('PARAM.SFO', pfd.numReserved));
    for (let i = 0; i < pfd.sigTable.length; i++) {
      if (i !== sfoBucket) {
        pfd.sigTable[i] = new Uint8Array(20).fill(0xee);
        break;
      }
    }

    expect(validAllParamHashes(fileData, false, pfd)).toBe(false);
  });

  test('validTopHash returns false for mismatched top hash', () => {
    const fileList = [{ name: 'PARAM.SFO', size: 32 }];
    const pfd = createPfdForFiles(fileList, SECURE_ID);
    const sfo = new Uint8Array(32).fill(0x33);
    const fileData = new Map();
    fileData.set('param.sfo', sfo);

    validAllParamHashes(fileData, true, pfd);

    // Corrupt top hash
    pfd.topHash = new Uint8Array(20).fill(0xff);

    expect(validAllParamHashes(fileData, false, pfd)).toBe(false);
  });

  test('validBottomHash returns false for mismatched bottom hash', () => {
    const fileList = [{ name: 'PARAM.SFO', size: 32 }];
    const pfd = createPfdForFiles(fileList, SECURE_ID);
    const sfo = new Uint8Array(32).fill(0x44);
    const fileData = new Map();
    fileData.set('param.sfo', sfo);

    validAllParamHashes(fileData, true, pfd);

    // Corrupt bottom hash
    pfd.bottomHash = new Uint8Array(20).fill(0xff);

    expect(validAllParamHashes(fileData, false, pfd)).toBe(false);
  });
});

describe('decryptFile hash validation failure', () => {
  test('throws on invalid encrypted data (hash mismatch)', () => {
    const pfd = makeUserPfd();
    const plain = new Uint8Array(32).fill(0x55);
    const enc = encryptFile(plain, 'USER.DAT', pfd, true);

    // Set up valid hashes for the encrypted data
    const hashKey = generateHashKeyForSecureFileID(SECURE_ID);
    pfd.entries[0].fileHashes[0] = hmacSha1(hashKey, enc, 0, enc.length);

    // Now corrupt the entry hash so decryption validation fails
    pfd.entries[0].fileHashes[0] = new Uint8Array(20).fill(0xff);

    expect(() => decryptFile(enc, 'USER.DAT', pfd)).toThrow('Encrypted data seems to be invalid');
  });
});

describe('Trophy save hash key paths', () => {
  test('trophy file entries use static trophy keys', () => {
    // Create a trophy PFD with trophy file entries
    const trophyFiles = [
      { name: 'TROPSYS.DAT', size: 32 },
      { name: 'TROPUSR.DAT', size: 32 },
      { name: 'TROPTRNS.DAT', size: 32 },
      { name: 'TROPCONF.SFM', size: 32 },
    ];
    // We can't use createPfdForFiles with isTrophy=true easily,
    // but we can test indirectly via isValidEntryHash with trophy entries

    const pfd = createPfdForFiles(trophyFiles, SECURE_ID);
    pfd.isTrophy = true;

    // Encrypt each file so the entry hashes can be computed
    const fileData = new Map();
    for (const entry of pfd.entries) {
      const plain = new Uint8Array(32).fill(0x77);
      const enc = encryptFile(plain, entry.fileName, pfd, true);
      fileData.set(entry.fileName.toLowerCase(), enc);
    }

    // Fix all hashes in trophy mode (hashes 0-3 checked for trophy files)
    const result = validAllParamHashes(fileData, true, pfd);
    expect(result).toBe(true);

    // Non-fix validation should also pass
    expect(validAllParamHashes(fileData, false, pfd)).toBe(true);
  });
});

describe('Trophy SFO hash indices 0-3', () => {
  test('PARAM.SFO validated at all 4 hash indices in trophy mode', () => {
    // PARAM.SFO + a trophy file to justify isTrophy=true.
    // This exercises generateHashKeyForSFO cases 1-3 (consoleID,
    // discHashKey, authID) which are only reached for SFO entries
    // when isTrophy=true.
    const files = [
      { name: 'PARAM.SFO', size: 16 },
      { name: 'TROPSYS.DAT', size: 32 },
    ];
    const pfd = createPfdForFiles(files, SECURE_ID, { isTrophy: true });

    const sfoData = new Uint8Array(16).fill(0x11);
    const tropEnc = encryptFile(new Uint8Array(32).fill(0x22), 'TROPSYS.DAT', pfd, true);

    const fileData = new Map([
      ['param.sfo', sfoData],
      ['tropsys.dat', tropEnc],
    ]);

    // Fix mode computes hashes at indices 0-3 for PARAM.SFO
    expect(validAllParamHashes(fileData, true, pfd)).toBe(true);
    // Non-fix mode re-validates all indices
    expect(validAllParamHashes(fileData, false, pfd)).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* Coverage: cloneParamPfd, validateParamPfdDetailed, parseParamPfd guards,
 *           decryptFile force mode, filename-length validation
 * ------------------------------------------------------------------ */

describe('cloneParamPfd', () => {
  test('produces a deep-independent copy', () => {
    const pfd = makeUserPfd();
    const clone = cloneParamPfd(pfd);

    // Scalars match
    expect(clone.magic).toBe(pfd.magic);
    expect(clone.version).toBe(pfd.version);
    expect(clone.numReserved).toBe(pfd.numReserved);

    // Uint8Array fields are independent copies
    clone.headerTableIv[0] = 0xff;
    expect(pfd.headerTableIv[0]).not.toBe(0xff);

    // Entry Uint8Array fields are independent
    clone.entries[0].key[0] = 0xff;
    expect(pfd.entries[0].key[0]).not.toBe(0xff);

    // sigTable is deep-copied
    clone.sigTable[0][0] = 0xff;
    expect(pfd.sigTable[0][0]).not.toBe(0xff);
  });

  test('handles null secureFileID', () => {
    const pfd = createParamPFD();
    const clone = cloneParamPfd(pfd);
    expect(clone.secureFileID).toBeNull();
  });

  test('preserves secureFileID as a copy', () => {
    const pfd = makeUserPfd();
    const clone = cloneParamPfd(pfd);
    clone.secureFileID[0] = 0xff;
    expect(pfd.secureFileID[0]).not.toBe(0xff);
  });
});

describe('validateParamPfdDetailed', () => {
  test('returns failures array for corrupted PFD', () => {
    const fileList = [{ name: 'PARAM.SFO', size: 32 }];
    const pfd = createPfdForFiles(fileList, SECURE_ID);
    const sfo = new Uint8Array(32).fill(0x11);
    const fileData = new Map();
    fileData.set('param.sfo', sfo);

    // Don't fix — everything is in default state (all zeros)
    const result = validateParamPfdDetailed(fileData, pfd);
    expect(result.valid).toBe(false);
    expect(result.failures.length).toBeGreaterThan(0);
  });

  test('returns valid=true after fix', () => {
    const fileList = [{ name: 'PARAM.SFO', size: 32 }];
    const pfd = createPfdForFiles(fileList, SECURE_ID);
    const sfo = new Uint8Array(32).fill(0x22);
    const fileData = new Map();
    fileData.set('param.sfo', sfo);

    validAllParamHashes(fileData, true, pfd);

    const result = validateParamPfdDetailed(fileData, pfd);
    expect(result.valid).toBe(true);
    expect(result.failures).toHaveLength(0);
  });
});

describe('parseParamPfd corrupt-header guards', () => {
  test('throws on too-short buffer (< 96 bytes)', () => {
    expect(() => parseParamPfd(new Uint8Array(50))).toThrow(/too short/);
  });

  test('throws on non-Uint8Array input', () => {
    expect(() => parseParamPfd(bad('bad'))).toThrow(TypeError);
  });

  test('throws on numReserved too large', () => {
    const pfd = createParamPFD();
    pfd.numReserved = 200000n; // > 100000 cap
    pfd.numTotal = 0n;
    pfd.numUsed = 0n;
    pfd.hashEntries = [];
    pfd.sigTable = [];
    const data = getParamPfdCombinedData(pfd);
    expect(() => parseParamPfd(data)).toThrow(/numReserved/);
  });

  test('throws on numUsed > numReserved', () => {
    const pfd = createParamPFD();
    pfd.numReserved = 4n;
    pfd.numUsed = 10n;
    pfd.numTotal = 10n;
    pfd.hashEntries = new Array(4).fill(0xffffffffffffffffn);
    pfd.sigTable = new Array(4).fill(new Uint8Array(20));
    const data = getParamPfdCombinedData(pfd);
    expect(() => parseParamPfd(data)).toThrow(/numUsed is corrupt/);
  });

  // Note: numTotal<numUsed and hash-table-extends-past-buffer guards
  // require carefully crafted binary buffers that are tricky to construct
  // correctly by hand. These branches are already indirectly covered by
  // the numReserved too large and numUsed>numReserved tests above.
});

describe('decryptFile with force=true', () => {
  test('force=true skips validation and decrypts corrupted data', () => {
    const pfd = makeUserPfd();
    const plain = new Uint8Array(32).fill(0x44);
    const enc = encryptFile(plain, 'USER.DAT', pfd, true);

    // Corrupt the entry hashes so normal decrypt would fail
    pfd.entries[0].fileHashes[0] = new Uint8Array(20).fill(0xff);

    // With force=true, validation is skipped
    const decrypted = decryptFile(enc, 'USER.DAT', pfd, true);
    expect(toHex(decrypted)).toBe(toHex(plain));
  });

  test('throws when entry.fileSize exceeds available data', () => {
    const pfd = makeUserPfd();
    const enc = encryptFile(new Uint8Array(32).fill(0x44), 'USER.DAT', pfd, true);

    // Set fileSize to be larger than the actual data
    pfd.entries[0].fileSize = 999n;

    expect(() => decryptFile(enc, 'USER.DAT', pfd, true)).toThrow(
      /fileSize exceeds available data/,
    );
  });

  test('throws on non-Uint8Array input', () => {
    const pfd = makeUserPfd();
    expect(() => decryptFile(bad('bad'), 'USER.DAT', pfd, true)).toThrow(TypeError);
  });
});

describe('encryptFile additional coverage', () => {
  test('throws on non-Uint8Array input', () => {
    const pfd = makeUserPfd();
    expect(() => encryptFile(bad('bad'), 'USER.DAT', pfd, true)).toThrow(TypeError);
  });
});

describe('createPfdForFiles filename validation', () => {
  test('throws on duplicate filenames', () => {
    const files = [
      { name: 'USER.DAT', size: 32 },
      { name: 'user.dat', size: 32 }, // same name, different case
    ];
    expect(() => createPfdForFiles(files, SECURE_ID)).toThrow(/duplicate filename/);
  });

  test('throws on filename too long (>65 chars)', () => {
    const longName = 'A'.repeat(66) + '.DAT';
    const files = [{ name: longName, size: 32 }];
    expect(() => createPfdForFiles(files, SECURE_ID)).toThrow(/Filename too long/);
  });

  test('accepts filename at exactly 65 chars', () => {
    const name65 = 'B'.repeat(61) + '.DAT'; // 65 chars exactly
    const files = [{ name: name65, size: 32 }];
    expect(() => createPfdForFiles(files, SECURE_ID)).not.toThrow();
  });

  test('handles isTrophy option', () => {
    const files = [{ name: 'PARAM.SFO', size: 32 }];
    const pfd = createPfdForFiles(files, SECURE_ID, { isTrophy: true });
    expect(pfd.isTrophy).toBe(true);
  });
});

describe('calculateHashTableEntryIndex edge cases', () => {
  test('throws on numReserved = 0', () => {
    expect(() => calculateHashTableEntryIndex('test', 0n)).toThrow(/positive/);
  });

  test('throws on negative numReserved', () => {
    expect(() => calculateHashTableEntryIndex('test', -1n)).toThrow(/positive/);
  });
});

describe('getParamPfdCombinedData overflow guard', () => {
  test('throws when serialized data exceeds 0x8000', () => {
    const pfd = createParamPFD();
    pfd.numReserved = 1n;
    pfd.numTotal = 1n;
    pfd.numUsed = 0n;
    pfd.hashEntries = [0xffffffffffffffffn];
    // Add enough entries to overflow 0x8000 (each entry is 0x110 bytes)
    // 0x8000 = 32768. Header is ~120 bytes. Need ~327 entries to overflow.
    for (let i = 0; i < 330; i++) {
      pfd.entries.push({
        additionEntry: 0xffffffffffffffffn,
        fileName: `FILE${i}.DAT`,
        padding0: new Uint8Array(7),
        key: new Uint8Array(64),
        fileHashes: [
          new Uint8Array(20),
          new Uint8Array(20),
          new Uint8Array(20),
          new Uint8Array(20),
        ],
        padding1: new Uint8Array(40),
        fileSize: 16n,
      });
    }
    pfd.sigTable = [new Uint8Array(20)];
    // The buf.set() at entry serialization throws RangeError before the
    // custom overflow guard is reached. This test covers that error path.
    expect(() => getParamPfdCombinedData(pfd)).toThrow();
  });
});

/* ========================================================================
 * Coverage: crafted PFD edge cases for defensive guards
 * ==================================================================== */

describe('entryData / writeEntryHashData: filename too long', () => {
  test('getParamPfdCombinedData throws when entry filename exceeds 65 bytes', () => {
    // createPfdForFiles validates filenames early, so we build a PFD
    // manually with a long-named entry to reach entryData() at serialization.
    const pfd = createParamPFD();
    pfd.version = 4n;
    pfd.headerTableIv = new Uint8Array(16).fill(0x42);
    pfd.hashKey = new Uint8Array(20).fill(0x55);
    const keygenKey = getStaticKey('keygen_key');
    pfd.realkey = hmacSha1(keygenKey, pfd.hashKey, 0, 20);
    pfd.numReserved = 16n;
    pfd.numTotal = 1n;
    pfd.numUsed = 1n;
    pfd.hashEntries = new Array(16).fill(0xffffffffffffffffn);
    pfd.hashEntries[0] = 0n;
    pfd.secureFileID = SECURE_ID;
    pfd.entries = [
      {
        additionEntry: 0xffffffffffffffffn,
        fileName: 'C'.repeat(66), // 66 chars — exceeds 65-byte field
        padding0: new Uint8Array(7),
        key: new Uint8Array(64),
        fileHashes: [
          new Uint8Array(20),
          new Uint8Array(20),
          new Uint8Array(20),
          new Uint8Array(20),
        ],
        padding1: new Uint8Array(40),
        fileSize: 16n,
      },
    ];
    pfd.sigTable = new Array(16).fill(new Uint8Array(20));
    expect(() => getParamPfdCombinedData(pfd)).toThrow(/too long/);
  });
});

describe('parseParamPfd: corrupt hash/sig table guards', () => {
  function makeValidPfdBytes() {
    const pfd = createPfdForFiles(
      [
        { name: 'PARAM.SFO', size: 16 },
        { name: 'USER.DAT', size: 32 },
      ],
      SECURE_ID,
    );
    const data = new Map();
    data.set('param.sfo', new Uint8Array(16));
    data.set('user.dat', new Uint8Array(32));
    validAllParamHashes(data, true, pfd);
    return getParamPfdCombinedData(pfd);
  }

  test('throws when numTotal < numUsed', () => {
    const pfdBytes = makeValidPfdBytes();
    const dv = new DataView(pfdBytes.buffer);
    // numReserved is at offset 96, numTotal at 104, numUsed at 112
    const numUsed = dv.getBigUint64(112, false);
    // Set numTotal to be less than numUsed
    dv.setBigUint64(104, numUsed - 1n, false);
    expect(() => parseParamPfd(pfdBytes)).toThrow('numTotal < numUsed');
  });

  test('throws when hash table extends past buffer', () => {
    const pfdBytes = makeValidPfdBytes();
    const dv = new DataView(pfdBytes.buffer);
    // Set numReserved to a value that would extend past the buffer
    // The hash table starts at offset 96 + 24 = 120, and each entry is 8 bytes
    dv.setBigUint64(96, 100000n, false); // numReserved = huge
    dv.setBigUint64(104, 0n, false); // numTotal = 0
    dv.setBigUint64(112, 0n, false); // numUsed = 0
    expect(() => parseParamPfd(pfdBytes)).toThrow(/hash table extends past buffer/);
  });

  // Note: 'signature table extends past buffer' is tested more precisely in
  // 'parseParamPfd: signature table extends past buffer' below, which isolates
  // the sig table guard by ensuring the hash table fits within the buffer.
});

// Note: the decryptFile null-secureFileID guard (param-pfd.js:1000) is
// already covered by 'decryptFile error paths' → 'throws when secureFileID
// is not set' above, so it is not re-tested here. The getEntryHashKey null
// path reached via getEntryKey is covered in 'getEntryKey: null SecureFileID
// on non-SFO entry' below.

describe('getBucketChainHash: null and corrupt chains', () => {
  test('validateParamPfdDetailed detects orphaned entry (bucket head = 0xFFFF…F)', () => {
    // Create a PFD where an entry exists but its hash table bucket points
    // to 0xFFFF...F (no chain) — getBucketChainHash returns null
    const pfd = makeUserPfd();
    // Corrupt: set ALL hashEntries to 0xFFFF...F so the entry's bucket
    // head points nowhere
    for (let i = 0; i < pfd.hashEntries.length; i++) {
      pfd.hashEntries[i] = 0xffffffffffffffffn;
    }
    const data = new Map();
    data.set('user.dat', new Uint8Array(32));

    const result = validateParamPfdDetailed(data, pfd);
    expect(result.valid).toBe(false);
    expect(result.failures.some((f) => f.reason === 'no valid bucket chain')).toBe(true);
  });

  test('validAllParamHashes with fix=true throws on orphaned entry', () => {
    const pfd = makeUserPfd();
    for (let i = 0; i < pfd.hashEntries.length; i++) {
      pfd.hashEntries[i] = 0xffffffffffffffffn;
    }
    const data = new Map();
    data.set('user.dat', new Uint8Array(32));
    expect(() => validAllParamHashes(data, true, pfd)).toThrow(/inconsistent/);
  });

  test('getBucketChainHash throws on hash chain cycle', () => {
    const pfd = makeUserPfd();
    // Create a cycle: entry 0's additionEntry points to itself
    pfd.entries[0].additionEntry = 0n; // points to entry 0 = cycle
    const data = new Map();
    data.set('user.dat', new Uint8Array(32));
    expect(() => validateParamPfdDetailed(data, pfd)).toThrow(/cycle detected/);
  });

  test('getBucketChainHash throws on corrupt chain entry index', () => {
    const pfd = makeUserPfd();
    // Make numUsed larger than entries.length so that a chain pointer
    // can be < numUsed but >= entries.length → entries[Number(currentIndex)]
    // returns undefined → "PFD hash chain corrupt" throw.
    pfd.numUsed = 10n; // entries.length is only 1
    const bucket = Number(calculateHashTableEntryIndex(pfd.entries[0].fileName, pfd.numReserved));
    pfd.hashEntries[bucket] = 5n; // 5 < numUsed(10) but >= entries.length(1)
    const data = new Map();
    data.set('user.dat', new Uint8Array(32));
    expect(() => validateParamPfdDetailed(data, pfd)).toThrow(/corrupt/);
  });
});

describe('Secure RNG unavailable', () => {
  let originalCrypto;
  beforeEach(() => {
    originalCrypto = global.crypto;
  });
  afterEach(() => {
    global.crypto = originalCrypto;
  });

  test('createPfdForFiles throws when crypto.getRandomValues is unavailable', () => {
    // Remove crypto to trigger the guard
    Object.defineProperty(global, 'crypto', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    expect(() => createPfdForFiles([{ name: 'USER.DAT', size: 16 }], SECURE_ID)).toThrow(
      'Secure RNG unavailable',
    );
  });

  test('createEncryptedEntryKey throws when crypto.getRandomValues is unavailable', () => {
    Object.defineProperty(global, 'crypto', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    expect(() => createEncryptedEntryKey(getStaticKey('savegame_param_sfo_key'))).toThrow(
      'Secure RNG unavailable',
    );
  });
});

/* ========================================================================
 * Coverage: writeEntryHashData filename-too-long, getEntryKey null
 *           secureFileID, signature-table-extends-past-buffer, collision
 *           chain construction
 * ==================================================================== */

describe('writeEntryHashData: filename too long (via validation)', () => {
  test('validateParamPfdDetailed throws when chain entry filename exceeds 65 bytes', () => {
    // Build a PFD manually with a 66-char filename entry and wire its bucket
    // so getBucketChainHash → writeEntryHashData is reached.
    const pfd = createParamPFD();
    pfd.version = 4n;
    pfd.headerTableIv = new Uint8Array(16).fill(0x42);
    pfd.hashKey = new Uint8Array(20).fill(0x55);
    const keygenKey = getStaticKey('keygen_key');
    pfd.realkey = hmacSha1(keygenKey, pfd.hashKey, 0, 20);
    pfd.numReserved = 16n;
    pfd.numTotal = 1n;
    pfd.numUsed = 1n;
    pfd.hashEntries = new Array(16).fill(0xffffffffffffffffn);
    pfd.secureFileID = SECURE_ID;

    const longName = 'D'.repeat(66); // 66 chars — exceeds 65-byte field
    const bucket = Number(calculateHashTableEntryIndex(longName, pfd.numReserved));
    pfd.hashEntries[bucket] = 0n; // point bucket to entry 0

    pfd.entries = [
      {
        additionEntry: 0xffffffffffffffffn,
        fileName: longName,
        padding0: new Uint8Array(7),
        key: new Uint8Array(64),
        fileHashes: [
          new Uint8Array(20),
          new Uint8Array(20),
          new Uint8Array(20),
          new Uint8Array(20),
        ],
        padding1: new Uint8Array(40),
        fileSize: 16n,
      },
    ];
    pfd.sigTable = new Array(16).fill(new Uint8Array(20));

    const data = new Map();
    data.set(longName.toLowerCase(), new Uint8Array(16));

    // validateParamPfdDetailed → validDHKCID2 → getBucketChainHash → writeEntryHashData
    expect(() => validateParamPfdDetailed(data, pfd)).toThrow(/too long/);
  });
});

describe('getEntryKey: null SecureFileID on non-SFO entry', () => {
  test('throws when secureFileID is null and entry is non-SFO', () => {
    const pfd = makeUserPfd();
    pfd.secureFileID = null;
    // getEntryKey calls getEntryHashKey(entry, 0, pfd) which hits the
    // default-case guard for non-SFO files.
    expect(() => getEntryKey(pfd.entries[0], pfd)).toThrow('SecureFileID is not valid');
  });
});

describe('parseParamPfd: entry table extends past buffer', () => {
  test('throws when entry table (but not hash table) exceeds buffer', () => {
    // Craft a PFD where numUsed is large enough that the entry table
    // overflows, but numReserved is small enough that the hash table fits.
    // With numReserved=200, numUsed=200, numTotal=200:
    //   hash table:  120 + 200*8  = 1720   ≤ 32768  (fits)
    //   entry table: 1720 + 200*0x110 = 36920 > 32768  (overflows)
    const pfd = createParamPFD();
    pfd.version = 4n;
    pfd.headerTableIv = new Uint8Array(16).fill(0x42);
    pfd.hashKey = new Uint8Array(20).fill(0x55);
    const keygenKey = getStaticKey('keygen_key');
    pfd.realkey = hmacSha1(keygenKey, pfd.hashKey, 0, 20);
    pfd.numReserved = 200n;
    pfd.numTotal = 200n;
    pfd.numUsed = 200n;
    pfd.hashEntries = new Array(200).fill(0xffffffffffffffffn);
    pfd.sigTable = new Array(200).fill(new Uint8Array(20));
    const data = getParamPfdCombinedData(pfd);

    expect(() => parseParamPfd(data)).toThrow(/entry table extends past buffer/);
  });
});

describe('parseParamPfd: signature table extends past buffer', () => {
  test('throws when signature table (but not hash table) exceeds buffer', () => {
    // Craft a PFD where numReserved is large enough that the signature table
    // overflows, but small enough that the hash table still fits.
    // With numReserved=1200, numUsed=0:
    //   hash table:  120 + 1200*8  = 9720  ≤ 32768  (fits)
    //   sig table:   9720 + 1200*20 = 33720 > 32768  (overflows)
    const pfd = createParamPFD();
    pfd.version = 4n;
    pfd.headerTableIv = new Uint8Array(16).fill(0x42);
    pfd.hashKey = new Uint8Array(20).fill(0x55);
    const keygenKey = getStaticKey('keygen_key');
    pfd.realkey = hmacSha1(keygenKey, pfd.hashKey, 0, 20);
    pfd.numReserved = 1200n;
    pfd.numTotal = 0n;
    pfd.numUsed = 0n;
    pfd.hashEntries = new Array(0); // no hash entries serialized for numReserved in buffer
    pfd.sigTable = [];
    const data = getParamPfdCombinedData(pfd);

    // Manually patch numReserved in the serialized buffer.
    const dv = new DataView(data.buffer);
    dv.setBigUint64(96, 1200n, false); // numReserved
    dv.setBigUint64(104, 0n, false); // numTotal
    dv.setBigUint64(112, 0n, false); // numUsed

    expect(() => parseParamPfd(data)).toThrow('signature table extends past buffer');
  });
});

describe('createPfdForFiles: hash collision chain construction', () => {
  test('builds additionEntry chain when multiple files share a bucket', () => {
    // Brute-force search for 3 filenames that collide in the same bucket.
    const numReserved = 114n; // createPfdForFiles uses max(114, n*8) for ≤14 files
    const bucketNames = new Map();
    let found = null;
    for (let i = 0; i < 2000 && !found; i++) {
      const name = `COLLIDE${i}.DAT`;
      const bucket = Number(calculateHashTableEntryIndex(name, numReserved));
      if (!bucketNames.has(bucket)) bucketNames.set(bucket, []);
      bucketNames.get(bucket).push(name);
      if (bucketNames.get(bucket).length >= 3) {
        found = bucketNames.get(bucket).slice(0, 3);
      }
    }
    expect(found).not.toBeNull(); // ensure we found colliding names

    const pfd = createPfdForFiles(
      found.map((n) => ({ name: n, size: 16 })),
      SECURE_ID,
    );

    // At least 2 entries should be chained (non-0xFFFF…F additionEntry),
    // proving the collision-walking code path was executed.
    const chained = pfd.entries.filter((e) => e.additionEntry !== 0xffffffffffffffffn);
    expect(chained.length).toBeGreaterThanOrEqual(1);
  });
});

/* ========================================================================
 * Relocated from fixes.test.js — unique tests not covered elsewhere
 * ==================================================================== */

describe('parseParamPfd copies all fields (no zero-copy views)', () => {
  test('mutating input buffer after parse does not corrupt parsed PFD', () => {
    const fileList = [{ name: 'USER.DAT', size: 32 }];
    const pfd = createPfdForFiles(fileList, SECURE_ID);
    const data = getParamPfdCombinedData(pfd);

    const parsed = parseParamPfd(data);

    const origIv = toHex(parsed.headerTableIv);
    const origHashKey = toHex(parsed.hashKey);
    const origKey = toHex(parsed.entries[0].key);
    const origFileHash0 = toHex(parsed.entries[0].fileHashes[0]);
    const origSig0 = toHex(parsed.sigTable[0]);

    data.fill(0xff);

    expect(toHex(parsed.headerTableIv)).toBe(origIv);
    expect(toHex(parsed.hashKey)).toBe(origHashKey);
    expect(toHex(parsed.entries[0].key)).toBe(origKey);
    expect(toHex(parsed.entries[0].fileHashes[0])).toBe(origFileHash0);
    expect(toHex(parsed.sigTable[0])).toBe(origSig0);
  });
});

describe('cloneParamPfd: serialization identity', () => {
  test('cloned PFD serializes identically to original', () => {
    const pfd = createPfdForFiles(
      [
        { name: 'PARAM.SFO', size: 32 },
        { name: 'USER.DAT', size: 48 },
      ],
      SECURE_ID,
    );
    const orig = getParamPfdCombinedData(pfd);
    const clone = cloneParamPfd(pfd);
    const cloneData = getParamPfdCombinedData(clone);
    expect(toHex(orig)).toBe(toHex(cloneData));
  });
});

describe('validateParamPfdDetailed: specific failure types', () => {
  test('returns detailed failures for corrupted topHash', () => {
    const fileList = [{ name: 'PARAM.SFO', size: 32 }];
    const pfd = createPfdForFiles(fileList, SECURE_ID);
    const sfo = new Uint8Array(32).fill(0x11);
    const fileData = new Map();
    fileData.set('param.sfo', sfo);
    validAllParamHashes(fileData, true, pfd);

    pfd.topHash = new Uint8Array(20).fill(0xff);

    const result = validateParamPfdDetailed(fileData, pfd);
    expect(result.valid).toBe(false);
    expect(result.failures.some((f) => f.hashType === 'topHash')).toBe(true);
  });

  test('returns failure for missing file data', () => {
    const fileList = [{ name: 'PARAM.SFO', size: 32 }];
    const pfd = createPfdForFiles(fileList, SECURE_ID);
    const fileData = new Map();

    const result = validateParamPfdDetailed(fileData, pfd);
    expect(result.valid).toBe(false);
    expect(result.failures.some((f) => f.reason.includes('not found'))).toBe(true);
  });
});

describe('PFD error messages include actual values', () => {
  test('invalid magic error includes actual magic value', () => {
    const buf = new Uint8Array(0x8000);
    buf[0] = 0xde;
    buf[1] = 0xad;
    buf[2] = 0xbe;
    buf[3] = 0xef;
    expect(() => parseParamPfd(buf)).toThrow(/magic: 0x/i);
  });

  test('unsupported version error includes actual version', () => {
    const pfd = makeUserPfd();
    pfd.version = 99n;
    const data = getParamPfdCombinedData(pfd);
    expect(() => parseParamPfd(data)).toThrow(/version: 99/i);
  });
});

describe('rebuildParamPfd preserves caller fileData', () => {
  test('caller fileData is not mutated when encryptFiles=true', () => {
    const fileList = [
      { name: 'PARAM.SFO', size: 32 },
      { name: 'USER.DAT', size: 48 },
    ];
    const pfd = createPfdForFiles(fileList, SECURE_ID);
    const sfo = new Uint8Array(32).fill(0x33);
    const userEnc = encryptFile(new Uint8Array(48).fill(0x44), 'USER.DAT', pfd);
    const fileData = new Map();
    fileData.set('param.sfo', sfo);
    fileData.set('user.dat', userEnc);
    validAllParamHashes(fileData, true, pfd);

    // Replace with plaintext
    const plainUser = new Uint8Array(48).fill(0x99);
    fileData.set('user.dat', plainUser);
    const originalHex = toHex(plainUser);

    rebuildParamPfd(fileData, true, pfd);

    // Caller's fileData should NOT be mutated
    expect(toHex(fileData.get('user.dat'))).toBe(originalHex);
  });
});
