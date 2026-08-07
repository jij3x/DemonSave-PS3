/**
 * @jest-environment node
 *
 * Companion to tauri-bridge.test.js.  That file runs under jsdom, where
 * `window` always exists, so it cannot reach the `window === undefined`
 * branch of getTauri().  This file runs under the plain node environment
 * (no `window` global) to cover that single branch.
 */

import { isTauri } from '../../js/lib/tauri-bridge.js';

describe('isTauri (node environment, no window)', () => {
  test('returns false when window is undefined', () => {
    expect(typeof window).toBe('undefined');
    expect(isTauri()).toBe(false);
  });
});
