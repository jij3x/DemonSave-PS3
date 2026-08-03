/**
 * Tests for encrypted save export functionality:
 *   - PFD creation from scratch (createPfdForFiles)
 *   - Full encrypted export round-trip (encrypt → parse → decrypt → verify)
 */
import {
  createPfdForFiles,
  parseParamPfd,
  getParamPfdCombinedData,
  validAllParamHashes,
  encryptFile,
  decryptFile,
  calculateHashTableEntryIndex,
  fromHex,
  toHex,
} from '../../../js/lib/ps3-save-lib/index.js';

const SECURE_ID = fromHex('0123456789ABCDEFFEDCBA9876543210');

// -----------------------------------------------------------------------
// PFD Creation Tests
// -----------------------------------------------------------------------

describe('PFD creation from scratch (createPfdForFiles)', () => {
  test('creates a PFD with correct numReserved for DeS', () => {
    const files = [
      { name: 'PARAM.SFO', size: 0x600 },
      { name: '1USER.DAT', size: 0x20000 },
      { name: 'ICON0.PNG', size: 0x1000 },
    ];
    const pfd = createPfdForFiles(files, SECURE_ID);

    expect(pfd.magic).toBe(0x50464442n);
    expect(pfd.version).toBe(4n);
    expect(pfd.numReserved).toBe(114n);
    expect(pfd.numUsed).toBe(BigInt(files.length));
    expect(pfd.numTotal).toBe(pfd.numUsed); // no reserved padding
    expect(pfd.secureFileID).toEqual(SECURE_ID);
    expect(pfd.entries.length).toBe(files.length);
  });

  test('each entry has correct filename', () => {
    const files = [
      { name: 'PARAM.SFO', size: 100 },
      { name: '1USER.DAT', size: 200 },
    ];
    const pfd = createPfdForFiles(files, SECURE_ID);

    expect(pfd.entries[0].fileName).toBe('PARAM.SFO');
    expect(pfd.entries[0].fileSize).toBe(100n);
    expect(pfd.entries[1].fileName).toBe('1USER.DAT');
    expect(pfd.entries[1].fileSize).toBe(200n);
  });

  test('each entry has 64-byte key and 4x20-byte hashes', () => {
    const pfd = createPfdForFiles([{ name: 'PARAM.SFO', size: 16 }], SECURE_ID);
    expect(pfd.entries[0].key.length).toBe(64);
    expect(pfd.entries[0].fileHashes.length).toBe(4);
    expect(pfd.entries[0].fileHashes[0].length).toBe(20);
  });

  test('hash table entries point to correct buckets', () => {
    const files = [
      { name: 'PARAM.SFO', size: 16 },
      { name: 'USER.DAT', size: 32 },
    ];
    const pfd = createPfdForFiles(files, SECURE_ID);

    for (let i = 0; i < files.length; i++) {
      const bucket = Number(
        calculateHashTableEntryIndex(files[i].name.toUpperCase(), pfd.numReserved),
      );
      const entryIdx = Number(pfd.hashEntries[bucket]);
      expect(entryIdx).toBeLessThan(pfd.numUsed);
    }
  });

  test('serialized PFD is exactly 0x8000 bytes', () => {
    const files = [{ name: 'PARAM.SFO', size: 16 }];
    const pfd = createPfdForFiles(files, SECURE_ID);
    const fileData = new Map([['param.sfo', new Uint8Array(16)]]);
    validAllParamHashes(fileData, true, pfd);
    const bytes = getParamPfdCombinedData(pfd);
    expect(bytes.length).toBe(0x8000);
  });

  test('created PFD round-trips through parse', () => {
    const files = [
      { name: 'PARAM.SFO', size: 16 },
      { name: 'USER.DAT', size: 32 },
    ];
    const pfd = createPfdForFiles(files, SECURE_ID);
    const sfoData = new Uint8Array(16);
    const fileData = new Map([
      ['param.sfo', sfoData],
      ['user.dat', new Uint8Array(32)],
    ]);
    validAllParamHashes(fileData, true, pfd);

    const bytes = getParamPfdCombinedData(pfd);
    const pfd2 = parseParamPfd(bytes);
    pfd2.secureFileID = SECURE_ID; // restored externally in production

    expect(pfd2.magic).toBe(0x50464442n);
    expect(pfd2.version).toBe(4n);
    expect(pfd2.numReserved).toBe(pfd.numReserved);
    expect(pfd2.numUsed).toBe(pfd.numUsed);
    expect(pfd2.entries.length).toBe(files.length);

    expect(validAllParamHashes(fileData, false, pfd2)).toBe(true);
  });
});

// -----------------------------------------------------------------------
// Full Encrypted Export Round-Trip Tests
// -----------------------------------------------------------------------

