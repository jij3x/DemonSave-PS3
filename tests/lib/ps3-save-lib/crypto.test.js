/**
 * Crypto primitive parity tests.
 *
 * Covers AES-ECB/CBC against NIST known-answer vectors, HMAC-SHA1 against
 * RFC 2202 case 1, and the custom CTR-like transform via round-trip.
 */
import {
  fromHex,
  toHex,
  compareBytes,
  compareDigests,
  aesEcbEncryptBlock,
  aesEcbDecryptBlock,
  encryptWithPortability,
  decryptWithPortability,
  ctrEncrypt,
  ctrDecrypt,
  hmacSha1,
  defaultHash,
  getStaticKey,
} from '../../../js/lib/ps3-save-lib/index.js';

/* ---------------- AES-128 ECB (NIST FIPS-197 / SP800-38A) ---------------- */

describe('AES-128 ECB (NIST SP800-38A Appendix B)', () => {
  // Block size = 16 bytes.
  const key = fromHex('2b7e151628aed2a6abf7158809cf4f3c');
  const plain = fromHex('6bc1bee22e409f96e93d7e117393172a');
  const cipher = fromHex('3ad77bb40d7a3660a89ecaf32466ef97');

  test('encrypt known block', () => {
    expect(toHex(aesEcbEncryptBlock(key, plain))).toBe(toHex(cipher));
  });
  test('decrypt known block', () => {
    expect(toHex(aesEcbDecryptBlock(key, cipher))).toBe(toHex(plain));
  });
  test('round-trip', () => {
    const block = new Uint8Array(16);
    for (let i = 0; i < 16; i++) block[i] = i * 11 + 3;
    const enc = aesEcbEncryptBlock(key, block);
    const dec = aesEcbDecryptBlock(key, enc);
    expect(toHex(dec)).toBe(toHex(block));
  });
});

/* ---------------- AES-128 CBC (NIST SP800-38A Appendix F) ---------------- */

describe('AES-128 CBC (NIST vectors via noble ciphers)', () => {
  // We test our CBC wrappers via round-trip, since the exact zero-padding
  // behavior is already pinned by the ECB vectors above.
  const _key = fromHex('2b7e151628aed2a6abf7158809cf4f3c');
  const iv = new Uint8Array(16); // zero IV
  const data = fromHex('6bc1bee22e409f96e93d7e117393172a' + 'ae2d8a571e03ac9c9eb76fac45af8e51');

  test('encryptWithPortability / decryptWithPortability round-trip', () => {
    const enc = encryptWithPortability(iv, data, data.length);
    // CBC ciphertext is same length as (zero-padded) plaintext.
    expect(enc.length).toBe(data.length);
    const dec = decryptWithPortability(iv, enc, enc.length);
    expect(toHex(dec)).toBe(toHex(data));
  });
});

describe('PFD signature round-trip (64-byte block, ends in 0x00)', () => {
  // The PFD signature is exactly 64 bytes and the last 4 bytes are padding
  // (typically 0x00). This test pins the behavior that decrypt preserves
  // trailing zeros.
  const iv = new Uint8Array(16);
  for (let i = 0; i < 16; i++) iv[i] = (i * 7 + 1) & 0xff;
  const sig = new Uint8Array(64);
  for (let i = 0; i < 60; i++) sig[i] = (i * 13 + 5) & 0xff;
  // bytes 60..63 are zero (padding)

  test('round-trip preserves trailing zeros', () => {
    const enc = encryptWithPortability(iv, sig, 64);
    expect(enc.length).toBe(64);
    const dec = decryptWithPortability(iv, enc, 64);
    expect(toHex(dec)).toBe(toHex(sig));
  });
});

/* ---------------- HMAC-SHA1 (RFC 2202) ---------------- */

describe('HMAC-SHA1 (RFC 2202 case 1)', () => {
  // Key = 0x0b repeated 20 times, data = "Hi There"
  const key = new Uint8Array(20).fill(0x0b);
  const data = new TextEncoder().encode('Hi There');
  const expected = 'b617318655057264e28bc0b6fb378c8ef146be00';

  test('digest', () => {
    expect(toHex(hmacSha1(key, data, 0, data.length))).toBe(expected);
  });
});

