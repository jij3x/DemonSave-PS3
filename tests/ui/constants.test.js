/**
 * @jest-environment jsdom
 *
 * Tests for constants.js — validates the shared constants and the
 * validateName() helper.
 */

export {};

const {
  NONE_ID,
  DEFAULT_MISC2,
  DEFAULT_DEPOSIT_FLAGS,
  DURABILITY_FALLBACK,
  MAX_NAME_CHARS,
  validateName,
} = await import('../../js/ui/core/constants.js');

describe('constants', () => {
  describe('constant values', () => {
    test('NONE_ID is 0xFFFFFFFF', () => {
      expect(NONE_ID).toBe(0xffffffff);
    });

    test('DEFAULT_MISC2 is 0x01000000', () => {
      expect(DEFAULT_MISC2).toBe(0x01000000);
    });

    test('DEFAULT_DEPOSIT_FLAGS has 7 bytes with 0x21 marker', () => {
      expect(DEFAULT_DEPOSIT_FLAGS).toEqual([0x21, 0, 0, 0, 0, 0, 0]);
      expect(DEFAULT_DEPOSIT_FLAGS.length).toBe(7);
    });

    test('DURABILITY_FALLBACK is 200', () => {
      expect(DURABILITY_FALLBACK).toBe(200);
    });

    test('MAX_NAME_CHARS is 16', () => {
      expect(MAX_NAME_CHARS).toBe(16);
    });
  });

  describe('validateName', () => {
    test('accepts a normal name', () => {
      expect(validateName('TestChar')).toEqual({ valid: true });
    });

    test('accepts empty string', () => {
      expect(validateName('')).toEqual({ valid: true });
    });

    test('accepts null (coerces to empty string)', () => {
      expect(validateName(/** @type {string} */ (/** @type {unknown} */ (null)))).toEqual({
        valid: true,
      });
    });

    test('accepts undefined (coerces to empty string)', () => {
      expect(validateName(/** @type {string} */ (/** @type {unknown} */ (undefined)))).toEqual({
        valid: true,
      });
    });

    test('accepts exactly 16 characters', () => {
      expect(validateName('A'.repeat(16))).toEqual({ valid: true });
    });

    test('rejects name longer than 16 characters', () => {
      const result = validateName('A'.repeat(17));
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds 16 characters');
    });

    test('accepts CJK characters within length limit', () => {
      expect(validateName('武田信玄')).toEqual({ valid: true });
    });

    test('rejects C0 control characters (U+0000–U+001F)', () => {
      const result = validateName('A\u0001B');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('invalid control character');
    });

    test('rejects null byte (U+0000)', () => {
      const result = validateName('A\u0000B');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('control character');
    });

    test('rejects C1 control characters (U+007F–U+009F)', () => {
      const result = validateName('A\u0080B');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('control character');
    });

    test('rejects DEL character (U+007F)', () => {
      const result = validateName('A\u007FB');
      expect(result.valid).toBe(false);
    });

    test('accepts spaces and punctuation', () => {
      expect(validateName('Hello, World!')).toEqual({ valid: true });
    });

    test('error message includes hex code for control char', () => {
      const result = validateName('\u0001');
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/U\+0001/);
    });
  });
});
