/**
 * Tests for use-chat-scroll-state.svelte.ts.
 *
 * Focused on the withForcedLayout backstop timing (private helper, exercised
 * through scrollToBottom): a scroll animation that runs LONGER than the
 * backstop duration must never have data-cinder-force-visible restored out
 * from under it mid-flight — that would re-enable content-visibility:auto on
 * off-screen rows before the scroll settles, reproducing the exact jerk the
 * mechanism exists to prevent.
 */

/// <reference lib="dom" />
import { afterEach, describe, expect, jest, test } from 'bun:test';

import { setupHappyDom } from '../../../test/happy-dom.ts';

setupHappyDom();

const { useChatScrollState } = await import('./use-chat-scroll-state.svelte.ts');

afterEach(() => {
  if (jest.isFakeTimers()) {
    jest.useRealTimers();
  }
  document.body.innerHTML = '';
});

function createViewport(): HTMLElement {
  const viewport = document.createElement('div');
  Object.defineProperty(viewport, 'scrollHeight', { value: 2000, configurable: true });
  Object.defineProperty(viewport, 'scrollTop', { value: 0, writable: true, configurable: true });
  Object.defineProperty(viewport, 'clientHeight', { value: 400, configurable: true });
  // happy-dom doesn't implement scrollTo's layout side effects; a no-op stub
  // is enough since this suite only cares about the force-visible lifecycle.
  viewport.scrollTo = () => {};
  document.body.appendChild(viewport);
  return viewport;
}

describe('useChatScrollState — withForcedLayout backstop', () => {
  test('sets data-cinder-force-visible for the duration of scrollToBottom', () => {
    const state = useChatScrollState();
    const viewport = createViewport();
    state.scrollToBottom(viewport);
    expect(viewport.hasAttribute('data-cinder-force-visible')).toBe(true);
    viewport.dispatchEvent(new Event('scrollend'));
    viewport.remove();
  });

  test('a scrollend event removes data-cinder-force-visible immediately', () => {
    const state = useChatScrollState();
    const viewport = createViewport();
    state.scrollToBottom(viewport);
    viewport.dispatchEvent(new Event('scrollend'));
    expect(viewport.hasAttribute('data-cinder-force-visible')).toBe(false);
    viewport.remove();
  });

  test('repeated scroll ticks past the backstop duration keep it set (no premature restore mid-animation)', () => {
    jest.useFakeTimers();
    const state = useChatScrollState();
    const viewport = createViewport();
    state.scrollToBottom(viewport);

    // Simulate an animation still actively progressing well past the 500ms
    // non-reduced-motion backstop duration: a scroll tick every 90ms for
    // 630ms. Each tick re-arms the backstop before the current arm can fire,
    // so it must never restore the optimization while ticks keep arriving.
    for (let i = 0; i < 7; i++) {
      jest.advanceTimersByTime(90);
      viewport.dispatchEvent(new Event('scroll'));
      expect(viewport.hasAttribute('data-cinder-force-visible')).toBe(true);
    }
  });

  test('once scroll ticks stop arriving, the backstop eventually restores it', () => {
    jest.useFakeTimers();
    const state = useChatScrollState();
    const viewport = createViewport();
    state.scrollToBottom(viewport);
    viewport.dispatchEvent(new Event('scroll'));
    expect(viewport.hasAttribute('data-cinder-force-visible')).toBe(true);

    // No further ticks — the backstop (500ms, non-reduced-motion) should fire.
    jest.advanceTimersByTime(499);
    expect(viewport.hasAttribute('data-cinder-force-visible')).toBe(true);
    jest.advanceTimersByTime(1);
    expect(viewport.hasAttribute('data-cinder-force-visible')).toBe(false);
  });

  test('a zero-distance scroll (already at bottom, no scroll/scrollend events) still restores via the backstop', () => {
    jest.useFakeTimers();
    const state = useChatScrollState();
    const viewport = createViewport();
    state.scrollToBottom(viewport);
    // No events dispatched at all — only the initial backstop arm can save us.
    jest.advanceTimersByTime(499);
    expect(viewport.hasAttribute('data-cinder-force-visible')).toBe(true);
    jest.advanceTimersByTime(1);
    expect(viewport.hasAttribute('data-cinder-force-visible')).toBe(false);
  });

  test('a second scrollToBottom before the first settles cancels the first session (no premature restore from the stale backstop)', () => {
    jest.useFakeTimers();
    // Regression guard: overlapping calls (e.g. a double-click on jump-to-
    // latest, or auto-scroll firing mid-animation) used to leave the OLDER
    // session's listeners/backstop live. When the OLDER session's backstop
    // fired on its own original schedule, it stripped the attribute even
    // though the NEWER session's own (later) backstop hadn't fired yet.
    //
    // No scroll ticks are dispatched here deliberately: re-arming would mask
    // the bug, since (without the fix) a tick re-arms BOTH sessions'
    // listeners identically and neither timer ever gets to fire on its own.
    // This test instead lets each session's timer run to its own deadline
    // untouched, so only the fix (cancelling the older session outright)
    // prevents the stale one from firing.
    const state = useChatScrollState();
    const viewport = createViewport();

    state.scrollToBottom(viewport); // session A: backstop armed for ~500ms from t=0
    jest.advanceTimersByTime(50);
    state.scrollToBottom(viewport); // session B: backstop armed for ~500ms from t=50

    // At t≈520ms: session A's original (500ms) deadline has passed, but
    // session B's (550ms) has not. The attribute must still be present —
    // proving session A's backstop was actually cancelled, not just racing.
    jest.advanceTimersByTime(470);
    expect(viewport.hasAttribute('data-cinder-force-visible')).toBe(true);

    // Session B's own backstop eventually fires and restores it.
    jest.advanceTimersByTime(29);
    expect(viewport.hasAttribute('data-cinder-force-visible')).toBe(true);
    jest.advanceTimersByTime(1);
    expect(viewport.hasAttribute('data-cinder-force-visible')).toBe(false);
  });
});

