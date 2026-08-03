/**
 * Unified custom tooltip system.
 *
 * Replaces native `title` tooltips with a styled card that matches
 * the app's macOS aesthetic.  Works on any element with a `data-tooltip`
 * attribute — set it declaratively in the DOM or dynamically via JS.
 *
 * Features:
 *   - Single floating div on <body> (never clipped by overflow)
 *   - Positioned below the element by default; flips above if no room
 *   - Clamped to #app bounds so it never leaves the application window
 *   - Multi-line: respects \n in the text (white-space: pre-line)
 *   - Cross-browser: uses only standard DOM APIs
 */

let tooltipEl = null;
let hideTimer = null;
let showTimer = null;
let _linkedTarget = null;

const SHOW_DELAY = 400; // ms before tooltip appears (match native feel)
const HIDE_DELAY = 100; // ms grace period before hiding (smooth hover transitions)

/**
 * Guard flag to prevent duplicate document listeners.
 *
 * Unlike `isInitialized` in app.js, this is intentionally NEVER reset.
 * Tooltip listeners are pure delegation — they check DOM state at event
 * time and are harmless across `buildPage()` rebuilds.  The tooltip system
 * should initialize exactly once per page load and persist for the
 * application's lifetime.  No teardown is needed or desired.
 */
let tooltipsInitialized = false;

/**
 * Hide on scroll when a tooltip is visible (tooltip position would be stale).
 * The listener is attached on-demand (only while a tooltip is showing) to
 * avoid firing on every scroll event in the nested scrollable table bodies.
 */
let scrollHideHandler = null;

function attachScrollHide() {
  if (scrollHideHandler) return;
  scrollHideHandler = () => {
    clearTimeout(showTimer);
    hideTooltip();
  };
  document.addEventListener('scroll', scrollHideHandler, true);
}

function detachScrollHide() {
  if (!scrollHideHandler) return;
  document.removeEventListener('scroll', scrollHideHandler, true);
  scrollHideHandler = null;
}

/**
 * Lazily create the single tooltip DOM element on first use.
 */
function ensureTooltipEl() {
  if (tooltipEl) return;
  tooltipEl = document.createElement('div');
  tooltipEl.className = 'custom-tooltip';
  tooltipEl.style.position = 'fixed';
  tooltipEl.style.display = 'none';
  document.body.appendChild(tooltipEl);
}

/**
 * Show the tooltip for the given element.
 * @param {HTMLElement} target  the hovered element with data-tooltip
 */
