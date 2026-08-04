/**
 * Tests for save folder orchestration functions.
 *
 * Tests both encrypted and unencrypted modes.
 */
import {
  createSaveFolder,
  decryptToBytes,
  encryptBytes,
  isEncrypted,
  rebuildChanges,
  findEntry,
  createParamPFD,
  getParamPfdCombinedData,
  validAllParamHashes,
  encryptFile,
  generateHashKeyForSecureFileID,
  calculateHashTableEntryIndex,
  hmacSha1,
  getStaticKey,
  fromHex,
  toHex,
} from '../../../js/lib/ps3-save-lib/index.js';

/**
 * Build a synthetic PFD with PARAM.SFO + USER.DAT entries,
 * pre-hash all files, and serialize to bytes.
 */
function buildEncryptedSave() {
  const pfd = createParamPFD();
  pfd.version = 4n;
  pfd.headerTableIv = fromHex('00112233445566778899aabbccddeeff');
  pfd.hashKey = fromHex('0102030405060708090a0b0c0d0e0f1011121314');
  pfd.padding = new Uint8Array([0, 0, 0, 0]);

  const keygenKey = getStaticKey('keygen_key');
  pfd.realkey = hmacSha1(keygenKey, pfd.hashKey, 0, 20);

  pfd.secureFileID = fromHex('0123456789ABCDEFFEDCBA9876543210');
  pfd.numReserved = 4n;
  pfd.numTotal = 4n;
  pfd.numUsed = 2n;

  // Compute buckets
  const sfoBucket = Number(calculateHashTableEntryIndex('PARAM.SFO', pfd.numReserved));
  const userBucket = Number(calculateHashTableEntryIndex('USER.DAT', pfd.numReserved));
  pfd.hashEntries = [
    0xffffffffffffffffn,
    0xffffffffffffffffn,
    0xffffffffffffffffn,
    0xffffffffffffffffn,
  ];
  pfd.hashEntries[sfoBucket] = 0n;
  pfd.hashEntries[userBucket] = 1n;

  // PARAM.SFO entry (16 bytes plaintext)
  const sfoData = new Uint8Array(16);
  for (let i = 0; i < 16; i++) sfoData[i] = i;

  pfd.entries = [
    {
      additionEntry: 0xffffffffffffffffn,
      fileName: 'PARAM.SFO',
      padding0: new Uint8Array(7),
      key: new Uint8Array(64),
      fileHashes: [new Uint8Array(20), new Uint8Array(20), new Uint8Array(20), new Uint8Array(20)],
      padding1: new Uint8Array(40),
      fileSize: BigInt(sfoData.length),
    },
    {
      additionEntry: 0xffffffffffffffffn,
      fileName: 'USER.DAT',
      padding0: new Uint8Array(7),
      key: new Uint8Array(64),
      fileHashes: [new Uint8Array(20), new Uint8Array(20), new Uint8Array(20), new Uint8Array(20)],
      padding1: new Uint8Array(40),
      fileSize: 0n,
    },
  ];

  pfd.sigTable = [new Uint8Array(20), new Uint8Array(20), new Uint8Array(20), new Uint8Array(20)];

  // Encrypt SFO and set hash
  const sfoEncrypted = encryptFile(sfoData, 'PARAM.SFO', pfd, true);
  const hashKey = generateHashKeyForSecureFileID(pfd.secureFileID);
  pfd.entries[0].fileHashes[0] = hmacSha1(hashKey, sfoEncrypted, 0, sfoEncrypted.length);
  pfd.entries[0].fileSize = BigInt(sfoData.length);

  // USER.DAT plaintext (32 bytes)
  const userData = new Uint8Array(32);
  for (let i = 0; i < 32; i++) userData[i] = (i * 7 + 3) & 0xff;
  const userEncrypted = encryptFile(userData, 'USER.DAT', pfd, true);
  pfd.entries[1].fileHashes[0] = hmacSha1(hashKey, userEncrypted, 0, userEncrypted.length);
  pfd.entries[1].fileSize = BigInt(userData.length);

  // Fix top/bottom hashes
  const fileMap = new Map([
    ['param.sfo', sfoEncrypted],
    ['user.dat', userEncrypted],
  ]);
  validAllParamHashes(fileMap, true, pfd);

  const pfdBytes = getParamPfdCombinedData(pfd);

  return {
    pfdBytes,
    sfoBytes: sfoEncrypted,
    userBytes: userEncrypted,
    userPlain: userData,
    sfoPlain: sfoData,
    secureFileId: pfd.secureFileID,
    pfd,
  };
}

