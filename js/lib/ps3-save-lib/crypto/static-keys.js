/**
 * Static cryptographic keys used by PS3 save file encryption.
 *
 * Keys are pre-parsed from hex into Uint8Array at module load and cached in
 * a Map for O(1) lookup. This avoids re-parsing the same hex string on every
 * call — important because getStaticKey is called from hot paths (per-entry,
 * per-hash-index, and per-file-operation).
 */

import { fromHex } from '../util/hex.js';

/** name=hex pairs used by the PS3 save system */
export const STATIC_KEYS = [
  'syscon_manager_key=D413B89663E1FE9F75143D3BB4565274',
  'keygen_key=6B1ACEA246B745FD8F93763B920594CD53483B82',
  'savegame_param_sfo_key=0C08000E090504040D010F000406020209060D03',
  'trophy_param_sfo_key=5D5B647917024E9BB8D330486B996E795D7F4392',
  'tropsys_dat_key=B080C40FF358643689281736A6BF15892CFEA436',
  'tropusr_dat_key=8711EFF406913F0937F115FAB23DE1A9897A789A',
  'troptrns_dat_key=91EE81555ACC1C4FB5AAE5462CFE1C62A4AF36A5',
  'tropconf_sfm_key=E2ED33C71C444EEBC1E23D635AD8E82F4ECA4E94',
  'fallback_disc_hash_key=D1C1E10B9C547E689B805DCD9710CE8D',
];

/**
 * Pre-parsed key cache (name → Uint8Array).
 * Populated once at module load.
 */
const _cache = new Map();
for (const line of STATIC_KEYS) {
  const eq = line.indexOf('=');
  const keyName = line.substring(0, eq).toLowerCase();
  _cache.set(keyName, fromHex(line.substring(eq + 1)));
}

/**
 * Look up a static key by name (case-insensitive) and return it as bytes.
 *
 * Returns a fresh copy of the cached key on every call. The copy is only
 * 16–20 bytes, so the allocation cost is negligible (~1 ns) compared to the
 * downstream crypto operation it feeds into (HMAC-SHA1 / AES, ~1000+ ns).
 *
 * Returning a copy eliminates cache-poisoning bugs — any accidental
 * mutation by a caller cannot corrupt the shared cache for other callers.
 *
 * @param {string} name
 * @returns {Uint8Array} a fresh copy — safe to mutate
 */
export function getStaticKey(name) {
  const key = _cache.get(name.toLowerCase());
  if (!key) throw new Error(`Unknown static key: "${name}"`);
  return key.slice();
}
