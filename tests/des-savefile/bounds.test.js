/**
 * Tests for defensive bounds-check helpers.
 *
 * These helpers exist to replace inline `if (…) throw` branches that were
 * previously annotated with `istanbul ignore`. By extracting the check into
 * a function, the defensive logic becomes independently testable.
 */
import { assertBounds, assertBelow } from '../../js/des-savefile/bounds.js';

describe('assertBounds', () => {
  test('does not throw when range fits within buffer', () => {
    const buf = new Uint8Array(10);
    expect(() => assertBounds(buf, 0, 10)).not.toThrow();
    expect(() => assertBounds(buf, 5, 5)).not.toThrow();
    expect(() => assertBounds(buf, 9, 1)).not.toThrow();
  });

  test('does not throw when size is 0', () => {
    const buf = new Uint8Array(5);
    expect(() => assertBounds(buf, 0, 0)).not.toThrow();
    expect(() => assertBounds(buf, 5, 0)).not.toThrow(); // offset at edge, size 0
  });

  test('throws when offset + size exceeds buffer length', () => {
    const buf = new Uint8Array(10);
    expect(() => assertBounds(buf, 8, 4)).toThrow(/out of bounds/i);
    expect(() => assertBounds(buf, 0, 11)).toThrow(/out of bounds/i);
    expect(() => assertBounds(buf, 10, 1)).toThrow(/out of bounds/i);
  });

  test('throws on negative offset', () => {
    const buf = new Uint8Array(10);
    expect(() => assertBounds(buf, -1, 5)).toThrow(/out of bounds/i);
  });
});

describe('assertBelow', () => {
  test('does not throw when value is below limit', () => {
    expect(() => assertBelow(0, 100, 'test')).not.toThrow();
    expect(() => assertBelow(99, 100, 'test')).not.toThrow();
    expect(() => assertBelow(-1, 0, 'test')).not.toThrow();
  });

  test('throws when value equals limit', () => {
    expect(() => assertBelow(100, 100, 'test')).toThrow(/crossed region boundary/i);
    expect(() => assertBelow(0, 0, 'test')).toThrow(/crossed region boundary/i);
  });

  test('throws when value exceeds limit', () => {
    expect(() => assertBelow(101, 100, 'test')).toThrow(/crossed region boundary/i);
    expect(() => assertBelow(200, 100, 'test')).toThrow(/crossed region boundary/i);
  });

  test('includes label in error message', () => {
    expect(() => assertBelow(100, 100, 'inventory scan')).toThrow(/inventory scan/);
  });
});
