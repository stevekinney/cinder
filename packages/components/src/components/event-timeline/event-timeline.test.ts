/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: EventTimeline } = await import('./event-timeline.svelte');

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
});