function showTooltip(target) {
  ensureTooltipEl();
  const text = target.getAttribute('data-tooltip');
  if (!text) {
    hideTooltip();
    return;
  }

  tooltipEl.textContent = text;
  // Assign a unique ID and link the tooltip to the target via
  // aria-describedby so screen readers can access the tooltip text.
  tooltipEl.id = 'custom-tooltip';
  tooltipEl.setAttribute('role', 'tooltip');
  target.setAttribute('aria-describedby', 'custom-tooltip');
  _linkedTarget = target;

  // Temporarily make it visible to measure dimensions
  tooltipEl.style.display = 'block';
  tooltipEl.style.visibility = 'hidden';
  tooltipEl.style.left = '0px';
  tooltipEl.style.top = '0px';

  const tipRect = tooltipEl.getBoundingClientRect();
  let targetRect = target.getBoundingClientRect();
  // If the target has display:contents (e.g. sidebar labels), its rect
  // is zero-size. Fall back to a child input/select for positioning.
  if (targetRect.width === 0 && targetRect.height === 0) {
    const child = target.querySelector('input, select, button');
    if (child) {
      targetRect = child.getBoundingClientRect();
    }
  }
  const appEl = document.getElementById('app');
  const appRect = appEl
    ? appEl.getBoundingClientRect()
    : { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };

  // Gap between element and tooltip
  const GAP = 8;
  // Padding from app edge
  const EDGE_PADDING = 12;

  const tipW = tipRect.width;
  const tipH = tooltipEl.offsetHeight || tipRect.height;

  // --- Horizontal: center on target, clamp within app ---
  let left = targetRect.left + targetRect.width / 2 - tipW / 2;

  // Clamp left edge
  const minLeft = appRect.left + EDGE_PADDING;
  const maxLeft = appRect.right - EDGE_PADDING - tipW;
  if (left < minLeft) left = minLeft;
  if (left > maxLeft) left = maxLeft;

  // --- Vertical: prefer below, flip above if not enough room ---
  const spaceBelow = appRect.bottom - targetRect.bottom;
  const spaceAbove = targetRect.top - appRect.top;

  let top;
  if (spaceBelow >= tipH + GAP || spaceBelow >= spaceAbove) {
    // Place below
    top = targetRect.bottom + GAP;
    // If it overflows app bottom, clamp
    if (top + tipH > appRect.bottom - EDGE_PADDING) {
      top = appRect.bottom - EDGE_PADDING - tipH;
    }
  } else {
    // Place above
    top = targetRect.top - tipH - GAP;
    // If it overflows app top, clamp
    if (top < appRect.top + EDGE_PADDING) {
      top = appRect.top + EDGE_PADDING;
    }
  }

  // Final safety clamp — never let the tooltip go above the app window.
  // This catches edge cases where a tall tooltip clamped from below
  // would otherwise end up above the app.
  if (top < appRect.top + EDGE_PADDING) {
    top = appRect.top + EDGE_PADDING;
  }

  tooltipEl.style.left = `${Math.round(left)}px`;
  tooltipEl.style.top = `${Math.round(top)}px`;
  tooltipEl.style.visibility = 'visible';
  // Attach scroll listener only while a tooltip is visible.
  attachScrollHide();
}

/**
 * Hide the tooltip immediately.
 */
function hideTooltip() {
  if (!tooltipEl) return;
  // Clear the aria-describedby link so screen readers stop referencing
  // the (now hidden) tooltip.  Uses the cached target from showTooltip()
  // instead of a global querySelector.
  if (_linkedTarget) {
    _linkedTarget.removeAttribute('aria-describedby');
    _linkedTarget = null;
  }
  tooltipEl.style.display = 'none';
  // Detach scroll listener — no tooltip to keep in sync.
  detachScrollHide();
}

/**
 * Initialize global tooltip event listeners.
 * Call once on app startup.
 */
export function initTooltips() {
  if (tooltipsInitialized) return; // prevent duplicate listeners
  tooltipsInitialized = true;

  ensureTooltipEl();

  // Use mouseover/mouseout with delegation so dynamically added elements
  // (e.g. table rows, form updates) also get tooltips.
  document.addEventListener('mouseover', (e) => {
    const target = e.target.closest('[data-tooltip]');
    if (!target) return;

    clearTimeout(hideTimer);
    clearTimeout(showTimer);

    showTimer = setTimeout(() => {
      // Suppress tooltip when the element is marked "if-truncated" but the
      // content currently fits (not overflowing).  This lets read-only text
      // spans show a tooltip only when their text is visually clipped.
      if (target.hasAttribute('data-tooltip-if-truncated')) {
        if (target.scrollWidth <= target.clientWidth) return;
      }
      showTooltip(target);
    }, SHOW_DELAY);
  });

  document.addEventListener('mouseout', (e) => {
    const target = e.target.closest('[data-tooltip]');
    if (!target) return;

    // Check if we're moving to a child of the same tooltip target
    const related = e.relatedTarget;
    if (related && target.contains(related)) return;

    clearTimeout(showTimer);
    hideTimer = setTimeout(() => {
      hideTooltip();
    }, HIDE_DELAY);
  });

  // Hide on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      clearTimeout(showTimer);
      hideTooltip();
    }
  });

  // Hide on mousedown — when the user clicks (e.g. a button), dismiss
  // the tooltip immediately since they've taken the action.
  document.addEventListener('mousedown', (e) => {
    if (e.target.closest('[data-tooltip]')) {
      clearTimeout(showTimer);
      hideTooltip();
    }
  });
}
