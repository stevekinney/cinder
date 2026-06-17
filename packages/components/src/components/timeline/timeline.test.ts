/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';
import { buildTimelineRenderPlan, parseTimelineDatetime } from './timeline-groups.ts';
import type { TimelineEntry } from './timeline.types.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: Wrapper } = await import('../../test/fixtures/timeline-fixture.svelte');

type TestTimelineEntry = TimelineEntry & { body?: string };

const items: [TestTimelineEntry, TestTimelineEntry] = [
  {
    id: '1',
    title: 'Created',
    datetime: '2026-05-23T10:00:00Z',
    timestamp: '10:00',
    tone: 'info' as const,
    body: 'Workflow started',
  },
  {
    id: '2',
    title: 'Step',
    datetime: '2026-05-23T10:05:00Z',
    timestamp: '10:05',
    tone: 'success' as const,
    body: 'Step ran',
  },
];

describe('Timeline', () => {
  test('renders an ordered list with one item per entry', () => {
    const { container } = render(Wrapper, { items });
    expect(container.querySelector('ol.cinder-timeline')).not.toBeNull();
    const lis = container.querySelectorAll('li.cinder-timeline-item');
    expect(lis.length).toBe(2);
  });

  test('items carry the tone data attribute', () => {
    const { container } = render(Wrapper, { items });
    const lis = Array.from(container.querySelectorAll('li.cinder-timeline-item'));
    expect(lis[0]?.getAttribute('data-cinder-tone')).toBe('info');
    expect(lis[1]?.getAttribute('data-cinder-tone')).toBe('success');
  });

  test('items render time elements with machine-readable and visible labels', () => {
    const { container } = render(Wrapper, { items });
    const titles = Array.from(container.querySelectorAll('.cinder-timeline-item__title'));
    expect(titles.map((t) => t.textContent?.trim())).toEqual(['Created', 'Step']);
    const times = Array.from(container.querySelectorAll('.cinder-timeline-item__time'));
    expect(times.map((t) => t.textContent?.trim())).toEqual(['10:00', '10:05']);
    expect(times.map((t) => t.getAttribute('datetime'))).toEqual([
      '2026-05-23T10:00:00Z',
      '2026-05-23T10:05:00Z',
    ]);
  });

  test('renders per-entry body content through the children snippet', () => {
    const { container } = render(Wrapper, { items });
    const bodies = Array.from(container.querySelectorAll('.cinder-timeline-item__body'));

    expect(bodies.map((body) => body.textContent?.trim())).toEqual([
      'Workflow started',
      'Step ran',
    ]);
  });

  test('renders grouped headers inside event list items', () => {
    const { container } = render(Wrapper, {
      items: [items[0], { ...items[1], id: '2', datetime: '2026-05-24T10:05:00Z' }],
      groupBy: 'day',
    });

    const timeline = container.querySelector('ol.cinder-timeline');
    const directItems = Array.from(timeline?.children ?? []).filter((child) =>
      child.classList.contains('cinder-timeline-item'),
    );
    expect(directItems.length).toBe(2);
    expect(container.querySelectorAll('.cinder-timeline__group-header').length).toBe(2);
    expect(
      Array.from(container.querySelectorAll('.cinder-timeline__group-header')).map((header) =>
        header.textContent?.trim(),
      ),
    ).toEqual(['2026-05-23', '2026-05-24']);
    expect(
      Array.from(container.querySelectorAll('ol.cinder-timeline > .cinder-timeline__group-header'))
        .length,
    ).toBe(0);
  });

  test('renders grouped headers as configurable headings inside event list items', () => {
    const { container } = render(Wrapper, {
      items: [{ ...items[0], groupLabel: 'Launch day' }, items[1]],
      groupBy: 'day',
      groupHeaderLevel: 2,
    });

    const heading = container.querySelector(
      'li.cinder-timeline-item > .cinder-timeline__group-header',
    );
    expect(heading?.textContent?.trim()).toBe('Launch day');
    // Native heading element conveys the level implicitly — no role/aria-level.
    expect(heading?.tagName).toBe('H2');
    expect(heading?.hasAttribute('role')).toBe(false);
    expect(heading?.hasAttribute('aria-level')).toBe(false);
  });

  test('filters role props to preserve ordered-list semantics', () => {
    const { container } = render(Wrapper, { items, role: 'presentation' } as never);
    expect(container.querySelector('ol.cinder-timeline')?.hasAttribute('role')).toBe(false);
  });

  test('sets horizontal orientation attribute', () => {
    const { container } = render(Wrapper, { items, orientation: 'horizontal' });
    expect(
      container.querySelector('ol.cinder-timeline')?.getAttribute('data-cinder-orientation'),
    ).toBe('horizontal');
  });

  test('horizontal timeline ol is keyboard-focusable via tabindex="0"', () => {
    const { container } = render(Wrapper, { items, orientation: 'horizontal' });
    expect(container.querySelector('ol.cinder-timeline')?.getAttribute('tabindex')).toBe('0');
  });

  test('vertical timeline ol does not carry a tabindex', () => {
    const { container } = render(Wrapper, { items, orientation: 'vertical' });
    expect(container.querySelector('ol.cinder-timeline')?.hasAttribute('tabindex')).toBe(false);
  });

  test('keeps marker snippets decorative', () => {
    const { container } = render(Wrapper, { items });
    const marker = container.querySelector('.cinder-timeline-item__marker');
    expect(marker?.getAttribute('aria-hidden')).toBe('true');
    expect(marker?.hasAttribute('inert')).toBe(true);
    expect(container.querySelector('[data-testid="marker-1"]')).not.toBeNull();
  });

  test('applies connector break data from the gap threshold', () => {
    const { container } = render(Wrapper, { items, gapThresholdMinutes: 3 });
    const lis = Array.from(container.querySelectorAll('li.cinder-timeline-item'));
    expect(lis[0]?.getAttribute('data-cinder-connector-after')).toBe('hidden');
    expect(lis[1]?.getAttribute('data-cinder-connector-after')).toBe('hidden');
  });

  test('breaks connectors at group boundaries even without a gap threshold', () => {
    const { container } = render(Wrapper, {
      items: [items[0], { ...items[1], datetime: '2026-05-24T10:05:00Z' }],
      groupBy: 'day',
    });
    const lis = Array.from(container.querySelectorAll('li.cinder-timeline-item'));

    expect(lis[0]?.getAttribute('data-cinder-connector-after')).toBe('hidden');
    expect(lis[1]?.getAttribute('data-cinder-connector-after')).toBe('hidden');
  });

  test('timeline css anchors vertical connectors to the event row for grouped headers', async () => {
    const css = await Bun.file(new URL('./timeline.css', import.meta.url).pathname).text();
    // Collapse whitespace so the assertion tracks the geometric intent, not
    // prettier's line breaks (the multi-term calc wraps across lines).
    const flat = css.replace(/\s+/g, ' ');

    expect(css).toContain('.cinder-timeline-item__event::before');
    expect(css).toContain(
      ".cinder-timeline-item[data-cinder-connector-after='hidden'] .cinder-timeline-item__event::before",
    );
    // The connector's bottom must reach the NEXT marker center: it extends past
    // the event box by the item padding (space-4) PLUS the next marker's
    // margin-top (space-1) PLUS that marker's center-y. Dropping the space-1 term
    // is the off-by-one-token regression that left stub gaps.
    expect(flat).toContain(
      'bottom: calc( -1 * (var(--cinder-space-4) + var(--cinder-space-1) + var(--_cinder-timeline-marker-center-y)) )',
    );
    expect(css).not.toContain('.cinder-timeline-item::before {');
  });

  test('timeline css contains horizontal flow and connector rules', async () => {
    const css = await Bun.file(new URL('./timeline.css', import.meta.url).pathname).text();
    const horizontalBlock = css.match(
      /\.cinder-timeline\[data-cinder-orientation='horizontal'\][\s\S]*?}/,
    )?.[0];

    expect(horizontalBlock).toContain('grid-auto-flow: column');
    expect(horizontalBlock).toContain('grid-auto-columns');
    expect(horizontalBlock).toContain('overflow-x: auto');
    expect(css).toContain(
      ".cinder-timeline[data-cinder-orientation='horizontal'] .cinder-timeline-item__event::before",
    );
    expect(css).toContain('right: calc(-1 * var(--cinder-space-4))');
  });
});

