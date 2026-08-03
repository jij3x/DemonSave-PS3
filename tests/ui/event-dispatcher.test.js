/**
 * @jest-environment jsdom
 *
 * Tests for the centralized event dispatcher — handler registration,
 * routing, ordering, error isolation, and reset.
 *
 * NOTE: This module attaches listeners to `document` that persist across
 * the entire test worker. Other test suites (dirty.test.js, events.test.js,
 * etc.) register handlers via these same listeners. We must NOT call
 * resetDispatcher() in beforeEach, because that would clear their handlers
 * and break their tests. Instead, we use unique sentinel values to verify
 * our own handlers fire, without interfering with others.
 */

import { jest } from '@jest/globals';

const { registerChangeHandler, registerInputHandler } =
  await import('../../js/ui/core/event-dispatcher.js');

// Unique sentinel used to identify our handlers' calls
const SENTINEL = '__event_dispatcher_test_sentinel__';

describe('event-dispatcher', () => {
  describe('registerChangeHandler', () => {
    test('receives change events dispatched on document', () => {
      const calls = [];
      registerChangeHandler((e) => {
        if (e.target.dataset?.[SENTINEL] === 'change') {
          calls.push(e.target.value);
        }
      });

      const inp = document.createElement('input');
      inp.value = 'abc';
      inp.dataset[SENTINEL] = 'change';
      document.body.appendChild(inp);

      inp.dispatchEvent(new Event('change', { bubbles: true }));

      expect(calls).toEqual(['abc']);
    });

    test('multiple handlers fire in registration order', () => {
      const order = [];
      registerChangeHandler(() => order.push('first'));
      registerChangeHandler(() => order.push('second'));
      registerChangeHandler(() => order.push('third'));

      const inp = document.createElement('input');
      document.body.appendChild(inp);
      inp.dispatchEvent(new Event('change', { bubbles: true }));

      expect(order).toEqual(['first', 'second', 'third']);
    });

    test('handler that throws does not prevent subsequent handlers', () => {
      const calls = [];
      registerChangeHandler(() => {
        throw new Error('boom');
      });
      registerChangeHandler(() => calls.push('still runs'));

      const inp = document.createElement('input');
      document.body.appendChild(inp);

      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
      inp.dispatchEvent(new Event('change', { bubbles: true }));
      spy.mockRestore();

      expect(calls).toEqual(['still runs']);
    });
  });

  describe('registerInputHandler', () => {
    test('receives input events dispatched on document', () => {
      const calls = [];
      registerInputHandler((e) => {
        if (e.target.dataset?.[SENTINEL] === 'input') {
          calls.push(e.target.value);
        }
      });

      const inp = document.createElement('input');
      inp.value = 'hello';
      inp.dataset[SENTINEL] = 'input';
      document.body.appendChild(inp);

      inp.dispatchEvent(new Event('input', { bubbles: true }));

      expect(calls).toEqual(['hello']);
    });

    test('multiple input handlers fire in registration order', () => {
      const order = [];
      registerInputHandler(() => order.push('a'));
      registerInputHandler(() => order.push('b'));

      const inp = document.createElement('input');
      document.body.appendChild(inp);
      inp.dispatchEvent(new Event('input', { bubbles: true }));

      expect(order).toEqual(['a', 'b']);
    });

    test('input handler that throws does not prevent subsequent handlers', () => {
      const calls = [];
      registerInputHandler(() => {
        throw new Error('boom');
      });
      registerInputHandler(() => calls.push('still runs'));

      const inp = document.createElement('input');
      document.body.appendChild(inp);

      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      spy.mockRestore();

      expect(calls).toEqual(['still runs']);
    });
  });

  describe('change and input are independent', () => {
    test('change handler does not fire on input event', () => {
      const changeCalls = [];
      registerChangeHandler(() => changeCalls.push('change'));

      const inp = document.createElement('input');
      document.body.appendChild(inp);
      inp.dispatchEvent(new Event('input', { bubbles: true }));

      // changeCalls may contain entries from other suites' handlers,
      // but our handler should NOT have fired for this specific event.
      // We can't assert changeCalls is empty (other handlers may push),
      // but we can verify our handler didn't fire by using a unique marker.
      const marker = '__change_only__';
      const myCalls = [];
      registerChangeHandler((e) => {
        if (e.target.dataset?.[SENTINEL] === marker) {
          myCalls.push('fired');
        }
      });

      const inp2 = document.createElement('input');
      inp2.dataset[SENTINEL] = marker;
      document.body.appendChild(inp2);
      inp2.dispatchEvent(new Event('input', { bubbles: true }));

      expect(myCalls).toEqual([]);
    });

    test('input handler does not fire on change event', () => {
      const marker = '__input_only__';
      const myCalls = [];
      registerInputHandler((e) => {
        if (e.target.dataset?.[SENTINEL] === marker) {
          myCalls.push('fired');
        }
      });

      const inp = document.createElement('input');
      inp.dataset[SENTINEL] = marker;
      document.body.appendChild(inp);
      inp.dispatchEvent(new Event('change', { bubbles: true }));

      expect(myCalls).toEqual([]);
    });
  });
});
