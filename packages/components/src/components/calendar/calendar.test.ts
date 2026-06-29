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
      .filter((button) => button.disabled)
      .map((button) => button.textContent?.trim());

    expect(disabledDays.includes('1')).toBe(true);
    expect(disabledDays.includes('30')).toBe(true);
  });
});
