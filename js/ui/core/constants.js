/**
 * constants.js — Shared constants for the UI layer.
 *
 * Centralizes shared magic numbers and validation helpers for the UI layer.
 * Importing from here avoids duplication and makes the values easy to audit.
 */

/**
 * Sentinel item ID meaning "no item equipped / empty slot".
 * The save format stores this as an unsigned 32-bit integer.
 * @type {number}
 */
export const NONE_ID = 0xffffffff;

/**
 * Default misc2 value for new inventory items added via the UI.
 * Observed saves consistently use 0x01000000 for existing items.
 * @type {number}
 */
export const DEFAULT_MISC2 = 0x01000000;

/**
 * Default structural flag bytes for a new deposit item when the user
 * does not provide them (new rows added via the Add button).
 * Byte 0 (0x21) is the game-native "occupied item" marker.
 * @type {number[]}
 */
export const DEFAULT_DEPOSIT_FLAGS = [0x21, 0, 0, 0, 0, 0, 0];

/**
 * Fallback max durability when an item is not found in the des-db or
 * the DB lookup fails.  Used for weapons and armor only.
 * @type {number}
 */
export const DURABILITY_FALLBACK = 200;

/**
 * Maximum number of characters allowed in the character name field.
 * The save format allocates exactly 16 UTF-16 character pairs (32 bytes).
 * The writer enforces this, but the UI validates early for a better UX.
 * @type {number}
 */
export const MAX_NAME_CHARS = 16;

/**
 * Validate a character name string for save-write safety.
 *
 * The PS3 save format stores the name as 16 UTF-16 character pairs.
 * This function checks:
 *   - Length ≤ MAX_NAME_CHARS (16 characters)
 *   - Contains only printable characters (no control chars, no null bytes)
 *
 * Note on string semantics: `.length` (UTF-16 code units) is used for the
 * length check because the save format allocates 16 UTF-16 character pairs
 * (32 bytes) — this matches the binary constraint exactly.  The `for…of`
 * loop below iterates by code point and is used only for control-character
 * detection (it handles surrogate pairs correctly for that purpose).
 *
 * @param {string} name  the raw name string from the UI
 * @returns {{ valid: boolean, error?: string }} result with optional error message
 */
export function validateName(name) {
  const nameStr = String(name ?? '');

  if (nameStr.length > MAX_NAME_CHARS) {
    return {
      valid: false,
      error: `Name "${nameStr}" exceeds ${MAX_NAME_CHARS} characters.`,
    };
  }

  // Reject control characters (including null bytes) that could corrupt
  // the binary save structure.  Allow any printable Unicode character
  // (letters, digits, punctuation, symbols, spaces, CJK, etc.).
  for (const ch of nameStr) {
    const code = ch.codePointAt(0);
    // C0 control chars (0x00-0x1F) and C1 control chars (0x7F-0x9F)
    if ((code >= 0x00 && code <= 0x1f) || (code >= 0x7f && code <= 0x9f)) {
      return {
        valid: false,
        error: `Name contains an invalid control character (code U+${code.toString(16).toUpperCase().padStart(4, '0')}).`,
      };
    }
  }

  return { valid: true };
}