describe('useChatScrollState — isUserScrolling guard (regression for #774)', () => {
  // #774: the exported `scrollToTop()` (chat.svelte) called
  // `chatVirtualizer.scrollToOffset(0, ...)` directly instead of going through
  // a guard that sets `isUserScrolling`, unlike `jumpToLatest`. The
  // auto-stick-to-bottom `$effect.pre` in chat.svelte skips its correction
  // whenever `isUserScrolling` is true, so any programmatic scroll that
  // doesn't set it gets fought by that effect on every virtualizer
  // remeasurement. These tests pin the guard contract directly.

  test('scrollToTop sets isUserScrolling for the duration of the scroll, then clears it', () => {
    jest.useFakeTimers();
    const state = useChatScrollState();
    const viewport = createViewport();

    expect(state.isUserScrolling).toBe(false);
    state.scrollToTop(viewport);
    expect(state.isUserScrolling).toBe(true);

    jest.advanceTimersByTime(499);
    expect(state.isUserScrolling).toBe(true);
    jest.advanceTimersByTime(1);
    expect(state.isUserScrolling).toBe(false);
  });

  test('withUserScrollGuard sets isUserScrolling around an arbitrary scroll action (the virtualized scrollToOffset path)', () => {
    jest.useFakeTimers();
    const state = useChatScrollState();
    let called = false;

    expect(state.isUserScrolling).toBe(false);
    state.withUserScrollGuard(() => {
      // Runs synchronously inside the guard, mirroring
      // `chatVirtualizer.scrollToOffset(0, ...)` in chat.svelte.
      called = true;
      expect(state.isUserScrolling).toBe(true);
    });
    expect(called).toBe(true);
    expect(state.isUserScrolling).toBe(true);

    jest.advanceTimersByTime(500);
    expect(state.isUserScrolling).toBe(false);
  });

  test('withUserScrollGuard uses the shorter reduced-motion duration when the user prefers reduced motion', () => {
    jest.useFakeTimers();
    const originalMatchMedia = window.matchMedia;
    // Stub matchMedia so `prefers-reduced-motion: reduce` reports as active —
    // happy-dom's real matchMedia always reports `matches: false`, which is
    // why this branch needs an explicit stub rather than relying on the
    // environment default (used by the 500ms test above).
    window.matchMedia = ((query: string) =>
      ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        // Legacy MediaQueryList API — included alongside the modern
        // addEventListener/removeEventListener pair in case the Svelte
        // MediaQuery build in use prefers it.
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => true,
      }) as unknown as MediaQueryList) as typeof window.matchMedia;

    try {
      const state = useChatScrollState();
      state.withUserScrollGuard(() => {});
      expect(state.isUserScrolling).toBe(true);

      jest.advanceTimersByTime(49);
      expect(state.isUserScrolling).toBe(true);
      jest.advanceTimersByTime(1);
      expect(state.isUserScrolling).toBe(false);
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  test('isUserScrolling never gets stuck true across repeated guarded scrolls', () => {
    jest.useFakeTimers();
    const state = useChatScrollState();
    const viewport = createViewport();

    state.scrollToTop(viewport);
    jest.advanceTimersByTime(500);
    expect(state.isUserScrolling).toBe(false);

    // A second, independent guarded scroll must also resolve back to false —
    // proving the flag resets on its own timer rather than requiring some
    // other code path to clear it.
    state.withUserScrollGuard(() => {});
    expect(state.isUserScrolling).toBe(true);
    jest.advanceTimersByTime(500);
    expect(state.isUserScrolling).toBe(false);
  });

  test('a second overlapping guarded scroll cancels the first, so the first timer cannot clear isUserScrolling early', () => {
    // Regression guard: two guarded scrolls close together (e.g. two quick
    // Home presses, or scrollToTop() called twice) used to leave the OLDER
    // session's timer live. When it fired on its own (earlier) schedule, it
    // flipped isUserScrolling back to false while the NEWER scroll's
    // animation was still in progress — reintroducing the auto-stick-to-
    // bottom race this guard exists to prevent.
    jest.useFakeTimers();
    const state = useChatScrollState();

    state.withUserScrollGuard(() => {}); // session A: timer armed for ~500ms from t=0
    jest.advanceTimersByTime(50);
    state.withUserScrollGuard(() => {}); // session B: timer armed for ~500ms from t=50

    // At t≈520ms: session A's original (500ms) deadline has passed, but
    // session B's (550ms) has not. isUserScrolling must still be true —
    // proving session A's timer was actually cancelled, not just racing.
    jest.advanceTimersByTime(470);
    expect(state.isUserScrolling).toBe(true);

    // Session B's own timer eventually fires and clears it.
    jest.advanceTimersByTime(29);
    expect(state.isUserScrolling).toBe(true);
    jest.advanceTimersByTime(1);
    expect(state.isUserScrolling).toBe(false);
  });
});
