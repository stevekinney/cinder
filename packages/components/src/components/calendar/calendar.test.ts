/// <reference lib="dom" />
import * as matchers from '@testing-library/jest-dom/matchers';
import { afterEach, beforeEach, describe, expect, setSystemTime, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

expect.extend(matchers as Parameters<typeof expect.extend>[0]);
setupHappyDom();

const { render, fireEvent, cleanup } = await import('@testing-library/svelte');
const { tick } = await import('svelte');
const { default: Calendar } = await import('./calendar.svelte');

beforeEach(() => document.body.replaceChildren());
afterEach(() => {
  cleanup();
  setSystemTime();
});

describe('Calendar', () => {
  test('renders a grid with weekday headers', () => {
    const { container } = render(Calendar, { value: '2026-06-29' });
    expect(container.querySelector('[role="grid"]')).not.toBeNull();
    expect(container.querySelectorAll('.cinder-calendar__weekday').length).toBe(7);
  });

  test('anchors an out-of-range value at the violated bound', () => {
    const { container } = render(Calendar, {
      value: '2091-01-01',
      max: '2090-12-31',
    });
    expect(container.querySelector('.cinder-calendar__title')?.textContent).toContain(
      'December 2090',
    );
  });

  test('selects a day and calls onValueChange', async () => {
    let selected: string | undefined;
    const { container } = render(Calendar, {
      month: '2026-06-01',
      onValueChange: (value: string) => {
        selected = value;
      },
    });

    const day = Array.from(
      container.querySelectorAll<HTMLButtonElement>('.cinder-calendar__day'),
    ).find((button) => button.textContent?.trim() === '15' && !button.hasAttribute('data-outside'));
    if (!day) throw new Error('day button missing');
    await fireEvent.click(day);

    expect(selected).toBe('2026-06-15');
  });

  test('range selection commits a start, then an inclusive ordered range', async () => {
    const ranges: Array<{ start: string | undefined; end: string | undefined }> = [];
    const { container, rerender } = render(Calendar, {
      month: '2026-06-01',
      selectionMode: 'range',
      onRangeChange: (range: { start: string | undefined; end: string | undefined }) =>
        ranges.push(range),
    });
    const day = (iso: string) => container.querySelector<HTMLButtonElement>(`[id$="-day-${iso}"]`)!;
    await fireEvent.click(day('2026-06-10'));
    expect(ranges.at(-1)).toEqual({ start: '2026-06-10', end: undefined });
    await rerender({ month: '2026-06-01', selectionMode: 'range', rangeStart: '2026-06-10' });
    await fireEvent.click(day('2026-06-15'));
    expect(ranges.at(-1)).toEqual({ start: '2026-06-10', end: '2026-06-15' });
  });

  test('range selection keeps uncontrolled endpoint state between clicks', async () => {
    const ranges: Array<{ start: string | undefined; end: string | undefined }> = [];
    const { container } = render(Calendar, {
      month: '2026-06-01',
      selectionMode: 'range',
      onRangeChange: (range: { start: string | undefined; end: string | undefined }) =>
        ranges.push(range),
    });
    const day = (iso: string) => container.querySelector<HTMLButtonElement>(`[id$="-day-${iso}"]`)!;

    await fireEvent.click(day('2026-06-10'));
    await fireEvent.click(day('2026-06-15'));

    expect(ranges).toEqual([
      { start: '2026-06-10', end: undefined },
      { start: '2026-06-10', end: '2026-06-15' },
    ]);
    expect(day('2026-06-10').hasAttribute('data-range-start')).toBe(true);
    expect(day('2026-06-15').hasAttribute('data-range-end')).toBe(true);
  });

  test('renders inclusive committed range and hover preview', async () => {
    const { container } = render(Calendar, {
      month: '2026-06-01',
      selectionMode: 'range',
      rangeStart: '2026-06-10',
      rangeEnd: '2026-06-15',
    });
    expect(
      container.querySelector('[id$="-day-2026-06-10"]')?.hasAttribute('data-range-start'),
    ).toBe(true);
    expect(container.querySelector('[id$="-day-2026-06-15"]')?.hasAttribute('data-range-end')).toBe(
      true,
    );
    for (let day = 11; day <= 14; day += 1) {
      expect(
        container.querySelector(`[id$="-day-2026-06-${day}"]`)?.hasAttribute('data-in-range'),
      ).toBe(true);
    }
    const preview = render(Calendar, {
      month: '2026-06-01',
      selectionMode: 'range',
      rangeStart: '2026-06-10',
      rangeHover: '2026-06-13',
    });
    expect(preview.container.querySelectorAll('[data-range-preview]').length).toBeGreaterThan(0);
  });

  test('keeps hover previews visually marked but not aria-selected', async () => {
    const { container } = render(Calendar, {
      month: '2026-06-01',
      selectionMode: 'range',
      rangeStart: '2026-06-10',
    });
    const hoverEndpoint = container.querySelector('[id$="-day-2026-06-13"]')!;

    await fireEvent.mouseEnter(hoverEndpoint);

    expect(hoverEndpoint.hasAttribute('data-range-preview')).toBe(true);
    expect(hoverEndpoint.hasAttribute('data-range-end')).toBe(false);
    expect(hoverEndpoint.parentElement?.getAttribute('aria-selected')).toBeNull();
    expect(
      container
        .querySelector('[id$="-day-2026-06-11"]')
        ?.parentElement?.getAttribute('aria-selected'),
    ).toBeNull();
  });

  test('anchors a standalone range and clears pointer preview on leave', async () => {
    const { container } = render(Calendar, {
      selectionMode: 'range',
      rangeStart: '2026-06-10',
    });
    expect(container.querySelector('.cinder-calendar__title')?.textContent).toContain('June 2026');
    expect(container.querySelector('[role="grid"]')?.getAttribute('aria-multiselectable')).toBe(
      'true',
    );
    await fireEvent.mouseEnter(container.querySelector('[id$="-day-2026-06-13"]')!);
    expect(container.querySelectorAll('[data-range-preview]').length).toBeGreaterThan(0);
    await fireEvent.mouseLeave(container.querySelector('[id$="-day-2026-06-13"]')!);
    expect(container.querySelectorAll('[data-range-preview]')).toHaveLength(0);
    await fireEvent.mouseEnter(container.querySelector('[id$="-day-2026-06-13"]')!);
    expect(container.querySelectorAll('[data-range-preview]').length).toBeGreaterThan(0);
    await fireEvent.mouseLeave(container.querySelector('[role="grid"]')!);
    expect(container.querySelectorAll('[data-range-preview]')).toHaveLength(0);
  });

  test('anchors a completed standalone range to the end endpoint month', () => {
    const { container } = render(Calendar, {
      selectionMode: 'range',
      rangeStart: '2026-06-10',
      rangeEnd: '2026-07-12',
    });

    expect(container.querySelector('.cinder-calendar__title')?.textContent).toContain('July 2026');
  });

  test('marks each committed range date selected', () => {
    const { container } = render(Calendar, {
      selectionMode: 'range',
      rangeStart: '2026-06-10',
      rangeEnd: '2026-06-12',
    });
    for (const iso of ['2026-06-10', '2026-06-11', '2026-06-12']) {
      expect(
        container
          .querySelector(`[id$="-day-${iso}"]`)
          ?.parentElement?.getAttribute('aria-selected'),
      ).toBe('true');
    }
  });

  test('restarts at a new start after a completed range', async () => {
    const ranges: Array<{ start: string | undefined; end: string | undefined }> = [];
    const { container } = render(Calendar, {
      month: '2026-06-01',
      selectionMode: 'range',
      rangeStart: '2026-06-10',
      rangeEnd: '2026-06-15',
      onRangeChange: (range: { start: string | undefined; end: string | undefined }) =>
        ranges.push(range),
    });
    await fireEvent.click(container.querySelector('[id$="-day-2026-06-20"]')!);
    expect(ranges.at(-1)).toEqual({ start: '2026-06-20', end: undefined });
  });

  test('preserves a four-digit year before 1000 when selecting a day', async () => {
    let selected: string | undefined;
    const { container } = render(Calendar, {
      month: '0999-06-01',
      onValueChange: (value: string) => {
        selected = value;
      },
    });

    const day = Array.from(
      container.querySelectorAll<HTMLButtonElement>('.cinder-calendar__day'),
    ).find((button) => button.textContent?.trim() === '15' && !button.hasAttribute('data-outside'));
    if (!day) throw new Error('day button missing');
    await fireEvent.click(day);

    expect(selected).toBe('0999-06-15');
  });

  test('preserves years below 100 without applying the Date constructor offset', async () => {
    let selected: string | undefined;
    const { container } = render(Calendar, {
      month: '0099-06-01',
      onValueChange: (value: string) => {
        selected = value;
      },
    });

    const day = Array.from(
      container.querySelectorAll<HTMLButtonElement>('.cinder-calendar__day'),
    ).find((button) => button.textContent?.trim() === '15' && !button.hasAttribute('data-outside'));
    if (!day) throw new Error('day button missing');
    await fireEvent.click(day);

    expect(selected).toBe('0099-06-15');
  });

  test('disambiguates ISO year zero with an era in visible and accessible labels', () => {
    const { container } = render(Calendar, { value: '0000-06-15' });
    const selected = container.querySelector<HTMLButtonElement>(
      '.cinder-calendar__day[data-selected]',
    );

    expect(container.querySelector('.cinder-calendar__title')?.textContent).toContain('1 BC');
    expect(selected?.getAttribute('aria-label')).toContain('1 BC');
  });

  test('renders the skipped Pacific/Apia civil date when run in that timezone', () => {
    const { container } = render(Calendar, { value: '2011-12-30' });

    expect(container.querySelector('.cinder-calendar__title')?.textContent).toContain(
      'December 2011',
    );
    expect(container.querySelector('[id$="-day-2011-12-30"]')).not.toBeNull();
  });

  test('arrow keys move focus and enter selects the focused date', async () => {
    let selected = '';
    const { container } = render(Calendar, {
      value: '2026-06-15',
      onValueChange: (value: string) => {
        selected = value;
      },
    });

    const focused = container.querySelector<HTMLButtonElement>(
      '.cinder-calendar__day[data-focused]',
    );
    if (!focused) throw new Error('focused day missing');

    await fireEvent.keyDown(container.querySelector('[role="grid"]')!, { key: 'ArrowRight' });
    await fireEvent.keyDown(container.querySelector('[role="grid"]')!, { key: 'Enter' });

    expect(selected).toBe('2026-06-16');
  });

  test('Home and End move focus to the start and end of the focused week', async () => {
    // 2026-06-17 is a Wednesday; with the default firstDayOfWeek=0 (Sunday) the week
    // runs 2026-06-14 (Sun) through 2026-06-20 (Sat).
    const { container } = render(Calendar, { value: '2026-06-17' });
    const grid = container.querySelector('[role="grid"]')!;

    await fireEvent.keyDown(grid, { key: 'Home' });
    let focused = container.querySelector<HTMLButtonElement>('.cinder-calendar__day[data-focused]');
    expect(focused?.id).toContain('2026-06-14');

    await fireEvent.keyDown(grid, { key: 'End' });
    focused = container.querySelector<HTMLButtonElement>('.cinder-calendar__day[data-focused]');
    expect(focused?.id).toContain('2026-06-20');
  });

  test('PageUp moves focus back one month', async () => {
    const { container } = render(Calendar, { value: '2026-06-15' });
    const grid = container.querySelector('[role="grid"]')!;

    await fireEvent.keyDown(grid, { key: 'PageUp' });

    const focused = container.querySelector<HTMLButtonElement>(
      '.cinder-calendar__day[data-focused]',
    );
    expect(focused?.id).toContain('2026-05-15');
    expect(container.querySelector('.cinder-calendar__title')?.textContent).toContain('May 2026');
  });

  test('PageDown moves focus forward one month, clamping the day of month at the target month end', async () => {
    // January 31 has no equivalent in February 2026 (28 days, not a leap year); the
    // focused day must clamp to the last day of the target month, not overflow into March.
    const { container } = render(Calendar, { value: '2026-01-31' });
    const grid = container.querySelector('[role="grid"]')!;

    await fireEvent.keyDown(grid, { key: 'PageDown' });

    const focused = container.querySelector<HTMLButtonElement>(
      '.cinder-calendar__day[data-focused]',
    );
    expect(focused?.id).toContain('2026-02-28');
    expect(container.querySelector('.cinder-calendar__title')?.textContent).toContain(
      'February 2026',
    );
  });

  test('disabledDate marks matching days disabled and blocks selection via click and Enter', async () => {
    let selected: string | undefined;
    const { container } = render(Calendar, {
      month: '2026-06-01',
      disabledDate: (iso: string) => iso === '2026-06-15',
      onValueChange: (value: string) => {
        selected = value;
      },
    });

    const day = Array.from(
      container.querySelectorAll<HTMLButtonElement>('.cinder-calendar__day'),
    ).find((button) => button.textContent?.trim() === '15' && !button.hasAttribute('data-outside'));
    if (!day) throw new Error('day button missing');
    expect(day.getAttribute('aria-disabled')).toBe('true');

    await fireEvent.click(day);
    expect(selected).toBeUndefined();

    // Move DOM focus to the disabled day (as roving-tabindex focus tracking would), then
    // attempt to commit it via the grid's Enter handler.
    await fireEvent.focus(day);
    await fireEvent.keyDown(container.querySelector('[role="grid"]')!, { key: 'Enter' });
    expect(selected).toBeUndefined();
  });

  test('the standalone disabled prop disables every cell and makes the grid a keyboard no-op', async () => {
    let selected: string | undefined;
    const { container } = render(Calendar, {
      value: '2026-06-15',
      disabled: true,
      onValueChange: (value: string) => {
        selected = value;
      },
    });

    const days = container.querySelectorAll<HTMLButtonElement>('.cinder-calendar__day');
    expect(days.length).toBeGreaterThan(0);
    days.forEach((day) => expect(day.getAttribute('aria-disabled')).toBe('true'));

    const focusedBefore = container.querySelector('.cinder-calendar__day[data-focused]');
    await fireEvent.keyDown(container.querySelector('[role="grid"]')!, { key: 'ArrowRight' });
    const focusedAfter = container.querySelector('.cinder-calendar__day[data-focused]');
    expect(focusedAfter?.id).toBe(focusedBefore?.id);

    await fireEvent.click(days[10]!);
    expect(selected).toBeUndefined();
  });

  test('respects min/max constraints as disabled dates', () => {
    const { container } = render(Calendar, {
      month: '2026-06-01',
      min: '2026-06-10',
      max: '2026-06-20',
    });

    const disabledDays = Array.from(
      container.querySelectorAll<HTMLButtonElement>('.cinder-calendar__day'),
    )
      .filter((button) => button.getAttribute('aria-disabled') === 'true')
      .map((button) => button.textContent?.trim());

    expect(disabledDays.includes('1')).toBe(true);
    expect(disabledDays.includes('30')).toBe(true);
  });

  test('rolls aria-current="date" over to the new day past midnight', async () => {
    setSystemTime(new Date(2026, 5, 24, 23, 59, 0));
    const { container } = render(Calendar, { month: '2026-06-01' });

    const before = container.querySelector('[id$="-day-2026-06-24"]');
    expect(before?.getAttribute('aria-current')).toBe('date');

    setSystemTime(new Date(2026, 5, 25, 0, 1, 0));
    document.dispatchEvent(new Event('visibilitychange'));
    await tick();

    const previousDay = container.querySelector('[id$="-day-2026-06-24"]');
    const nextDay = container.querySelector('[id$="-day-2026-06-25"]');
    expect(previousDay?.hasAttribute('aria-current')).toBe(false);
    expect(nextDay?.getAttribute('aria-current')).toBe('date');
  });

  test('todayIso refresh moves only the today marker on an uncontrolled, already-navigated calendar', async () => {
    setSystemTime(new Date(2026, 5, 15));
    const { container } = render(Calendar, {});

    expect(container.querySelector('.cinder-calendar__title')?.textContent).toContain('June 2026');
    expect(container.querySelector('[id$="-day-2026-06-15"]')?.getAttribute('aria-current')).toBe(
      'date',
    );

    const nextButton = container.querySelector<HTMLButtonElement>('[aria-label="Next month"]');
    if (!nextButton) throw new Error('next month button missing');
    await fireEvent.click(nextButton);
    await tick();

    expect(container.querySelector('.cinder-calendar__title')?.textContent).toContain('July 2026');

    setSystemTime(new Date(2026, 5, 16));
    document.dispatchEvent(new Event('visibilitychange'));
    await tick();

    // The navigated-away view must not snap back to today's month...
    expect(container.querySelector('.cinder-calendar__title')?.textContent).toContain('July 2026');

    // ...but the today marker itself must have moved to the new day.
    const prevButton = container.querySelector<HTMLButtonElement>('[aria-label="Previous month"]');
    if (!prevButton) throw new Error('previous month button missing');
    await fireEvent.click(prevButton);
    await tick();

    expect(container.querySelector('[id$="-day-2026-06-15"]')?.hasAttribute('aria-current')).toBe(
      false,
    );
    expect(container.querySelector('[id$="-day-2026-06-16"]')?.getAttribute('aria-current')).toBe(
      'date',
    );
  });

  test.each([
    {
      month: '9999-12-01',
      navigationLabel: 'Next month',
      overflowDay: '1',
    },
    {
      month: '0000-01-01',
      navigationLabel: 'Previous month',
      overflowDay: '31',
    },
  ])(
    'stops navigation and overflow selection at the four-digit year boundary for $month',
    async ({ month, navigationLabel, overflowDay }) => {
      let selected: string | undefined;
      const { container } = render(Calendar, {
        month,
        onValueChange: (value: string) => {
          selected = value;
        },
      });

      const navigation = container.querySelector<HTMLButtonElement>(
        `[aria-label="${navigationLabel}"]`,
      );
      const overflow = Array.from(
        container.querySelectorAll<HTMLButtonElement>('.cinder-calendar__day[data-outside]'),
      ).find((button) => button.textContent?.trim() === overflowDay);

      expect(navigation?.disabled).toBe(true);
      expect(overflow?.getAttribute('aria-disabled')).toBe('true');

      await fireEvent.click(overflow!);
      expect(selected).toBeUndefined();

      await fireEvent.focus(overflow!);
      expect(overflow?.getAttribute('tabindex')).toBe('-1');
      expect(container.querySelectorAll('.cinder-calendar__day[tabindex="0"]')).toHaveLength(1);
    },
  );
});
