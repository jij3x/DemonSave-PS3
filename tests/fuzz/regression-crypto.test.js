/**
 * Fuzzing regression guard for the encryptFile↔decryptFile cipher round-trip.
 *
 * Jest half of the crypto fuzzing story (Jazzer half: fuzz/crypto.fuzz.js).
 * Both share fuzz/oracle.js. Inputs are built in-memory so `npm test` stays
 * deterministic.
 *
 * The oracle creates a fresh PFD entry for the plaintext, encrypts, decrypts,
 * and asserts byte-exact round-trip — across aligned and non-aligned lengths.
 */
import { assertCryptoRoundTrip } from '../../fuzz/oracle.js';
import { createPopulatedUserDat } from '../../test-fixtures/save-factory.js';

describe('crypto round-trip fuzz regression — cipher inverts exactly', () => {
  test('block-aligned length round-trips', () => {
    expect(() => assertCryptoRoundTrip(createPopulatedUserDat(1).subarray(0, 256))).not.toThrow();
  });

  test('full 0x40000 buffer round-trips', () => {
    expect(() => assertCryptoRoundTrip(createPopulatedUserDat(1))).not.toThrow();
  });

  test('non-block-aligned lengths round-trip', () => {
    expect(() => assertCryptoRoundTrip(createPopulatedUserDat(1).subarray(0, 100))).not.toThrow();
    expect(() => assertCryptoRoundTrip(createPopulatedUserDat(1).subarray(0, 1))).not.toThrow();
    expect(() => assertCryptoRoundTrip(createPopulatedUserDat(1).subarray(0, 17))).not.toThrow();
  });

  test('empty input is a no-op (returns without encrypting)', () => {
    expect(() => assertCryptoRoundTrip(new Uint8Array(0))).not.toThrow();
  });
});