/**
 * Build files map for encrypted tests — excludes param.sfo because
 * the encrypted SFO bytes lack the plaintext \0PSF header that
 * parseParamSfo expects. (createSaveFolder handles null sfo gracefully.)
 */
function buildEncryptedFiles(fix) {
  return new Map([
    ['param.pfd', fix.pfdBytes],
    ['user.dat', fix.userBytes],
  ]);
}

// ---------------------------------------------------------------------------
// Unencrypted mode tests
// ---------------------------------------------------------------------------

describe('createSaveFolder (unencrypted mode)', () => {
  test('creates folder without PARAM.PFD', async () => {
    const sfo = new Uint8Array(0x600);
    sfo[0] = 0x00;
    sfo[1] = 0x50;
    sfo[2] = 0x53;
    sfo[3] = 0x46;
    sfo[4] = 0x01;
    sfo[5] = 0x01;
    const dv = new DataView(sfo.buffer);
    dv.setUint32(8, 20, true);
    dv.setUint32(12, 20, true);
    dv.setUint32(16, 0, true);

    const files = new Map([
      ['user.dat', new Uint8Array([1, 2, 3])],
      ['param.sfo', sfo],
    ]);
    const mgr = await createSaveFolder(files, null);
    expect(mgr.encrypted).toBe(false);
    expect(mgr.pfd).toBe(null);
    expect(mgr.sfo).not.toBe(null);
  });

  test('creates folder with no PARAM.SFO either', async () => {
    const files = new Map([['user.dat', new Uint8Array([1, 2, 3])]]);
    const mgr = await createSaveFolder(files, null);
    expect(mgr.encrypted).toBe(false);
    expect(mgr.pfd).toBe(null);
    expect(mgr.sfo).toBe(null);
  });

  test('calls onProgress callback', async () => {
    const files = new Map([['user.dat', new Uint8Array([1, 2, 3])]]);
    const messages = [];
    await createSaveFolder(files, null, (msg) => messages.push(msg));
    expect(messages.length).toBeGreaterThan(0);
  });
});

describe('decryptToBytes / encryptBytes (unencrypted)', () => {
  const files = new Map([['user.dat', new Uint8Array([10, 20, 30])]]);
  const mgr = { pfd: null, files, encrypted: false };

  test('decryptToBytes returns raw bytes', () => {
    expect(Array.from(decryptToBytes(mgr, 'USER.DAT'))).toEqual([10, 20, 30]);
  });

  test('decryptToBytes throws for missing file', () => {
    expect(() => decryptToBytes(mgr, 'MISSING.BIN')).toThrow('not found');
  });

  test('encryptBytes stores raw bytes', () => {
    const newBytes = new Uint8Array([40, 50, 60]);
    const result = encryptBytes(mgr, 'USER.DAT', newBytes);
    expect(Array.from(result)).toEqual([40, 50, 60]);
    expect(Array.from(mgr.files.get('user.dat'))).toEqual([40, 50, 60]);
  });
});

describe('isEncrypted (unencrypted)', () => {
  test('returns false for unencrypted manager', () => {
    const files = new Map([['user.dat', new Uint8Array([1, 2])]]);
    expect(isEncrypted({ pfd: null, files, encrypted: false }, 'USER.DAT')).toBe(false);
  });

  test('returns false when file is missing', () => {
    expect(isEncrypted({ pfd: null, files: new Map(), encrypted: false }, 'USER.DAT')).toBe(false);
  });
});

