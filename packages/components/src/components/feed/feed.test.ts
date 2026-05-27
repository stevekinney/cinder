/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: Feed } = await import('./feed.svelte');

const emptySnippet = createRawSnippet(() => ({
  render: () => `<span></span>`,
  setup: () => {},
}));

function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
    setup: () => {},
  }));
}

function itemSnippet(labels: string[]) {
  return createRawSnippet(() => ({
    render: () =>
      `<li class="cinder-feed-event"><div class="cinder-feed-event-rail"></div><div class="cinder-feed-event-body">${labels.map((label) => `<span class="item">${label}</span>`).join('')}</div></li>`,
    setup: () => {},
  }));
}

describe('Feed', () => {
  test('renders an <ol> element', () => {
    const { container } = render(Feed, {
      props: { 'aria-label': 'Activity feed', children: emptySnippet },
    });
    const root = container.querySelector('.cinder-feed');
    expect(root).not.toBeNull();
    expect(root?.tagName).toBe('OL');
  });

  test('renders with the supplied aria-label', () => {
    const { container } = render(Feed, {
      props: { 'aria-label': 'Pull request timeline', children: emptySnippet },
    });
    const root = container.querySelector('.cinder-feed');
    expect(root?.getAttribute('aria-label')).toBe('Pull request timeline');
  });

  test('when live is omitted, has neither aria-live nor aria-atomic', () => {
    const { container } = render(Feed, {
      props: { 'aria-label': 'Feed', children: emptySnippet },
    });
    const root = container.querySelector('.cinder-feed');
    expect(root?.hasAttribute('aria-live')).toBe(false);
    expect(root?.hasAttribute('aria-atomic')).toBe(false);
  });

  test('when live is false, has neither aria-live nor aria-atomic', () => {
    const { container } = render(Feed, {
      props: { 'aria-label': 'Feed', live: false, children: emptySnippet },
    });
    const root = container.querySelector('.cinder-feed');
    expect(root?.hasAttribute('aria-live')).toBe(false);
    expect(root?.hasAttribute('aria-atomic')).toBe(false);
  });

  test('when live is true, has aria-live="polite" and aria-atomic="false"', () => {
    const { container } = render(Feed, {
      props: { 'aria-label': 'Feed', live: true, children: emptySnippet },
    });
    const root = container.querySelector('.cinder-feed');
    expect(root?.getAttribute('aria-live')).toBe('polite');
    expect(root?.getAttribute('aria-atomic')).toBe('false');
  });

  test('when live is true, owned aria-live="polite" wins over consumer aria-live="assertive"', () => {
    const { container } = render(Feed, {
      props: {
        'aria-label': 'Feed',
        live: true,
        'aria-live': 'assertive',
        children: emptySnippet,
      },
    });
    const root = container.querySelector('.cinder-feed');
    expect(root?.getAttribute('aria-live')).toBe('polite');
  });

  test('when live is false, consumer aria-live passes through to the DOM', () => {
    const { container } = render(Feed, {
      props: {
        'aria-label': 'Feed',
        live: false,
        'aria-live': 'assertive',
        children: emptySnippet,
      },
    });
    const root = container.querySelector('.cinder-feed');
    expect(root?.getAttribute('aria-live')).toBe('assertive');
  });

  test('children render inside the <ol> in source order', () => {
    const { container } = render(Feed, {
      props: { 'aria-label': 'Feed', children: itemSnippet(['alpha', 'beta', 'gamma']) },
    });
    const root = container.querySelector('ol.cinder-feed');
    expect(root).not.toBeNull();
    const items = root?.querySelectorAll('.item');
    expect(items?.length).toBe(3);
    expect(items?.[0]?.textContent).toBe('alpha');
    expect(items?.[1]?.textContent).toBe('beta');
    expect(items?.[2]?.textContent).toBe('gamma');
  });

  test('rest attributes pass through to the <ol>', () => {
    const { container } = render(Feed, {
      props: {
        'aria-label': 'Feed',
        id: 'my-feed',
        'data-testid': 'activity-feed',
        children: emptySnippet,
      },
    });
    const root = container.querySelector('.cinder-feed');
    expect(root?.getAttribute('id')).toBe('my-feed');
    expect(root?.getAttribute('data-testid')).toBe('activity-feed');
  });

  test('aria-labelledby passes through to the <ol>', () => {
    const { container } = render(Feed, {
      props: { 'aria-labelledby': 'heading-id', children: emptySnippet },
    });
    const root = container.querySelector('.cinder-feed');
    expect(root?.getAttribute('aria-labelledby')).toBe('heading-id');
  });

  test('class prop merges with cinder-feed', () => {
    const { container } = render(Feed, {
      props: { 'aria-label': 'Feed', class: 'my-custom-class', children: emptySnippet },
    });
    const root = container.querySelector('.cinder-feed');
    expect(root?.classList.contains('cinder-feed')).toBe(true);
    expect(root?.classList.contains('my-custom-class')).toBe(true);
  });

  test('children snippet text content renders inside the list', () => {
    const { container } = render(Feed, {
      props: { 'aria-label': 'Feed', children: textSnippet('hello world') },
    });
    const root = container.querySelector('.cinder-feed');
    expect(root?.textContent).toContain('hello world');
  });

  test('feed events render rail elements inside list items', () => {
    const { container } = render(Feed, {
      props: { 'aria-label': 'Feed', children: itemSnippet(['alpha', 'beta']) },
    });
    const events = container.querySelectorAll('.cinder-feed-event');
    expect(events.length).toBe(1);
    for (const event of events) {
      expect(event.querySelector('.cinder-feed-event-rail')).not.toBeNull();
    }
  });

  test('connector geometry derives from a shared rail-size token', async () => {
    const css = await Bun.file(new URL('./feed.css', import.meta.url)).text();
    const eventBlock = css.match(/\.cinder-feed-event\s*\{[^}]*\}/)?.[0] ?? '';
    const railBlock = css.match(/\.cinder-feed-event-rail\s*\{[^}]*\}/)?.[0] ?? '';
    const connectorBlock = css.match(/\.cinder-feed-event::after\s*\{[^}]*\}/)?.[0] ?? '';

    expect(eventBlock).toContain('--cinder-feed-rail-size: var(--cinder-space-6)');
    expect(railBlock).toContain('inline-size: var(--cinder-feed-rail-size)');
    expect(railBlock).toContain('block-size: var(--cinder-feed-rail-size)');
    expect(connectorBlock).toContain('inset-block-start: var(--cinder-feed-rail-size)');
    expect(connectorBlock).toContain('inset-inline-start: calc(var(--cinder-feed-rail-size) / 2)');
    expect(connectorBlock).not.toContain('inset-block-start: var(--cinder-space-6)');
    expect(connectorBlock).not.toContain('inset-inline-start: calc(var(--cinder-space-6) / 2)');
  });
});
