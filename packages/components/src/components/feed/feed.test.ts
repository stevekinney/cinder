/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';
import { createRawSnippet, tick } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render, fireEvent } = await import('@testing-library/svelte');
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

// ---------------------------------------------------------------------------
// The log arm (kind="log") — the operator-facing stream that absorbed the
// former EventStreamViewer. Follow-latest scroll *pausing* is exercised via
// the scroll handler here; the auto-scroll-on-growth path needs a real
// ResizeObserver (absent in happy-dom) and is covered by
// packages/testing/tests/feed-log-follow.playwright.ts.
// ---------------------------------------------------------------------------
describe('Feed log arm', () => {
  const logProps = {
    kind: 'log' as const,
    label: 'Deploy events',
    children: emptySnippet,
  };

  test('renders a role="log" viewport with the accessible label, wrapping the .cinder-feed list', () => {
    const { container } = render(Feed, { props: logProps });
    const root = container.querySelector('.cinder-feed-log');
    const viewport = container.querySelector('.cinder-feed-log__viewport');
    expect(root).not.toBeNull();
    expect(viewport?.getAttribute('role')).toBe('log');
    expect(viewport?.getAttribute('aria-label')).toBe('Deploy events');
    expect(viewport?.getAttribute('tabindex')).toBe('0');
    const list = viewport?.querySelector('ol.cinder-feed');
    expect(list).not.toBeNull();
  });

  test('list arm renders no log chrome', () => {
    const { container } = render(Feed, {
      props: { 'aria-label': 'Feed', children: emptySnippet },
    });
    expect(container.querySelector('.cinder-feed-log')).toBeNull();
    expect(container.querySelector('[role="log"]')).toBeNull();
  });

  test('no toolbar renders by default', () => {
    const { container } = render(Feed, { props: logProps });
    expect(container.querySelector('.cinder-feed-log__toolbar')).toBeNull();
  });

  test('connectionState renders the StatusDot toolbar', () => {
    const { container } = render(Feed, {
      props: { ...logProps, connectionState: 'connected' as const },
    });
    const toolbar = container.querySelector('.cinder-feed-log__toolbar');
    expect(toolbar).not.toBeNull();
    expect(toolbar?.getAttribute('role')).toBe('group');
    expect(toolbar?.querySelector('.cinder-status-dot')).not.toBeNull();
  });

  test('consumer toolbar snippet renders at the end of the toolbar row', () => {
    const { container } = render(Feed, {
      props: { ...logProps, toolbar: textSnippet('toolbar-controls') },
    });
    const end = container.querySelector('.cinder-feed-log__toolbar-end');
    expect(end?.textContent).toContain('toolbar-controls');
  });

  test('loading renders the skeleton instead of the entries', () => {
    const { container } = render(Feed, {
      props: { ...logProps, loading: true, children: itemSnippet(['alpha']) },
    });
    expect(container.querySelectorAll('.cinder-feed-log__skeleton').length).toBe(3);
    expect(container.querySelector('ol.cinder-feed')).toBeNull();
    const loadingRegion = container.querySelector('.cinder-feed-log__loading');
    expect(loadingRegion?.getAttribute('role')).toBe('status');
  });

  test('truncated renders the polite truncation notice', () => {
    const { container } = render(Feed, {
      props: { ...logProps, truncated: true },
    });
    const notice = container.querySelector('.cinder-feed-log__truncation-notice');
    expect(notice).not.toBeNull();
    expect(notice?.getAttribute('role')).toBe('status');
    expect(notice?.getAttribute('aria-live')).toBe('polite');
  });

  test('scrolling away from the bottom pauses following and shows the resume control', async () => {
    // Unbound prop: the component's internal bindable state drives the DOM.
    const { container } = render(Feed, {
      props: { ...logProps, followLatest: true },
    });
    const viewport = container.querySelector('.cinder-feed-log__viewport') as HTMLElement;
    expect(viewport).not.toBeNull();

    // Simulate scrolled-away-from-bottom geometry.
    Object.defineProperty(viewport, 'scrollHeight', { value: 400, configurable: true });
    Object.defineProperty(viewport, 'clientHeight', { value: 100, configurable: true });
    viewport.scrollTop = 0;
    await fireEvent.scroll(viewport);
    await tick();

    const root = container.querySelector('.cinder-feed-log');
    expect(root?.hasAttribute('data-cinder-paused')).toBe(true);
    expect(container.querySelector('.cinder-feed-log__resume-button')).not.toBeNull();
  });

  test('binding round-trip: pausing writes followLatest=false back to the parent', async () => {
    let followLatest = true;
    const { container } = render(Feed, {
      props: {
        ...logProps,
        get followLatest() {
          return followLatest;
        },
        set followLatest(value: boolean) {
          followLatest = value;
        },
      },
    });
    const viewport = container.querySelector('.cinder-feed-log__viewport') as HTMLElement;
    Object.defineProperty(viewport, 'scrollHeight', { value: 400, configurable: true });
    Object.defineProperty(viewport, 'clientHeight', { value: 100, configurable: true });
    viewport.scrollTop = 0;
    await fireEvent.scroll(viewport);

    expect(followLatest).toBe(false);
  });

  test('scrolling back to the bottom resumes following', async () => {
    let followLatest = false;
    const { container } = render(Feed, {
      props: {
        ...logProps,
        get followLatest() {
          return followLatest;
        },
        set followLatest(value: boolean) {
          followLatest = value;
        },
      },
    });
    const viewport = container.querySelector('.cinder-feed-log__viewport') as HTMLElement;

    Object.defineProperty(viewport, 'scrollHeight', { value: 400, configurable: true });
    Object.defineProperty(viewport, 'clientHeight', { value: 100, configurable: true });
    viewport.scrollTop = 300; // 400 - 300 - 100 = 0 < 2 → at bottom
    await fireEvent.scroll(viewport);

    expect(followLatest).toBe(true);
  });

  test('the resume control resumes following and scrolls to the bottom', async () => {
    let followLatest = false;
    const { container } = render(Feed, {
      props: {
        ...logProps,
        get followLatest() {
          return followLatest;
        },
        set followLatest(value: boolean) {
          followLatest = value;
        },
      },
    });
    const viewport = container.querySelector('.cinder-feed-log__viewport') as HTMLElement;
    Object.defineProperty(viewport, 'scrollHeight', { value: 400, configurable: true });
    Object.defineProperty(viewport, 'clientHeight', { value: 100, configurable: true });

    const resume = container.querySelector('.cinder-feed-log__resume-button') as HTMLButtonElement;
    expect(resume).not.toBeNull();
    await fireEvent.click(resume);

    expect(followLatest).toBe(true);
    expect(viewport.scrollTop).toBe(400);
  });
});
