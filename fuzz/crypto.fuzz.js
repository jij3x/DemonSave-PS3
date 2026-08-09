/**
 * Jazzer.js fuzz target for the encryptFile↔decryptFile cipher round-trip.
 *
 * Run via `npm run fuzz:crypto` (open-ended) or `fuzz:crypto:smoke` (60s bounded).
 * Per-target tuning (--sync, -max_len, -timeout) lives in tools/fuzz.mjs; run
 * `node tools/fuzz.mjs crypto --dry-run` to print the resolved jazzer argv.
 *
 * The fuzz input is plaintext of arbitrary length. The target creates a fresh
 * PFD entry for it, encrypts, decrypts, and asserts byte-exact round-trip —
 * exercising the CTR-like cipher and AES-ECB block primitives across aligned
 * and non-aligned lengths. Thin wrapper: all logic lives in fuzz/oracle.js.
 */

import { assertCryptoRoundTrip } from './oracle.js';

/**
 * @param {Buffer} data  raw plaintext bytes generated/mutated by libFuzzer
 * @returns {void}
 */
export function fuzz(data) {
  assertCryptoRoundTrip(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
}
