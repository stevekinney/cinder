/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: RelativeTime } = await import('./relative-time.svelte');
// createRawSnippet must be imported dynamically so Bun's svelte plugin (which patches
// the svelte package to resolve to the client build) applies before this import resolves.
// A top-level static import of 'svelte' resolves to svelte/index-server.js in Bun's
// non-browser environment, making `mount()` throw "not available on the server".
const { createRawSnippet } = await import('svelte');

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

  test.each([new Date('invalid'), 'not-a-date'])('renders invalid dates safely: %s', (date) => {
    const { container } = render(RelativeTime, { date, tick: false });
    const element = container.querySelector('time');
    expect(element?.textContent).toBe('Invalid date');
    expect(element?.hasAttribute('datetime')).toBe(false);
  });
});
