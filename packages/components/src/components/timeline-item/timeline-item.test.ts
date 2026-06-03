/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: TimelineItem } = await import('./timeline-item.svelte');
const { createRawSnippet } = await import('svelte');

function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
  }));
}

const baseProps = {
  datetime: '2026-05-23T10:00:00Z',
  timestamp: '10:00',
  title: 'Created',
};

describe('TimelineItem', () => {
  test('renders an <li> with the component class', () => {
    const { container } = render(TimelineItem, baseProps);
    const root = container.querySelector('li.cinder-timeline-item');
    expect(root).not.toBeNull();
  });

  test('renders the title and a <time> with machine-readable and visible labels', () => {
    const { container } = render(TimelineItem, baseProps);

    const title = container.querySelector('.cinder-timeline-item__title');
    expect(title?.textContent?.trim()).toBe('Created');

    const time = container.querySelector<HTMLTimeElement>('time.cinder-timeline-item__time');
    expect(time?.textContent?.trim()).toBe('10:00');
    expect(time?.getAttribute('datetime')).toBe('2026-05-23T10:00:00Z');
  });

  test('defaults tone to "info" and the connector to "visible"', () => {
    const { container } = render(TimelineItem, baseProps);
    const root = container.querySelector('li.cinder-timeline-item');
    expect(root?.getAttribute('data-cinder-tone')).toBe('info');
    expect(root?.getAttribute('data-cinder-connector-after')).toBe('visible');
  });

  test('reflects the tone and connectorAfter props on data attributes', () => {
    const { container } = render(TimelineItem, {
      ...baseProps,
      tone: 'success' as const,
      connectorAfter: 'hidden' as const,
    });
    const root = container.querySelector('li.cinder-timeline-item');
    expect(root?.getAttribute('data-cinder-tone')).toBe('success');
    expect(root?.getAttribute('data-cinder-connector-after')).toBe('hidden');
  });

  test('renders body content from the children snippet', () => {
    const { container } = render(TimelineItem, {
      ...baseProps,
      children: textSnippet('Workflow started'),
    });
    const body = container.querySelector('.cinder-timeline-item__body');
    expect(body).not.toBeNull();
    expect(body?.textContent).toContain('Workflow started');
  });

  test('omits the body wrapper when no children snippet is provided', () => {
    const { container } = render(TimelineItem, baseProps);
    expect(container.querySelector('.cinder-timeline-item__body')).toBeNull();
  });

  test('renders the decorative marker inside an aria-hidden, inert span', () => {
    const { container } = render(TimelineItem, {
      ...baseProps,
      marker: textSnippet('●'),
    });
    const marker = container.querySelector('.cinder-timeline-item__marker');
    expect(marker).not.toBeNull();
    expect(marker?.getAttribute('aria-hidden')).toBe('true');
    expect(marker?.hasAttribute('inert')).toBe(true);
    expect(marker?.textContent).toContain('●');
  });

  test('renders a native heading at the requested level when groupHeader is set', () => {
    const { container } = render(TimelineItem, {
      ...baseProps,
      groupHeader: 'May 23',
      groupHeaderLevel: 2 as const,
    });
    const heading = container.querySelector('.cinder-timeline__group-header');
    expect(heading).not.toBeNull();
    // Native heading element conveys the level implicitly — no role/aria-level.
    expect(heading?.tagName).toBe('H2');
    expect(heading?.hasAttribute('role')).toBe(false);
    expect(heading?.hasAttribute('aria-level')).toBe(false);
    expect(heading?.textContent?.trim()).toBe('May 23');
  });

  test('omits the group heading when groupHeader is not provided', () => {
    const { container } = render(TimelineItem, baseProps);
    expect(container.querySelector('.cinder-timeline__group-header')).toBeNull();
  });

  test('merges a custom class with the component class', () => {
    const { container } = render(TimelineItem, { ...baseProps, class: 'extra' });
    const root = container.querySelector('li.cinder-timeline-item');
    expect(root?.classList.contains('extra')).toBe(true);
  });
});