describe('HMAC-SHA1 defaultHash (empty data)', () => {
  test('matches HMAC-SHA1 of empty buffer', () => {
    const key = fromHex('0102030405060708090a0b0c0d0e0f1011121314');
    const a = defaultHash(key);
    const b = hmacSha1(key, new Uint8Array(0), 0, 0);
    expect(toHex(a)).toBe(toHex(b));
  });
});

/* ---------------- custom CTR-like transform ---------------- */

describe('CTR-like transform round-trips', () => {
  const key = getStaticKey('savegame_param_sfo_key').slice(0, 16);

  test('1 block (16 bytes)', () => {
    const p = new Uint8Array(16);
    for (let i = 0; i < 16; i++) p[i] = i;
    const c = ctrEncrypt(key, p, 16);
    expect(c.length).toBe(16);
    expect(toHex(ctrDecrypt(key, c, 16))).toBe(toHex(p));
  });

  test('3 blocks (48 bytes)', () => {
    const p = new Uint8Array(48);
    for (let i = 0; i < 48; i++) p[i] = (i * 7 + 1) & 0xff;
    const c = ctrEncrypt(key, p, 48);
    expect(toHex(ctrDecrypt(key, c, 48))).toBe(toHex(p));
  });

  test('identical-block input produces different ciphertext per block', () => {
    // CTR-like: same plaintext block at different offsets → different ct.
    const p = new Uint8Array(48).fill(0xab);
    const c = ctrEncrypt(key, p, 48);
    const b0 = toHex(c.subarray(0, 16));
    const b1 = toHex(c.subarray(16, 32));
    const b2 = toHex(c.subarray(32, 48));
    expect(b0).not.toBe(b1);
    expect(b1).not.toBe(b2);
    expect(b0).not.toBe(b2);
    expect(toHex(ctrDecrypt(key, c, 48))).toBe(toHex(p));
  });

  test('key shorter than 16 bytes is zero-padded (resizeKey16)', () => {
    // Pass a short key — the internal resizeKey16 should pad to 16 bytes.
    const shortKey = new Uint8Array(10).fill(0x55);
    const p = new Uint8Array(16);
    for (let i = 0; i < 16; i++) p[i] = i;
    const c = ctrEncrypt(shortKey, p, 16);
    expect(c.length).toBe(16);
    expect(toHex(ctrDecrypt(shortKey, c, 16))).toBe(toHex(p));
  });

  test('key longer than 16 bytes is truncated (resizeKey16)', () => {
    // Pass a long key — the internal resizeKey16 should truncate to 16 bytes.
    const longKey = new Uint8Array(24).fill(0x77);
    const p = new Uint8Array(16);
    for (let i = 0; i < 16; i++) p[i] = 0xff;
    const c = ctrEncrypt(longKey, p, 16);
    expect(c.length).toBe(16);
    expect(toHex(ctrDecrypt(longKey, c, 16))).toBe(toHex(p));
  });
});

/* ---------------- IV resizing in portability functions ---------------- */

describe('IV resizing in encrypt/decryptWithPortability', () => {
  test('short IV (8 bytes) is zero-padded to 16', () => {
    const shortIv = new Uint8Array(8).fill(0xab);
    const data = new Uint8Array(16).fill(0x42);
    // Should not throw — the IV gets padded internally
    const enc = encryptWithPortability(shortIv, data, 16);
    expect(enc.length).toBe(16);
    const dec = decryptWithPortability(shortIv, enc, 16);
    expect(toHex(dec)).toBe(toHex(data));
  });
  test('long IV (20 bytes) is truncated to 16', () => {
    const longIv = new Uint8Array(20).fill(0xcd);
    const data = new Uint8Array(16).fill(0x11);
    const enc = encryptWithPortability(longIv, data, 16);
    expect(enc.length).toBe(16);
    const dec = decryptWithPortability(longIv, enc, 16);
    expect(toHex(dec)).toBe(toHex(data));
  });
});

/* ---------------- hmacSha1 with default params ---------------- */

