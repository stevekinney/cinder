/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: FeedEvent } = await import('./feed-event.svelte');

function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
    setup: () => {},
  }));
}

const iconSnippet = textSnippet('icon-content');
const childrenSnippet = textSnippet('event-content');

const baseProps = {
  datetime: '2026-05-12T14:30:00Z',
  icon: iconSnippet,
  children: childrenSnippet,
  timestamp: '2m ago',
};

describe('FeedEvent', () => {
  test('renders an <li> element with cinder-feed-event class', () => {
    const { container } = render(FeedEvent, { props: baseProps });
    const root = container.querySelector('.cinder-feed-event');
    expect(root).not.toBeNull();
    expect(root?.tagName).toBe('LI');
  });

  test('default variant is icon — sets data-cinder-variant="icon"', () => {
    const { container } = render(FeedEvent, { props: baseProps });
    const root = container.querySelector('.cinder-feed-event');
    expect(root?.getAttribute('data-cinder-variant')).toBe('icon');
  });

  test('variant="minimal" sets data-cinder-variant="minimal"', () => {
    const { container } = render(FeedEvent, {
      props: {
        datetime: '2026-05-12T14:30:00Z',
        variant: 'minimal',
        children: childrenSnippet,
        timestamp: '2m ago',
      },
    });
    const root = container.querySelector('.cinder-feed-event');
    expect(root?.getAttribute('data-cinder-variant')).toBe('minimal');
  });

  test('renders a <time> element with the supplied datetime attribute', () => {
    const { container } = render(FeedEvent, { props: baseProps });
    const time = container.querySelector('time');
    expect(time).not.toBeNull();
    expect(time?.getAttribute('datetime')).toBe('2026-05-12T14:30:00Z');
  });

  test('plain-text timestamp renders inside the <time> element', () => {
    const { container } = render(FeedEvent, { props: baseProps });
    const time = container.querySelector('time.cinder-feed-event-time');
    expect(time).not.toBeNull();
    expect(time?.textContent).toContain('2m ago');
  });

  test('body children render inside .cinder-feed-event-content', () => {
    const { container } = render(FeedEvent, { props: baseProps });
    const content = container.querySelector('.cinder-feed-event-content');
    expect(content).not.toBeNull();
    expect(content?.textContent).toContain('event-content');
  });

  test('omitting the visible label falls back to the raw datetime (SSR-deterministic)', () => {
    const { container } = render(FeedEvent, {
      props: {
        datetime: '2026-05-12T14:30:00Z',
        icon: iconSnippet,
        children: childrenSnippet,
      },
    });
    const time = container.querySelector('time.cinder-feed-event-time');
    // No locale/timezone formatting — the deterministic fallback is the ISO value.
    expect(time?.textContent?.trim()).toBe('2026-05-12T14:30:00Z');
    expect(time?.getAttribute('datetime')).toBe('2026-05-12T14:30:00Z');
  });

  test('timestampLabel snippet takes precedence over the timestamp string', () => {
    const { container } = render(FeedEvent, {
      props: {
        ...baseProps,
        timestamp: 'plain-text-label',
        timestampLabel: textSnippet('rich-label'),
      },
    });
    const time = container.querySelector('time.cinder-feed-event-time');
    expect(time?.textContent).toContain('rich-label');
    expect(time?.textContent).not.toContain('plain-text-label');
  });

  test('an explicit empty timestamp string renders empty, not the datetime fallback', () => {
    // timestamp="" is a deliberate "no visible label" — honor it rather than
    // treating it as omitted and substituting the ISO datetime.
    const { container } = render(FeedEvent, {
      props: {
        datetime: '2026-05-12T14:30:00Z',
        icon: iconSnippet,
        children: childrenSnippet,
        timestamp: '',
      },
    });
    const time = container.querySelector('time.cinder-feed-event-time');
    expect(time?.textContent?.trim()).toBe('');
    expect(time?.getAttribute('datetime')).toBe('2026-05-12T14:30:00Z');
  });

  test('omitting children renders no .cinder-feed-event-content wrapper (no layout gap)', () => {
    const { container } = render(FeedEvent, {
      props: { datetime: '2026-05-12T14:30:00Z', icon: iconSnippet, timestamp: '2m ago' },
    });
    expect(container.querySelector('.cinder-feed-event-content')).toBeNull();
    // The time still renders.
    expect(container.querySelector('time.cinder-feed-event-time')?.textContent).toContain('2m ago');
  });

  test('icon snippet renders inside the rail when variant is icon', () => {
    const { container } = render(FeedEvent, { props: baseProps });
    const rail = container.querySelector('.cinder-feed-event-rail');
    expect(rail).not.toBeNull();
    const iconEl = rail?.querySelector('.cinder-feed-event-icon');
    expect(iconEl).not.toBeNull();
    expect(iconEl?.textContent).toContain('icon-content');
  });

  test('minimal variant renders dot and not icon snippet content', () => {
    const { container } = render(FeedEvent, {
      props: {
        datetime: '2026-05-12T14:30:00Z',
        variant: 'minimal',
        children: childrenSnippet,
        timestamp: '2m ago',
      },
    });
    const rail = container.querySelector('.cinder-feed-event-rail');
    expect(rail?.querySelector('.cinder-feed-event-dot')).not.toBeNull();
    expect(rail?.querySelector('.cinder-feed-event-icon')).toBeNull();
    expect(rail?.textContent?.trim()).toBe('');
  });

  test('rail wrapper has aria-hidden="true"', () => {
    const { container } = render(FeedEvent, { props: baseProps });
    const rail = container.querySelector('.cinder-feed-event-rail');
    expect(rail?.getAttribute('aria-hidden')).toBe('true');
  });

  test('rest attributes pass through to the <li>', () => {
    const { container } = render(FeedEvent, {
      props: { ...baseProps, id: 'event-1', 'data-testid': 'my-event' },
    });
    const root = container.querySelector('.cinder-feed-event');
    expect(root?.getAttribute('id')).toBe('event-1');
    expect(root?.getAttribute('data-testid')).toBe('my-event');
  });

  test('class prop merges with cinder-feed-event', () => {
    const { container } = render(FeedEvent, {
      props: { ...baseProps, class: 'custom-class' },
    });
    const root = container.querySelector('.cinder-feed-event');
    expect(root?.classList.contains('cinder-feed-event')).toBe(true);
    expect(root?.classList.contains('custom-class')).toBe(true);
  });

  test('owned data-cinder-variant wins over consumer-supplied value via rest props', () => {
    const { container } = render(FeedEvent, {
      props: {
        ...baseProps,
        'data-cinder-variant': 'minimal',
      },
    });
    const root = container.querySelector('.cinder-feed-event');
    expect(root?.getAttribute('data-cinder-variant')).toBe('icon');
  });
});
