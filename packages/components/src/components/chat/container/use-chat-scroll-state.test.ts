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
import { waitFor } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../../test/happy-dom.ts';

setupHappyDom();

const { useChatScrollState } = await import('./use-chat-scroll-state.svelte.ts');

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

  test('repeated scroll ticks past the backstop duration keep it set (no premature restore mid-animation)', async () => {
    const state = useChatScrollState();
    const viewport = createViewport();
    state.scrollToBottom(viewport);

    // Simulate an animation still actively progressing well past the 500ms
    // non-reduced-motion backstop duration: a scroll tick every 100ms for
    // 700ms. Each tick re-arms the backstop, so it must never fire while
    // ticks keep arriving.
    for (let i = 0; i < 7; i++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      viewport.dispatchEvent(new Event('scroll'));
      expect(viewport.hasAttribute('data-cinder-force-visible')).toBe(true);
    }
    viewport.remove();
  });

  test('once scroll ticks stop arriving, the backstop eventually restores it', async () => {
    const state = useChatScrollState();
    const viewport = createViewport();
    state.scrollToBottom(viewport);
    viewport.dispatchEvent(new Event('scroll'));
    expect(viewport.hasAttribute('data-cinder-force-visible')).toBe(true);

    // No further ticks — the backstop (500ms, non-reduced-motion) should fire.
    await waitFor(() => expect(viewport.hasAttribute('data-cinder-force-visible')).toBe(false), {
      timeout: 2000,
    });
    viewport.remove();
  });

  test('a zero-distance scroll (already at bottom, no scroll/scrollend events) still restores via the backstop', async () => {
    const state = useChatScrollState();
    const viewport = createViewport();
    state.scrollToBottom(viewport);
    // No events dispatched at all — only the initial backstop arm can save us.
    await waitFor(() => expect(viewport.hasAttribute('data-cinder-force-visible')).toBe(false), {
      timeout: 2000,
    });
    viewport.remove();
  });
});