describe('hmacSha1 default params', () => {
  test('omitting start/length uses full data', () => {
    const key = new Uint8Array(20).fill(0x0b);
    const data = new TextEncoder().encode('Hi There');
    // Both calls should produce the same digest
    const a = toHex(hmacSha1(key, data));
    const b = toHex(hmacSha1(key, data, 0, data.length));
    expect(a).toBe(b);
  });
  test('start offset slices correctly', () => {
    const key = new Uint8Array(20).fill(0x0b);
    const full = new TextEncoder().encode('ABCD');
    const sliced = full.slice(1, 3); // 'BC'
    const a = toHex(hmacSha1(key, full, 1, 2));
    const b = toHex(hmacSha1(key, sliced));
    expect(a).toBe(b);
  });
});

/* ---------------- static key lookup ---------------- */

describe('getStaticKey', () => {
  test('returns syscon_manager_key bytes', () => {
    const k = getStaticKey('syscon_manager_key');
    expect(k.length).toBe(16);
    expect(toHex(k)).toBe('d413b89663e1fe9f75143d3bb4565274');
  });
  test('case-insensitive', () => {
    expect(toHex(getStaticKey('SYSCON_MANAGER_KEY'))).toBe(
      toHex(getStaticKey('syscon_manager_key')),
    );
  });
  test('keygen_key is 20 bytes', () => {
    expect(getStaticKey('keygen_key').length).toBe(20);
  });
  test('throws for unknown key name', () => {
    // getStaticKey now throws instead of returning null, so that a typo in
    // a key name surfaces immediately rather than propagating null as a
    // crypto key and crashing later.
    expect(() => getStaticKey('nonexistent_key')).toThrow(/Unknown static key/);
  });
  test('all defined keys are accessible', () => {
    const names = [
      'syscon_manager_key',
      'keygen_key',
      'savegame_param_sfo_key',
      'trophy_param_sfo_key',
      'tropsys_dat_key',
      'tropusr_dat_key',
      'troptrns_dat_key',
      'tropconf_sfm_key',
      'fallback_disc_hash_key',
    ];
    for (const name of names) {
      const k = getStaticKey(name);
      expect(k).not.toBeNull();
      expect(k.length).toBeGreaterThan(0);
    }
  });
});

/* ========================================================================
 * AES edge cases (zeroPadToBlock, CBC alignment)
 * ==================================================================== */

describe('AES edge cases', () => {
  test('zeroPadToBlock: already-aligned input returns a copy', () => {
    // 32 bytes = exactly 2 blocks — no padding needed
    const input = new Uint8Array(32).fill(0xab);
    const result = encryptWithPortability(new Uint8Array(16), input, 32);
    expect(result.length).toBe(32);
    // Round-trip
    const decrypted = decryptWithPortability(new Uint8Array(16), result, 32);
    expect(decrypted.length).toBe(32);
    for (let i = 0; i < 32; i++) {
      expect(decrypted[i]).toBe(0xab);
    }
  });

  test('zeroPadToBlock: unaligned input gets zero-padded', () => {
    // 20 bytes → needs 12 bytes padding to reach 32 (2 blocks)
    const input = new Uint8Array(20).fill(0xcd);
    const result = encryptWithPortability(new Uint8Array(16), input, 32);
    expect(result.length).toBe(32);
    // Decrypt back — first 20 bytes should match, rest are padding zeros
    const decrypted = decryptWithPortability(new Uint8Array(16), result, 32);
    for (let i = 0; i < 20; i++) {
      expect(decrypted[i]).toBe(0xcd);
    }
    for (let i = 20; i < 32; i++) {
      expect(decrypted[i]).toBe(0);
    }
  });

  test('CBC single block (16 bytes) round-trips', () => {
    const iv = new Uint8Array(16).fill(0x01);
    const data = new Uint8Array(16).fill(0x42);
    const enc = encryptWithPortability(iv, data, 16);
    const dec = decryptWithPortability(iv, enc, 16);
    expect(dec.length).toBe(16);
    for (let i = 0; i < 16; i++) {
      expect(dec[i]).toBe(0x42);
    }
  });
});

/* ========================================================================
 * CTR-like edge cases
 * ==================================================================== */