describe('timeline grouping helpers', () => {
  test('accepts deterministic ISO inputs and rejects implementation-sensitive inputs', () => {
    expect(parseTimelineDatetime('2026-05-23')).toBe(Date.parse('2026-05-23'));
    expect(parseTimelineDatetime('2026-05-23T10:00Z')).toBe(Date.parse('2026-05-23T10:00Z'));
    expect(parseTimelineDatetime('2026-05-23T10:00:00-06:00')).toBe(
      Date.parse('2026-05-23T10:00:00-06:00'),
    );
    expect(parseTimelineDatetime('2026/05/23')).toBeUndefined();
    expect(parseTimelineDatetime('2026-05-23T10:00')).toBeUndefined();
  });

  test('groups adjacent entries by UTC day without sorting source order', () => {
    const groups = buildTimelineRenderPlan({
      entries: [
        items[0],
        { ...items[1], id: '2', datetime: '2026-05-24T00:30:00+02:00' },
        { ...items[1], id: '3', datetime: '2026-05-24T03:00:00Z', groupLabel: 'May 24' },
      ],
      groupBy: 'day',
    });

    expect(groups.map((group) => group.label)).toEqual(['2026-05-23', 'May 24']);
    expect(groups.flatMap((group) => group.entries.map((entry) => entry.entry.id))).toEqual([
      '1',
      '2',
      '3',
    ]);
  });

  test('groups by UTC week with configurable week start across year boundaries', () => {
    const groups = buildTimelineRenderPlan({
      entries: [
        { ...items[0], id: '1', datetime: '2027-01-01T12:00:00Z' },
        { ...items[1], id: '2', datetime: '2027-01-03T12:00:00Z' },
      ],
      groupBy: 'week',
      weekStartsOn: 'monday',
    });

    expect(groups.map((group) => group.label)).toEqual(['2026-12-28']);
    expect(groups.length).toBe(1);
  });

  test('groups by UTC week with sunday starts across year boundaries', () => {
    const groups = buildTimelineRenderPlan({
      entries: [
        { ...items[0], id: '1', datetime: '2027-01-01T12:00:00Z' },
        { ...items[1], id: '2', datetime: '2027-01-03T12:00:00Z' },
      ],
      groupBy: 'week',
      weekStartsOn: 'sunday',
    });

    expect(groups.map((group) => group.label)).toEqual(['2026-12-27', '2027-01-03']);
    expect(groups.length).toBe(2);
  });

  test('uses unique keys for non-contiguous repeated groups and separated invalid groups', () => {
    const groups = buildTimelineRenderPlan({
      entries: [
        { ...items[0], id: '1', datetime: '2026-05-23T10:00:00Z' },
        { ...items[1], id: '2', datetime: 'not-a-date' },
        { ...items[1], id: '3', datetime: '2026-05-23T11:00:00Z' },
        { ...items[1], id: '4', datetime: 'still-not-a-date' },
      ],
      groupBy: 'day',
    });

    expect(groups.map((group) => group.label)).toEqual([
      '2026-05-23',
      'Undated',
      '2026-05-23',
      'Undated',
    ]);
    expect(new Set(groups.map((group) => group.key)).size).toBe(groups.length);
  });
});
