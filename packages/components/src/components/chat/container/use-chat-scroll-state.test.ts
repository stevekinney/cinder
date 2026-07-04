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
