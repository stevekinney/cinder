/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { cleanup, render } = await import('@testing-library/svelte');
const { default: ConnectionIndicator } = await import('./connection-indicator.svelte');
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

const ALL_STATUSES = ['connecting', 'live', 'reconnecting', 'polling', 'stale', 'closed'] as const;

describe('ConnectionIndicator', () => {
  afterEach(() => {
    cleanup();
    document.body.replaceChildren();
  });

  test.each(ALL_STATUSES.map((status) => [status] as const))(
    'renders the cinder-connection-indicator root for status "%s"',
    (status) => {
      const { container } = render(ConnectionIndicator, { status });
      const root = container.querySelector('.cinder-connection-indicator');
      expect(root).not.toBeNull();
      expect(root?.getAttribute('data-cinder-status')).toBe(status);
    },
  );

  test.each([
    ['connecting', 'Connecting'],
    ['live', 'Live'],
    ['reconnecting', 'Reconnecting'],
    ['polling', 'Polling'],
    ['stale', 'Stale'],
    ['closed', 'Closed'],
  ] as const)('status "%s" renders the label "%s"', (status, expectedLabel) => {
    const { container } = render(ConnectionIndicator, { status });
    const label = container.querySelector('.cinder-connection-indicator__label');
    expect(label?.textContent?.trim()).toBe(expectedLabel);
  });

  test('each status renders a distinct icon', () => {
    const seenIconMarkup = new Set<string>();

    for (const status of ALL_STATUSES) {
      const { container } = render(ConnectionIndicator, { status });
      const icon = container.querySelector('.cinder-connection-indicator__icon svg');
      expect(icon).not.toBeNull();
      const markup = icon?.outerHTML ?? '';
      expect(seenIconMarkup.has(markup)).toBe(false);
      seenIconMarkup.add(markup);
      cleanup();
    }
  });

  test('root has role="status" with a computed accessible name', () => {
    const { container } = render(ConnectionIndicator, { status: 'live' });
    const root = container.querySelector('.cinder-connection-indicator');
    expect(root?.getAttribute('role')).toBe('status');
    expect(root?.getAttribute('aria-live')).toBe('polite');
    expect(root?.getAttribute('aria-atomic')).toBe('true');
    expect(root?.getAttribute('aria-label')).toBe('Connection: Live');
  });

  test('a custom label overrides the visible text and the accessible name', () => {
    const { container } = render(ConnectionIndicator, {
      status: 'stale',
      label: 'Data may be out of date',
    });
    const root = container.querySelector('.cinder-connection-indicator');
    const label = container.querySelector('.cinder-connection-indicator__label');
    expect(label?.textContent?.trim()).toBe('Data may be out of date');
    expect(root?.getAttribute('aria-label')).toBe('Connection: Data may be out of date');
  });

  test('an explicit aria-label wins over the computed accessible name', () => {
    const { container } = render(ConnectionIndicator, {
      status: 'live',
      'aria-label': 'Realtime feed connected',
    });
    const root = container.querySelector('.cinder-connection-indicator');
    expect(root?.getAttribute('aria-label')).toBe('Realtime feed connected');
  });

  test('live renders a pulsing dot element', () => {
    const { container } = render(ConnectionIndicator, { status: 'live' });
    const dot = container.querySelector('.cinder-connection-indicator__dot');
    expect(dot).not.toBeNull();
    expect(dot?.getAttribute('aria-hidden')).toBe('true');
  });

  test('non-live statuses do not render the pulsing dot', () => {
    for (const status of ALL_STATUSES.filter((value) => value !== 'live')) {
      const { container } = render(ConnectionIndicator, { status });
      expect(container.querySelector('.cinder-connection-indicator__dot')).toBeNull();
      cleanup();
    }
  });

  test('reconnecting renders the attempt snippet content', () => {
    const { container } = render(ConnectionIndicator, {
      status: 'reconnecting',
      attempt: textSnippet('attempt 3 of 5'),
    });
    const attemptEl = container.querySelector('.cinder-connection-indicator__attempt');
    expect(attemptEl).not.toBeNull();
    expect(attemptEl?.textContent).toContain('attempt 3 of 5');
  });

  test('the attempt snippet is ignored for non-reconnecting statuses', () => {
    const { container } = render(ConnectionIndicator, {
      status: 'live',
      attempt: textSnippet('attempt 3 of 5'),
    });
    expect(container.querySelector('.cinder-connection-indicator__attempt')).toBeNull();
  });

  test('reconnecting without an attempt snippet renders no attempt element', () => {
    const { container } = render(ConnectionIndicator, { status: 'reconnecting' });
    expect(container.querySelector('.cinder-connection-indicator__attempt')).toBeNull();
  });

  test('polling differs from live in icon, label, and data-cinder-status', () => {
    const { container: liveContainer } = render(ConnectionIndicator, { status: 'live' });
    const liveIcon = liveContainer.querySelector(
      '.cinder-connection-indicator__icon svg',
    )?.outerHTML;
    const liveLabel = liveContainer
      .querySelector('.cinder-connection-indicator__label')
      ?.textContent?.trim();
    cleanup();

    const { container: pollingContainer } = render(ConnectionIndicator, { status: 'polling' });
    const pollingIcon = pollingContainer.querySelector(
      '.cinder-connection-indicator__icon svg',
    )?.outerHTML;
    const pollingLabel = pollingContainer
      .querySelector('.cinder-connection-indicator__label')
      ?.textContent?.trim();
    const pollingRoot = pollingContainer.querySelector('.cinder-connection-indicator');

    expect(pollingIcon).not.toBe(liveIcon);
    expect(pollingLabel).not.toBe(liveLabel);
    expect(pollingRoot?.getAttribute('data-cinder-status')).toBe('polling');
    expect(pollingContainer.querySelector('.cinder-connection-indicator__dot')).toBeNull();
  });

  test('merges a custom class alongside cinder-connection-indicator', () => {
    const { container } = render(ConnectionIndicator, {
      status: 'live',
      class: 'my-custom-class',
    });
    const element = container.querySelector('.cinder-connection-indicator');
    expect(element?.getAttribute('class')).toContain('cinder-connection-indicator');
    expect(element?.getAttribute('class')).toContain('my-custom-class');
  });

  test('rest props are spread onto the root element', () => {
    const { container } = render(ConnectionIndicator, {
      status: 'live',
      id: 'my-connection-indicator',
    });
    expect(container.querySelector('#my-connection-indicator')).not.toBeNull();
  });
});
