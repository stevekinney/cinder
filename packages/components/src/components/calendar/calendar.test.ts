/// <reference lib="dom" />
import * as matchers from '@testing-library/jest-dom/matchers';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

expect.extend(matchers as Parameters<typeof expect.extend>[0]);
setupHappyDom();

const { render, fireEvent, cleanup } = await import('@testing-library/svelte');
const { default: Calendar } = await import('./calendar.svelte');

beforeEach(() => document.body.replaceChildren());
afterEach(() => cleanup());

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

  test('selects a day and calls onchange', async () => {
    let selected: string | undefined;
    const { container } = render(Calendar, {
      month: '2026-06-01',
      onchange: (value: string) => {
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

  test('preserves a four-digit year before 1000 when selecting a day', async () => {
    let selected: string | undefined;
    const { container } = render(Calendar, {
      month: '0999-06-01',
      onchange: (value: string) => {
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
      onchange: (value: string) => {
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
      onchange: (value: string) => {
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
        onchange: (value: string) => {
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