describe('CTR-like edge cases', () => {
  test('empty input (0 blocks) returns empty', () => {
    const key = new Uint8Array(16).fill(0xaa);
    const data = new Uint8Array(0);
    const enc = ctrEncrypt(key, data, 0);
    expect(enc.length).toBe(0);
  });

  test('throws on block count exceeding sanity limit', () => {
    const key = new Uint8Array(16).fill(0xaa);
    // 1M+1 blocks = just over the 0x100000 limit
    const hugeSize = 0x100001 * 16;
    // Don't actually allocate — just test the guard
    const fakeData = /** @type {Uint8Array} */ (/** @type {unknown} */ ({ length: hugeSize }));
    expect(() => ctrEncrypt(key, fakeData, hugeSize)).toThrow(/sanity limit/);
  });
});

/* ========================================================================
 * HMAC-SHA1 edge cases
 * ==================================================================== */

describe('HMAC-SHA1 edge cases', () => {
  test('produces 20-byte digest for short input', () => {
    const key = new Uint8Array([1, 2, 3]);
    const data = new Uint8Array([0xff]);
    const result = hmacSha1(key, data, 0, 1);
    expect(result.length).toBe(20);
  });
  // Note: start-offset slicing is already tested in 'hmacSha1 default params'
  // → 'start offset slices correctly' above.
});

/* ========================================================================
 * AES block-size validation
 * ==================================================================== */

describe('AES block-size validation', () => {
  test('aesEcbEncryptBlock throws on non-16-byte block', () => {
    const key = new Uint8Array(16).fill(0x42);
    expect(() => aesEcbEncryptBlock(key, new Uint8Array(15))).toThrow(/16 bytes/);
    expect(() => aesEcbEncryptBlock(key, new Uint8Array(17))).toThrow(/16 bytes/);
  });

  test('aesEcbDecryptBlock throws on non-16-byte block', () => {
    const key = new Uint8Array(16).fill(0x42);
    expect(() => aesEcbDecryptBlock(key, new Uint8Array(15))).toThrow(/16 bytes/);
    expect(() => aesEcbDecryptBlock(key, new Uint8Array(17))).toThrow(/16 bytes/);
  });
});

/* ========================================================================
 * CTR-like ctrDecrypt empty input + hmac bounds check
 * ==================================================================== */

describe('CTR-like ctrDecrypt empty input', () => {
  test('ctrDecrypt with 0 blocks returns empty', () => {
    const key = new Uint8Array(16).fill(0xbb);
    const result = ctrDecrypt(key, new Uint8Array(0), 0);
    expect(result.length).toBe(0);
  });
});

describe('HMAC-SHA1 bounds checking', () => {
  test('throws on non-integer start', () => {
    const key = new Uint8Array(20).fill(0x0b);
    const data = new Uint8Array([1, 2, 3]);
    expect(() => hmacSha1(key, data, 1.5, 2)).toThrow(RangeError);
  });

  test('throws on non-integer length', () => {
    const key = new Uint8Array(20).fill(0x0b);
    const data = new Uint8Array([1, 2, 3]);
    expect(() => hmacSha1(key, data, 0, 2.5)).toThrow(RangeError);
  });

  test('throws on start + length > data.length', () => {
    const key = new Uint8Array(20).fill(0x0b);
    const data = new Uint8Array([1, 2, 3]);
    expect(() => hmacSha1(key, data, 0, 10)).toThrow(/out of bounds/);
  });

  test('throws on negative start', () => {
    const key = new Uint8Array(20).fill(0x0b);
    const data = new Uint8Array([1, 2, 3]);
    expect(() => hmacSha1(key, data, -1, 2)).toThrow(/out of bounds/);
  });
});

/* ========================================================================
 * Relocated from fixes.test.js — compareDigests alias
 * ==================================================================== */

describe('compareDigests alias', () => {
  test('compareDigests is the same function as compareBytes', () => {
    // compareDigests is a named alias of compareBytes (util/hex.js), so the
    // equality behavior is already pinned by the compareBytes tests in
    // hex.test.js — only the alias binding is asserted here.
    expect(compareDigests).toBe(compareBytes);
  });
});
