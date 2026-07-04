/// <reference lib="dom" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: EventTimeline } = await import('./event-timeline.svelte');

const EVENT_TIMELINE_CSS = readFileSync(join(import.meta.dir, 'event-timeline.css'), 'utf8');

describe('EventTimeline', () => {
  const start = '2026-07-03T00:00:00.000Z';
  const end = '2026-07-04T00:00:00.000Z';

  test('renders events as a named list with proportional positions', () => {
    const { container } = render(EventTimeline, {
      start,
      end,
      now: '2026-07-03T12:00:00.000Z',
      label: 'Next fires',
      items: [
        { at: '2026-07-03T06:00:00.000Z', label: 'Morning', sublabel: '06:00', state: 'done' },
        { at: '2026-07-03T18:00:00.000Z', label: 'Evening', sublabel: '18:00' },
      ],
    });

    const el = container.querySelector('[role="list"]');
    expect(el?.getAttribute('aria-label')).toBe('Next fires');
    expect(el?.textContent).toContain('Morning');
    expect(el?.textContent).toContain('Evening');
    expect(
      [...(el?.children ?? [])].every((child) => child.getAttribute('role') === 'listitem'),
    ).toBe(true);

    const items = [...container.querySelectorAll('[role="listitem"]')];
    expect(items).toHaveLength(2);
    expect(items[0]?.getAttribute('style')).toContain('left: 25%');
    expect(items[0]?.getAttribute('data-cinder-state')).toBe('done');
    expect(items[0]?.getAttribute('aria-label')).toBe('Morning, 06:00, Done');
    expect(items[1]?.getAttribute('style')).toContain('left: 75%');
    expect(items[1]?.getAttribute('data-cinder-state')).toBe('upcoming');
    expect(container.querySelector('.cinder-event-timeline__now')?.getAttribute('style')).toContain(
      'left: 50%',
    );
  });

  test('assigns later lanes to overlapping labels', () => {
    const { container } = render(EventTimeline, {
      start,
      end,
      items: [
        { at: '2026-07-03T06:00:00.000Z', label: 'A' },
        { at: '2026-07-03T06:30:00.000Z', label: 'B' },
        { at: '2026-07-03T07:00:00.000Z', label: 'C', state: 'failed' },
      ],
    });

    const items = [...container.querySelectorAll('[role="listitem"]')];
    expect(items.map((item) => item.getAttribute('data-cinder-lane'))).toEqual(['0', '1', '2']);
    expect(items[2]?.getAttribute('data-cinder-state')).toBe('failed');
  });

  test('allocates additional lanes for dense clusters without reusing the final lane', () => {
    const { container } = render(EventTimeline, {
      start,
      end,
      items: [
        { at: '2026-07-03T06:00:00.000Z', label: 'A' },
        { at: '2026-07-03T06:15:00.000Z', label: 'B' },
        { at: '2026-07-03T06:30:00.000Z', label: 'C' },
        { at: '2026-07-03T06:45:00.000Z', label: 'D' },
      ],
    });

    const items = [...container.querySelectorAll('[role="listitem"]')];
    expect(items.map((item) => item.getAttribute('data-cinder-lane'))).toEqual([
      '0',
      '1',
      '2',
      '3',
    ]);
    expect(
      container.querySelector('.cinder-event-timeline__items')?.getAttribute('style'),
    ).toContain('--_cinder-event-timeline-lane-count: 4');
  });

  test('clamps out-of-range events to the displayed range', () => {
    const { container } = render(EventTimeline, {
      start,
      end,
      ariaLabel: 'Release schedule',
      size: 'sm',
      items: [{ at: '2026-07-05T00:00:00.000Z', label: 'Late' }],
    });

    const el = container.querySelector('[role="list"]');
    const root = container.querySelector('.cinder-event-timeline');
    const item = container.querySelector('[role="listitem"]');
    expect(el?.getAttribute('aria-label')).toBe('Release schedule');
    expect(root?.getAttribute('data-cinder-size')).toBe('sm');
    expect(item?.getAttribute('style')).toContain('left: 100%');
  });

  test('normalizes empty accessible names and keeps list semantics authoritative', () => {
    const { container } = render(EventTimeline, {
      start,
      end,
      label: '   ',
      ariaLabel: '   ',
      role: 'presentation',
      'aria-label': 'Consumer label',
      items: [{ at: '2026-07-03T06:00:00.000Z', label: 'Morning', sublabel: '06:00' }],
    });

    const el = container.querySelector('[role="list"]');
    expect(el?.getAttribute('aria-label')).toBe('Event timeline');
    expect(container.querySelector('.cinder-event-timeline__label')).toBeNull();
  });

  test('renders trimmed visible labels consistently with the accessible name', () => {
    const { container } = render(EventTimeline, {
      start,
      end,
      label: '  Release window  ',
      items: [{ at: '2026-07-03T06:00:00.000Z', label: 'Morning' }],
    });

    const el = container.querySelector('[role="list"]');
    expect(el?.getAttribute('aria-label')).toBe('Release window');
    expect(container.querySelector('.cinder-event-timeline__label')?.textContent).toBe(
      'Release window',
    );
  });

  test('hides now markers outside the displayed range', () => {
    const { container } = render(EventTimeline, {
      start,
      end,
      now: '2026-07-05T00:00:00.000Z',
      items: [{ at: '2026-07-03T06:00:00.000Z', label: 'Morning' }],
    });

    expect(container.querySelector('.cinder-event-timeline__now')).toBeNull();
  });

  test('uses time for timestamp text and stable keys for repeated events', () => {
    const { container } = render(EventTimeline, {
      start,
      end,
      items: [
        { at: '2026-07-03T06:00:00.000Z', label: 'Deploy', sublabel: '06:00' },
        { at: '2026-07-03T06:00:00.000Z', label: 'Deploy', sublabel: '06:00' },
      ],
    });

    const labels = [...container.querySelectorAll('.cinder-event-timeline__item-label')];
    const timestamps = [...container.querySelectorAll('time.cinder-event-timeline__item-sublabel')];
    expect(labels).toHaveLength(2);
    expect(timestamps).toHaveLength(2);
    expect(timestamps[0]?.getAttribute('datetime')).toBe('2026-07-03T06:00:00.000Z');
  });

  test('exposes fallback time and state text to assistive technology', () => {
    const { container } = render(EventTimeline, {
      start,
      end,
      items: [{ at: '2026-07-03T06:00:00.000Z', label: 'Deploy', state: 'failed' }],
    });

    const item = container.querySelector('[role="listitem"]');
    expect(item?.getAttribute('aria-label')).toBe('Deploy, 2026-07-03T06:00:00.000Z, Failed');
    expect(container.querySelector('time.cinder-sr-only')?.getAttribute('datetime')).toBe(
      '2026-07-03T06:00:00.000Z',
    );
    expect(container.querySelector('.cinder-sr-only:last-child')?.textContent).toBe('Failed');
  });

  test('trims sublabels before rendering visual time text', () => {
    const { container } = render(EventTimeline, {
      start,
      end,
      items: [
        { at: '2026-07-03T06:00:00.000Z', label: 'Deploy', sublabel: '  06:00  ' },
        { at: '2026-07-03T07:00:00.000Z', label: 'Verify', sublabel: '   ' },
      ],
    });

    const visibleTimes = [
      ...container.querySelectorAll('time.cinder-event-timeline__item-sublabel'),
    ];
    expect(visibleTimes).toHaveLength(1);
    expect(visibleTimes[0]?.textContent).toBe('06:00');
    expect(container.querySelectorAll('time.cinder-sr-only')).toHaveLength(1);
    expect(container.querySelectorAll('[role="listitem"]')[1]?.getAttribute('aria-label')).toBe(
      'Verify, 2026-07-03T07:00:00.000Z, Upcoming',
    );
  });

  test('marks edge events so CSS can align them inward', () => {
    const { container } = render(EventTimeline, {
      start,
      end,
      items: [
        { at: start, label: 'Start' },
        { at: end, label: 'End' },
      ],
    });

    const items = [...container.querySelectorAll('[role="listitem"]')];
    expect(items[0]?.getAttribute('data-cinder-edge')).toBe('start');
    expect(items[1]?.getAttribute('data-cinder-edge')).toBe('end');
  });

  test('CSS reserves lane height and keeps edge items inside bounds', () => {
    expect(EVENT_TIMELINE_CSS).toContain('block-size: max(');
    expect(EVENT_TIMELINE_CSS).toContain('6rem,');
    expect(EVENT_TIMELINE_CSS).toContain('--_cinder-event-timeline-lane-count');
    expect(EVENT_TIMELINE_CSS).toContain("data-cinder-edge='start'");
    expect(EVENT_TIMELINE_CSS).toContain('transform: translateX(0);');
    expect(EVENT_TIMELINE_CSS).toContain("data-cinder-edge='end'");
    expect(EVENT_TIMELINE_CSS).toContain('transform: translateX(-100%);');
    expect(EVENT_TIMELINE_CSS).toContain('5.25rem,');
  });
});
