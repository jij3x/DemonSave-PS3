/**
 * @jest-environment jsdom
 *
 * Tests for the canvas measureText() branch of select-width computation in
 * controls.js.
 *
 * controls.js computes SELECT_WIDTHS eagerly at module load via namesToWidth()
 * -> getMeasureContext(). jsdom does not implement a real 2D canvas context
 * (getContext returns null), so the canvas branch is never exercised by the
 * default test harness. These tests install a fake context (or a throwing one)
 * BEFORE importing controls.js and rely on jest.resetModules() to re-evaluate
 * the module under each configuration.
 */

import { jest } from '@jest/globals';

export {};

describe('controls canvas measureText path', () => {
  test('uses canvas measureText when a 2D context is available', async () => {
    // Distinctive constant width so every measured key collapses to the same
    // value: Math.ceil(100.3) + SELECT_WIDTH_OVERHEAD(40) === 141.
    const measureMock = jest.fn(() => ({ width: 100.3 }));
    const ctxMock = /** @type {CanvasRenderingContext2D} */ (
      /** @type {unknown} */ ({ font: '', measureText: measureMock })
    );
    const getContextSpy = jest
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(ctxMock);

    jest.resetModules();
    const { SELECT_WIDTHS } = await import('../../js/ui/core/controls.js');

    // getContext('2d') was called and a real measurement drove the widths.
    expect(getContextSpy).toHaveBeenCalledWith('2d');
    expect(measureMock).toHaveBeenCalled();
    expect(SELECT_WIDTHS.spells).toBe(141);
    expect(SELECT_WIDTHS.armor).toBe(141);

    getContextSpy.mockRestore();
  });

  test('falls back to the char-count heuristic when getContext throws', async () => {
    const getContextSpy = jest
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockImplementation(() => {
        throw new Error('boom');
      });

    jest.resetModules();
    const { SELECT_WIDTHS } = await import('../../js/ui/core/controls.js');

    // No crash; widths still produced via the fallback (longest name * 7 + 40).
    expect(typeof SELECT_WIDTHS.spells).toBe('number');
    expect(SELECT_WIDTHS.spells).toBeGreaterThan(0);
    // Distinct from the measured-path value (141) above, confirming fallback ran.
    expect(SELECT_WIDTHS.spells).not.toBe(141);

    getContextSpy.mockRestore();
  });
});
