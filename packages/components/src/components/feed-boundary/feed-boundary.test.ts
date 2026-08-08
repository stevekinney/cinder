/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: FeedBoundary } = await import('./feed-boundary.svelte');

describe('FeedBoundary', () => {
  test('renders an <li> element with cinder-feed-boundary class', () => {
    const { container } = render(FeedBoundary, {
      props: { label: 'Reconnected — 3 events replayed' },
    });
    const root = container.querySelector('.cinder-feed-boundary');
    expect(root).not.toBeNull();
    expect(root?.tagName).toBe('LI');
  });

  test('content carries role="separator" with the label as its accessible name', () => {
    const { container } = render(FeedBoundary, {
      props: { label: 'Sequence gap — expected 12, received 15' },
    });
    const separator = container.querySelector('[role="separator"]');
    expect(separator).not.toBeNull();
    expect(separator?.getAttribute('aria-label')).toBe('Sequence gap — expected 12, received 15');
    expect(separator?.textContent).toContain('Sequence gap — expected 12, received 15');
  });

  test('renders a <time> element when datetime is provided, falling back to it as the label', () => {
    const { container } = render(FeedBoundary, {
      props: { label: 'Reconnected', datetime: '2026-05-12T14:30:00Z' },
    });
    const time = container.querySelector('time');
    expect(time).not.toBeNull();
    expect(time?.getAttribute('datetime')).toBe('2026-05-12T14:30:00Z');
    expect(time?.textContent?.trim()).toBe('2026-05-12T14:30:00Z');
  });

  test('prefers the human-readable timestamp label inside <time>', () => {
    const { container } = render(FeedBoundary, {
      props: { label: 'Reconnected', datetime: '2026-05-12T14:30:00Z', timestamp: '2m ago' },
    });
    expect(container.querySelector('time')?.textContent?.trim()).toBe('2m ago');
  });

  test('renders a plain span time label when only timestamp is provided', () => {
    const { container } = render(FeedBoundary, {
      props: { label: 'Reconnected', timestamp: '2m ago' },
    });
    expect(container.querySelector('time')).toBeNull();
    const timeLabel = container.querySelector('.cinder-feed-boundary__time');
    expect(timeLabel?.textContent?.trim()).toBe('2m ago');
  });

  test('renders no time label when neither datetime nor timestamp is provided', () => {
    const { container } = render(FeedBoundary, {
      props: { label: 'Reconnected' },
    });
    expect(container.querySelector('.cinder-feed-boundary__time')).toBeNull();
  });

  test('merges a custom class onto the root', () => {
    const { container } = render(FeedBoundary, {
      props: { label: 'Reconnected', class: 'custom-class' },
    });
    const root = container.querySelector('.cinder-feed-boundary');
    expect(root?.classList.contains('custom-class')).toBe(true);
  });
});