describe('Full encrypted export round-trip', () => {
  test('encrypt → serialize → parse → decrypt recovers original data', () => {
    const sfoPlain = new Uint8Array(0x600);
    for (let i = 0; i < sfoPlain.length; i++) sfoPlain[i] = (i * 3 + 7) & 0xff;

    const userPlain = new Uint8Array(0x20000);
    for (let i = 0; i < userPlain.length; i++) userPlain[i] = (i * 5 + 3) & 0xff;

    const files = [
      { name: 'PARAM.SFO', size: sfoPlain.length },
      { name: 'USER.DAT', size: userPlain.length },
    ];

    const pfd = createPfdForFiles(files, SECURE_ID);

    const userEncrypted = encryptFile(userPlain, 'USER.DAT', pfd, true);

    const encryptedFiles = new Map();
    encryptedFiles.set('param.sfo', sfoPlain);
    encryptedFiles.set('user.dat', userEncrypted);

    validAllParamHashes(encryptedFiles, true, pfd);

    const pfdBytes = getParamPfdCombinedData(pfd);
    expect(pfdBytes.length).toBe(0x8000);

    const pfd2 = parseParamPfd(pfdBytes);
    pfd2.secureFileID = SECURE_ID; // restored externally in production

    expect(validAllParamHashes(encryptedFiles, false, pfd2)).toBe(true);

    const recovered = decryptFile(userEncrypted, 'USER.DAT', pfd2);
    expect(recovered.length).toBe(userPlain.length);
    expect(toHex(recovered)).toBe(toHex(userPlain));
  });

  test('encrypted export produces valid PFD with multiple files', () => {
    const files = [
      { name: 'PARAM.SFO', size: 0x600 },
      { name: '1USER.DAT', size: 0x20000 },
      { name: '2USER.DAT', size: 0x800 },
      { name: 'ICON0.PNG', size: 0x5000 },
    ];

    const pfd = createPfdForFiles(files, SECURE_ID);

    const plain = new Map();
    plain.set('param.sfo', new Uint8Array(0x600));
    plain.set('1user.dat', new Uint8Array(0x20000));
    plain.set('2user.dat', new Uint8Array(0x800));
    plain.set('icon0.png', new Uint8Array(0x5000));

    const encrypted = new Map();
    encrypted.set('param.sfo', plain.get('param.sfo'));
    for (const entry of pfd.entries) {
      const lower = entry.fileName.toLowerCase();
      if (lower === 'param.sfo') continue;
      const data = plain.get(lower);
      encrypted.set(lower, encryptFile(data, entry.fileName, pfd, true));
    }

    expect(validAllParamHashes(encrypted, true, pfd)).toBe(true);

    const bytes = getParamPfdCombinedData(pfd);
    const pfd2 = parseParamPfd(bytes);
    pfd2.secureFileID = SECURE_ID; // restored externally in production

    expect(validAllParamHashes(encrypted, false, pfd2)).toBe(true);

    for (const entry of pfd2.entries) {
      const lower = entry.fileName.toLowerCase();
      if (lower === 'param.sfo') continue;
      const orig = plain.get(lower);
      const enc = encrypted.get(lower);
      const dec = decryptFile(enc, entry.fileName, pfd2);
      expect(dec.length).toBe(orig.length);
      expect(toHex(dec)).toBe(toHex(orig));
    }
  });

  test('PARAM.SFO in encrypted export is not encrypted (just hashed)', () => {
    const files = [
      { name: 'PARAM.SFO', size: 16 },
      { name: 'USER.DAT', size: 32 },
    ];

    const pfd = createPfdForFiles(files, SECURE_ID);
    const sfoData = new Uint8Array(16);
    for (let i = 0; i < 16; i++) sfoData[i] = i + 1;

    const userEnc = encryptFile(new Uint8Array(32), 'USER.DAT', pfd, true);

    const encFiles = new Map();
    encFiles.set('param.sfo', sfoData);
    encFiles.set('user.dat', userEnc);

    validAllParamHashes(encFiles, true, pfd);

    expect(toHex(encFiles.get('param.sfo'))).toBe(toHex(sfoData));
  });
});

/* ========================================================================
 * Relocated from pfd-round-trip.test.js — unique test not covered elsewhere
 * ==================================================================== */

describe('PFD serialization determinism', () => {
  test('re-serializing a parsed PFD is byte-identical', () => {
    // Build a PFD, fix hashes, serialize, parse it back, then re-serialize.
    // The two byte arrays should be identical — proving round-trip fidelity.
    const files = [
      { name: 'PARAM.SFO', size: 16 },
      { name: 'USER.DAT', size: 32 },
    ];
    const pfd = createPfdForFiles(files, SECURE_ID);
    const fileData = new Map([
      ['param.sfo', new Uint8Array(16)],
      ['user.dat', new Uint8Array(32)],
    ]);
    validAllParamHashes(fileData, true, pfd);

    const bytes1 = getParamPfdCombinedData(pfd);
    const pfd2 = parseParamPfd(bytes1);
    pfd2.secureFileID = SECURE_ID;
    const bytes2 = getParamPfdCombinedData(pfd2);

    expect(toHex(bytes1)).toBe(toHex(bytes2));
  });
});
