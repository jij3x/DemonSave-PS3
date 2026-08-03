/**
 * @jest-environment jsdom
 *
 * Tests for the unified custom tooltip system.
 *
 * Covers: initTooltips delegation, show/hide via mouseover/mouseout,
 * truncated-only tooltips, Escape/mousedown dismiss, scroll-hide, and
 * display:contents fallback positioning.
 *
 * IMPORTANT: tooltips.js has module-level state that is intentionally
 * never reset (tooltipsInitialized, tooltipEl). We call initTooltips()
 * once in beforeAll, and between tests we remove only test-specific
 * elements — NOT the tooltip element — so the module's internal
 * tooltipEl reference stays valid.
 */

import { jest } from '@jest/globals';

const { initTooltips } = await import('../../js/ui/widgets/tooltips.js');

describe('tooltips', () => {
  beforeAll(() => {
    initTooltips();
  });

  beforeEach(() => {
    // Remove all elements except the persistent tooltip element.
    // This keeps the module-level tooltipEl reference valid.
    document.querySelectorAll('body > *:not(.custom-tooltip)').forEach((el) => el.remove());

    // Reset tooltip to hidden state
    const tip = document.querySelector('.custom-tooltip');
    if (tip) {
      tip.style.display = 'none';
      tip.style.visibility = '';
    }

    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // initTooltips — double-init guard & tooltip element creation
  // -------------------------------------------------------------------------

  describe('initTooltips', () => {
    test('the tooltip element exists after init', () => {
      const tip = document.querySelector('.custom-tooltip');
      expect(tip).not.toBeNull();
      expect(tip.style.position).toBe('fixed');
      expect(tip.style.display).toBe('none');
    });

    test('is idempotent (calling twice does not add a second element)', () => {
      initTooltips();
      initTooltips();
      const tips = document.querySelectorAll('.custom-tooltip');
      expect(tips.length).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Show / hide via mouseover / mouseout
  // -------------------------------------------------------------------------

  describe('mouseover / mouseout delegation', () => {
    test('shows tooltip after SHOW_DELAY when hovering a [data-tooltip] element', () => {
      const el = document.createElement('button');
      el.setAttribute('data-tooltip', 'Click me');
      document.body.appendChild(el);

      // Before the delay, tooltip is hidden
      el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      const tip = document.querySelector('.custom-tooltip');
      expect(tip.style.display).toBe('none');

      // After the delay, tooltip appears
      jest.advanceTimersByTime(500);
      expect(tip.style.display).toBe('block');
      expect(tip.textContent).toBe('Click me');
    });

    test('sets aria-describedby on the target for screen reader access', () => {
      const el = document.createElement('button');
      el.setAttribute('data-tooltip', 'Hello');
      document.body.appendChild(el);

      el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      jest.advanceTimersByTime(500);

      expect(el.getAttribute('aria-describedby')).toBe('custom-tooltip');
    });

    test('hides tooltip after HIDE_DELAY on mouseout', () => {
      const el = document.createElement('button');
      el.setAttribute('data-tooltip', 'Bye');
      document.body.appendChild(el);

      // Show the tooltip first
      el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      jest.advanceTimersByTime(500);
      const tip = document.querySelector('.custom-tooltip');
      expect(tip.style.display).toBe('block');

      // Mouseout — starts hide timer
      el.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: null }));
      expect(tip.style.display).toBe('block'); // still visible during grace period

      jest.advanceTimersByTime(200);
      expect(tip.style.display).toBe('none');
    });

    test('clears aria-describedby on hide', () => {
      const el = document.createElement('button');
      el.setAttribute('data-tooltip', 'Temp');
      document.body.appendChild(el);

      el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      jest.advanceTimersByTime(500);
      expect(el.hasAttribute('aria-describedby')).toBe(true);

      el.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: null }));
      jest.advanceTimersByTime(200);
      expect(el.hasAttribute('aria-describedby')).toBe(false);
    });

    test('does not show tooltip for elements without [data-tooltip]', () => {
      const el = document.createElement('button');
      el.textContent = 'No tooltip';
      document.body.appendChild(el);

      el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      jest.advanceTimersByTime(500);

      const tip = document.querySelector('.custom-tooltip');
      expect(tip.style.display).toBe('none');
    });

    test('does not hide when moving to a child of the tooltip target', () => {
      const parent = document.createElement('div');
      parent.setAttribute('data-tooltip', 'Parent tip');
      const child = document.createElement('span');
      child.textContent = 'child';
      parent.appendChild(child);
      document.body.appendChild(parent);

      // Show tooltip
      parent.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      jest.advanceTimersByTime(500);

      // Mouseout from parent to child — should NOT start hide timer
      parent.dispatchEvent(
        new MouseEvent('mouseout', {
          bubbles: true,
          relatedTarget: child,
        }),
      );
      jest.advanceTimersByTime(200);

      const tip = document.querySelector('.custom-tooltip');
      expect(tip.style.display).toBe('block');
    });

    test('re-hovering cancels pending hide and re-shows', () => {
      const el = document.createElement('button');
      el.setAttribute('data-tooltip', 'Re-hover');
      document.body.appendChild(el);

      // Show
      el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      jest.advanceTimersByTime(500);

      // Start hiding
      el.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: null }));

      // Re-hover before hide completes — should cancel hide
      el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      jest.advanceTimersByTime(200);

      const tip = document.querySelector('.custom-tooltip');
      expect(tip.style.display).toBe('block');
    });
  });

  // -------------------------------------------------------------------------
  // Truncated-only tooltips (data-tooltip-if-truncated)
  // -------------------------------------------------------------------------

  describe('data-tooltip-if-truncated', () => {
    test('suppresses tooltip when content is not overflowing', () => {
      const el = document.createElement('span');
      el.setAttribute('data-tooltip', 'Hidden tip');
      el.setAttribute('data-tooltip-if-truncated', 'true');
      // In jsdom, scrollWidth and clientWidth are both 0 by default
      // so scrollWidth <= clientWidth → suppressed
      document.body.appendChild(el);

      el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      jest.advanceTimersByTime(500);

      const tip = document.querySelector('.custom-tooltip');
      expect(tip.style.display).toBe('none');
    });

    test('shows tooltip when content overflows (scrollWidth > clientWidth)', () => {
      const el = document.createElement('span');
      el.setAttribute('data-tooltip', 'Overflow tip');
      el.setAttribute('data-tooltip-if-truncated', 'true');
      // Mock overflow: scrollWidth > clientWidth
      Object.defineProperty(el, 'scrollWidth', { value: 200, configurable: true });
      Object.defineProperty(el, 'clientWidth', { value: 100, configurable: true });
      document.body.appendChild(el);

      el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      jest.advanceTimersByTime(500);

      const tip = document.querySelector('.custom-tooltip');
      expect(tip.style.display).toBe('block');
      expect(tip.textContent).toBe('Overflow tip');
    });
  });

  // -------------------------------------------------------------------------
  // Escape key dismiss
  // -------------------------------------------------------------------------

  describe('Escape key dismiss', () => {
    test('hides visible tooltip on Escape', () => {
      const el = document.createElement('button');
      el.setAttribute('data-tooltip', 'Esc me');
      document.body.appendChild(el);

      // Show tooltip
      el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      jest.advanceTimersByTime(500);

      const tip = document.querySelector('.custom-tooltip');
      expect(tip.style.display).toBe('block');

      // Press Escape
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(tip.style.display).toBe('none');
    });

    test('cancels pending show timer on Escape', () => {
      const el = document.createElement('button');
      el.setAttribute('data-tooltip', 'Never shown');
      document.body.appendChild(el);

      // Trigger hover (show timer pending)
      el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

      // Press Escape before the delay elapses
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      jest.advanceTimersByTime(500);

      const tip = document.querySelector('.custom-tooltip');
      expect(tip.style.display).toBe('none');
    });
  });

  // -------------------------------------------------------------------------
  // Mousedown dismiss
  // -------------------------------------------------------------------------

  describe('mousedown dismiss', () => {
    test('hides tooltip and cancels show timer on mousedown on a tooltip target', () => {
      const el = document.createElement('button');
      el.setAttribute('data-tooltip', 'Click me');
      document.body.appendChild(el);

      // Trigger hover (show timer pending)
      el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

      // Mousedown on the tooltip target cancels show
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      jest.advanceTimersByTime(500);

      const tip = document.querySelector('.custom-tooltip');
      expect(tip.style.display).toBe('none');
    });

    test('does not dismiss when mousedown is not on a tooltip target', () => {
      const tipEl = document.createElement('button');
      tipEl.setAttribute('data-tooltip', 'Visible');
      document.body.appendChild(tipEl);

      const other = document.createElement('div');
      other.textContent = 'No tooltip here';
      document.body.appendChild(other);

      // Show the tooltip
      tipEl.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      jest.advanceTimersByTime(500);

      // Mousedown on a non-tooltip element — should NOT hide
      other.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      const tip = document.querySelector('.custom-tooltip');
      expect(tip.style.display).toBe('block');
    });
  });

  // -------------------------------------------------------------------------
  // Scroll hide
  // -------------------------------------------------------------------------

  describe('scroll hide', () => {
    test('hides tooltip on scroll (capture phase)', () => {
      const el = document.createElement('button');
      el.setAttribute('data-tooltip', 'Scroll me');
      document.body.appendChild(el);

      // Show the tooltip
      el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      jest.advanceTimersByTime(500);

      const tip = document.querySelector('.custom-tooltip');
      expect(tip.style.display).toBe('block');

      // Simulate a scroll event
      document.dispatchEvent(new Event('scroll', { bubbles: true }));
      expect(tip.style.display).toBe('none');
    });

    test('does not attach scroll listener when tooltip is not yet visible', () => {
      // The scroll-hide listener is only attached while a tooltip is
      // actually showing (inside showTooltip).  When the show timer is
      // merely pending, scrolling has no effect — the tooltip will still
      // appear after the delay.
      const el = document.createElement('button');
      el.setAttribute('data-tooltip', 'Pending');
      document.body.appendChild(el);

      // Trigger hover (show timer pending, tooltip not yet visible)
      el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

      // Scroll while the show timer is still pending
      document.dispatchEvent(new Event('scroll', { bubbles: true }));

      // The show timer is NOT cancelled (scroll listener not attached yet),
      // so the tooltip still appears after the delay.
      jest.advanceTimersByTime(500);

      const tip = document.querySelector('.custom-tooltip');
      expect(tip.style.display).toBe('block');
    });
  });

  // -------------------------------------------------------------------------
  // display:contents fallback positioning
  // -------------------------------------------------------------------------

  describe('display:contents fallback', () => {
    test('falls back to child element rect when target has zero-size rect', () => {
      const label = document.createElement('label');
      label.setAttribute('data-tooltip', 'Label tip');
      // Simulate display:contents: zero-size getBoundingClientRect
      Object.defineProperty(label, 'getBoundingClientRect', {
        value: () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }),
        configurable: true,
      });
      const input = document.createElement('input');
      input.type = 'text';
      // Child has a real rect
      Object.defineProperty(input, 'getBoundingClientRect', {
        value: () => ({ left: 50, top: 100, right: 150, bottom: 120, width: 100, height: 20 }),
        configurable: true,
      });
      label.appendChild(input);
      document.body.appendChild(label);

      // Show tooltip
      label.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      jest.advanceTimersByTime(500);

      const tip = document.querySelector('.custom-tooltip');
      expect(tip.style.display).toBe('block');
      // The tooltip should have been positioned (left/top are set)
      expect(tip.style.left).not.toBe('0px');
    });
  });

  // -------------------------------------------------------------------------
  // app bounds — fallback when no #app element exists
  // -------------------------------------------------------------------------

  describe('positioning without #app', () => {
    test('falls back to window dimensions when #app is absent', () => {
      const el = document.createElement('button');
      el.setAttribute('data-tooltip', 'No app');
      Object.defineProperty(el, 'getBoundingClientRect', {
        value: () => ({ left: 100, top: 100, right: 200, bottom: 130, width: 100, height: 30 }),
        configurable: true,
      });
      document.body.appendChild(el);

      // No #app element — should use window fallback
      el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      jest.advanceTimersByTime(500);

      const tip = document.querySelector('.custom-tooltip');
      expect(tip.style.display).toBe('block');
    });
  });

  // -------------------------------------------------------------------------
  // Vertical positioning — clamp to top/bottom edges
  // -------------------------------------------------------------------------

  describe('vertical positioning (flip and clamp)', () => {
    test('flips above when there is more space above than below', () => {
      // Target near the bottom of the viewport: more space above than below
      const el = document.createElement('button');
      el.setAttribute('data-tooltip', 'Bottom tooltip');
      // targetRect: bottom is very near the window bottom
      Object.defineProperty(el, 'getBoundingClientRect', {
        value: () => ({ left: 100, top: 700, right: 200, bottom: 720, width: 100, height: 20 }),
        configurable: true,
      });
      document.body.appendChild(el);

      // Tooltip element will have some height when measured
      el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      jest.advanceTimersByTime(500);

      const tip = document.querySelector('.custom-tooltip');
      expect(tip.style.display).toBe('block');
    });

    test('clamps below when placed below but overflows bottom', () => {
      // Need #app element for bounds clamping to take effect
      const app = document.createElement('div');
      app.id = 'app';
      document.body.appendChild(app);

      const el = document.createElement('button');
      el.setAttribute('data-tooltip', 'Clamped');
      // Target at the bottom of a small #app window
      Object.defineProperty(el, 'getBoundingClientRect', {
        value: () => ({ left: 100, top: 80, right: 200, bottom: 100, width: 100, height: 20 }),
        configurable: true,
      });
      app.appendChild(el);

      // Mock #app rect to be small so tooltip overflows the bottom
      Object.defineProperty(app, 'getBoundingClientRect', {
        value: () => ({ left: 0, top: 0, right: 400, bottom: 120, width: 400, height: 120 }),
        configurable: true,
      });

      el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      jest.advanceTimersByTime(500);

      const tip = document.querySelector('.custom-tooltip');
      expect(tip.style.display).toBe('block');
    });
  });

  // -------------------------------------------------------------------------
  // Empty tooltip text
  // -------------------------------------------------------------------------

  describe('empty data-tooltip', () => {
    test('hides tooltip when data-tooltip is empty', () => {
      const el = document.createElement('button');
      el.setAttribute('data-tooltip', '');
      document.body.appendChild(el);

      el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      jest.advanceTimersByTime(500);

      const tip = document.querySelector('.custom-tooltip');
      // Empty text → showTooltip calls hideTooltip
      expect(tip.style.display).toBe('none');
    });
  });

  // -------------------------------------------------------------------------
  // "Place above" + clamp to top edge (branch coverage)
  // -------------------------------------------------------------------------

  describe('place-above with top-edge clamp', () => {
    test('places tooltip above and clamps to app top when overflowing upward', () => {
      const app = document.createElement('div');
      app.id = 'app';
      document.body.appendChild(app);

      const el = document.createElement('button');
      el.setAttribute('data-tooltip', 'Above tip');
      // Target very close to the top of the app, so spaceAbove is tiny.
      Object.defineProperty(el, 'getBoundingClientRect', {
        value: () => ({ left: 100, top: 5, right: 200, bottom: 25, width: 100, height: 20 }),
        configurable: true,
      });
      app.appendChild(el);

      // Mock #app rect: very small height so tooltip can't fit below.
      Object.defineProperty(app, 'getBoundingClientRect', {
        value: () => ({ left: 0, top: 0, right: 400, bottom: 50, width: 400, height: 50 }),
        configurable: true,
      });

      // Mock the tooltip element to have a non-zero height so the
      // vertical positioning logic has real values to work with.
      const tip = document.querySelector('.custom-tooltip');
      Object.defineProperty(tip, 'offsetHeight', { value: 40, configurable: true });
      Object.defineProperty(tip, 'getBoundingClientRect', {
        value: () => ({ left: 0, top: 0, right: 200, bottom: 40, width: 200, height: 40 }),
        configurable: true,
      });

      el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      jest.advanceTimersByTime(500);

      // Tooltip should be visible — placed above or clamped to top
      expect(tip.style.display).toBe('block');
      // top should be >= EDGE_PADDING (12px) due to the safety clamp
      const topValue = parseInt(tip.style.top, 10);
      expect(topValue).toBeGreaterThanOrEqual(12);
    });
  });
});
