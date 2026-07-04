/// <reference lib="dom" />
import { afterEach, describe, expect, jest, test } from 'bun:test';
import { tick } from 'svelte';

import { setupHappyDom } from '../test/happy-dom.ts';
import { expectNoLeakedTimers, trackTimers } from '../test/lifecycle.ts';

setupHappyDom();

const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
const { default: AnnouncerWrapper } = await import('./__test-helpers__/announcer-wrapper.svelte');

afterEach(() => {
  jest.useRealTimers();
  cleanup();
  document.body.replaceChildren();
});

function message(container: HTMLElement): string | null {
  return container.querySelector('[aria-live="polite"]')?.getAttribute('data-message') ?? null;
}

describe('useAnnouncer', () => {
  test('sets and auto-clears announcements', async () => {
    jest.useFakeTimers();
    const { container, getByRole } = render(AnnouncerWrapper, {
      props: { clearDelay: 500 },
    });

    await fireEvent.click(getByRole('button', { name: 'announce saved' }));
    expect(message(container)).toBe('');

    jest.advanceTimersByTime(0);
    await tick();
    expect(message(container)).toBe('Saved');

    jest.advanceTimersByTime(500);
    await tick();
    expect(message(container)).toBe('');
  });

  test('debounces rapid announcements and keeps the latest text', async () => {
    jest.useFakeTimers();
    const { container, getByRole } = render(AnnouncerWrapper, {
      props: { debounceMs: 200 },
    });

    await fireEvent.click(getByRole('button', { name: 'announce saved' }));
    jest.advanceTimersByTime(100);
    await fireEvent.click(getByRole('button', { name: 'announce updated' }));
    jest.advanceTimersByTime(199);
    await tick();
    expect(message(container)).toBe('');

    jest.advanceTimersByTime(1);
    jest.advanceTimersByTime(0);
    await tick();
    expect(message(container)).toBe('Updated');
  });

  test('clear cancels pending announcements', async () => {
    jest.useFakeTimers();
    const { container, getByRole } = render(AnnouncerWrapper);

    await fireEvent.click(getByRole('button', { name: 'announce saved' }));
    await fireEvent.click(getByRole('button', { name: 'clear' }));
    jest.advanceTimersByTime(0);
    await tick();

    expect(message(container)).toBe('');
  });

  test('unmounting clears pending announcement timers', async () => {
    const timers = trackTimers();
    try {
      const { getByRole, unmount } = render(AnnouncerWrapper, {
        props: { debounceMs: 10_000, clearDelay: 10_000 },
      });

      await fireEvent.click(getByRole('button', { name: 'announce saved' }));
      unmount();

      expectNoLeakedTimers(timers.active());
    } finally {
      timers.release();
    }
  });
});