describe('rebuildChanges (unencrypted)', () => {
  test('returns file updates without PFD', () => {
    const files = new Map([
      ['user.dat', new Uint8Array([1, 2, 3])],
      ['param.sfo', new Uint8Array([4, 5])],
      ['param.pfd', new Uint8Array([6, 7])],
    ]);
    const result = rebuildChanges({ pfd: null, files, encrypted: false });
    expect(result.pfdBytes).toBe(null);
    expect(result.fileUpdates.has('user.dat')).toBe(true);
    expect(result.fileUpdates.has('param.sfo')).toBe(false);
    expect(result.fileUpdates.has('param.pfd')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Encrypted mode tests
// ---------------------------------------------------------------------------

describe('createSaveFolder (encrypted mode)', () => {
  test('creates encrypted folder with PARAM.PFD', async () => {
    const fix = buildEncryptedSave();
    const files = buildEncryptedFiles(fix);
    const mgr = await createSaveFolder(files, fix.secureFileId);
    expect(mgr.encrypted).toBe(true);
    expect(mgr.pfd).not.toBe(null);
  });

  test('throws on wrong SecureFileID length', async () => {
    const fix = buildEncryptedSave();
    const files = buildEncryptedFiles(fix);
    await expect(createSaveFolder(files, new Uint8Array(10))).rejects.toThrow(
      'SecureFileID must be 16 bytes',
    );
  });

  test('works without SecureFileID (null)', async () => {
    const fix = buildEncryptedSave();
    const files = buildEncryptedFiles(fix);
    const mgr = await createSaveFolder(files, null);
    expect(mgr.encrypted).toBe(true);
    expect(mgr.pfd).not.toBe(null);
  });
});

describe('decryptToBytes / encryptBytes (encrypted)', () => {
  test('decryptToBytes decrypts file in encrypted mode', async () => {
    const fix = buildEncryptedSave();
    const mgr = await createSaveFolder(buildEncryptedFiles(fix), fix.secureFileId);
    const decrypted = decryptToBytes(mgr, 'USER.DAT');
    expect(toHex(decrypted)).toBe(toHex(fix.userPlain));
  });

  test('decryptToBytes throws for missing file in encrypted mode', async () => {
    const fix = buildEncryptedSave();
    const mgr = await createSaveFolder(buildEncryptedFiles(fix), fix.secureFileId);
    expect(() => decryptToBytes(mgr, 'MISSING.BIN')).toThrow('not found');
  });

  test('encryptBytes encrypts and stores in encrypted mode', async () => {
    const fix = buildEncryptedSave();
    const mgr = await createSaveFolder(buildEncryptedFiles(fix), fix.secureFileId);
    const newPlain = new Uint8Array(32);
    for (let i = 0; i < 32; i++) newPlain[i] = (i * 3 + 1) & 0xff;
    const enc = encryptBytes(mgr, 'USER.DAT', newPlain);
    expect(enc.length).toBeGreaterThanOrEqual(32);
    expect(toHex(mgr.files.get('user.dat'))).toBe(toHex(enc));
  });
});

describe('isEncrypted (encrypted mode)', () => {
  test('returns true when hash matches original encrypted data', async () => {
    const fix = buildEncryptedSave();
    const mgr = await createSaveFolder(buildEncryptedFiles(fix), fix.secureFileId);
    expect(isEncrypted(mgr, 'USER.DAT')).toBe(true);
  });

  test('returns false when data has been modified', async () => {
    const fix = buildEncryptedSave();
    const files = new Map([
      ['param.pfd', fix.pfdBytes],
      ['user.dat', new Uint8Array(64)],
    ]);
    const mgr = await createSaveFolder(files, fix.secureFileId);
    expect(isEncrypted(mgr, 'USER.DAT')).toBe(false);
  });

  test('returns false for missing file in encrypted mode', async () => {
    const fix = buildEncryptedSave();
    const mgr = await createSaveFolder(buildEncryptedFiles(fix), fix.secureFileId);
    expect(isEncrypted(mgr, 'MISSING.BIN')).toBe(false);
  });
});

describe('rebuildChanges (encrypted mode)', () => {
  test('rebuilds PFD in encrypted mode', async () => {
    const fix = buildEncryptedSave();
    const mgr = await createSaveFolder(buildEncryptedFiles(fix), fix.secureFileId);
    const result = rebuildChanges(mgr, false);
    expect(result.pfdBytes).not.toBe(null);
  });

  test('rebuilds with encryptFiles=true', async () => {
    const fix = buildEncryptedSave();
    const mgr = await createSaveFolder(buildEncryptedFiles(fix), fix.secureFileId);
    const result = rebuildChanges(mgr, true);
    expect(result.pfdBytes).not.toBe(null);
  });
});

// ---------------------------------------------------------------------------
// findEntry tests
// ---------------------------------------------------------------------------

describe('findEntry', () => {
  test('returns null when no PFD', () => {
    expect(findEntry({ pfd: null }, 'USER.DAT')).toBe(null);
  });

  test('returns null when entry not found', () => {
    const mgr = /** @type {any} */ ({ pfd: { entries: [{ fileName: 'USER.DAT' }] } });
    expect(findEntry(mgr, 'MISSING.BIN')).toBe(null);
  });

  test('finds entry by name (case-insensitive)', () => {
    const entry = { fileName: 'USER.DAT' };
    const mgr = /** @type {any} */ ({ pfd: { entries: [entry] } });
    expect(findEntry(mgr, 'user.dat')).toBe(entry);
  });

  test('finds entry from real encrypted PFD', async () => {
    const fix = buildEncryptedSave();
    const mgr = await createSaveFolder(buildEncryptedFiles(fix), fix.secureFileId);
    const entry = findEntry(mgr, 'USER.DAT');
    expect(entry).not.toBe(null);
    expect(entry.fileName).toBe('USER.DAT');
  });
});
