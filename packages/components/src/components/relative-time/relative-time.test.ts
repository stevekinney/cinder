/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import { setupHappyDom } from '../../test/happy-dom.ts';
import { renderToServerHtml } from '../../test/server-render.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { cleanup, render } = await import('@testing-library/svelte');
const { default: RelativeTime } = await import('./relative-time.svelte');
// createRawSnippet must be imported dynamically so Bun's svelte plugin (which patches
// the svelte package to resolve to the client build) applies before this import resolves.
// A top-level static import of 'svelte' resolves to svelte/index-server.js in Bun's
// non-browser environment, making `mount()` throw "not available on the server".
const { createRawSnippet } = await import('svelte');

afterEach(cleanup);

/** Creates a Svelte 5 Snippet that renders text content. */
function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
  }));
}

describe('RelativeTime', () => {
  test('renders the cinder-relative-time wrapper with its children', () => {
    const { container } = render(RelativeTime, { children: textSnippet('content') });
    const element = container.querySelector('.cinder-relative-time');
    expect(element).not.toBeNull();
    expect(element?.textContent).toContain('content');
  });

  test('merges a custom class alongside cinder-relative-time', () => {
    const { container } = render(RelativeTime, {
      children: textSnippet('content'),
      class: 'my-custom-class',
    });
    const element = container.querySelector('.cinder-relative-time');
    expect(element?.getAttribute('class')).toContain('cinder-relative-time');
    expect(element?.getAttribute('class')).toContain('my-custom-class');
  });

  test('formats signed past and future deltas with Intl.RelativeTimeFormat', () => {
    const realNow = Date.now;
    Date.now = () => Date.UTC(2026, 0, 2, 12);
    try {
      const past = render(RelativeTime, {
        date: Date.UTC(2026, 0, 2, 11),
        locale: 'en',
        tick: false,
      });
      expect(past.container.querySelector('time')?.textContent).toBe('1 hour ago');
      past.unmount();
      const future = render(RelativeTime, {
        date: Date.UTC(2026, 0, 2, 13),
        locale: 'en',
        tick: false,
      });
      expect(future.container.querySelector('time')?.textContent).toBe('in 1 hour');
    } finally {
      Date.now = realNow;
    }
  });

  test('seeds the initial clock from the current time before mounting', () => {
    const source = readFileSync(new URL('./relative-time.svelte', import.meta.url), 'utf8');

    expect(source).toContain('let now = $state(Date.now());');
    expect(source).not.toContain('let now = $state(initialTimestamp);');
    expect(source).toContain('now = Date.now();');
  });

  test('server-renders dates relative to the current time', async () => {
    const realNow = Date.now;
    Date.now = () => Date.UTC(2026, 0, 2, 12);
    try {
      const html = await renderToServerHtml<{
        date: number;
        locale: string;
        tick: boolean;
      }>(new URL('./relative-time.svelte', import.meta.url).pathname, {
        date: Date.UTC(2026, 0, 1, 12),
        locale: 'en',
        tick: false,
      });
      expect(html).toContain('>yesterday');
      expect(html).not.toContain('>now');
    } finally {
      Date.now = realNow;
    }
  });

  test.each([new Date('invalid'), 'not-a-date'])('renders invalid dates safely: %s', (date) => {
    const { container } = render(RelativeTime, { date, tick: false });
    const element = container.querySelector('time');
    expect(element?.textContent).toBe('Invalid date');
    expect(element?.hasAttribute('datetime')).toBe(false);
  });

  test('shares an adaptive clock across mounted instances', () => {
    const originalSetTimeout = window.setTimeout;
    const originalClearTimeout = window.clearTimeout;
    let timeoutCount = 0;
    const timeoutDelays: number[] = [];
    let clearCount = 0;
    window.setTimeout = ((callback: TimerHandler, delay?: number) => {
      timeoutCount += 1;
      timeoutDelays.push(delay ?? 0);
      return originalSetTimeout(callback, delay);
    }) as typeof window.setTimeout;
    window.clearTimeout = ((timer?: number) => {
      clearCount += 1;
      return originalClearTimeout(timer);
    }) as typeof window.clearTimeout;

    try {
      const oldDate = Date.now() - 2 * 60 * 60 * 1_000;
      const first = render(RelativeTime, { date: oldDate });
      const second = render(RelativeTime, { date: oldDate });
      expect(timeoutCount).toBe(2);
      expect(timeoutDelays.at(-1)).toBeGreaterThan(3_599_000);
      first.unmount();
      expect(clearCount).toBe(2);
      second.unmount();
      expect(clearCount).toBe(3);
    } finally {
      window.setTimeout = originalSetTimeout;
      window.clearTimeout = originalClearTimeout;
    }
  });
});
