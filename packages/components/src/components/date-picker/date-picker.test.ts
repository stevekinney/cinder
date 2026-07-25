/// <reference lib="dom" />
import * as matchers from '@testing-library/jest-dom/matchers';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

expect.extend(matchers as Parameters<typeof expect.extend>[0]);
setupHappyDom();

const { render, fireEvent, waitFor, cleanup } = await import('@testing-library/svelte');
const { default: DatePicker } = await import('./date-picker.svelte');

beforeEach(() => document.body.replaceChildren());
afterEach(() => cleanup());

describe('DatePicker', () => {
  test('renders one custom text input and trigger button', () => {
    const { container } = render(DatePicker, { id: 'dp', value: '2026-06-29' });
    const input = container.querySelector<HTMLInputElement>('#dp');
    expect(input?.type).toBe('text');
    expect(input?.getAttribute('aria-haspopup')).toBeNull();
    expect(container.querySelector('.cinder-date-picker__trigger')).not.toBeNull();
  });

  test('rejects trailing characters in manually entered day values', async () => {
    let nextValue = 'sentinel';
    const { container } = render(DatePicker, {
      id: 'dp',
      value: '2026-06-29',
      onchange: (value: string | undefined) => {
        nextValue = value ?? '';
      },
    });

    await fireEvent.change(container.querySelector<HTMLInputElement>('#dp')!, {
      target: { value: '2026-06-29junk' },
    });

    expect(nextValue).toBe('');
  });

  test('opens calendar popover and selects a date', async () => {
    let nextValue = '';
    const { container } = render(DatePicker, {
      id: 'dp',
      value: '2026-06-10',
      onchange: (value: string | undefined) => {
        nextValue = value ?? '';
      },
    });

    await fireEvent.click(container.querySelector('.cinder-date-picker__trigger')!);
    const day = document.body.querySelector<HTMLButtonElement>('.cinder-calendar__day');
    if (!day) throw new Error('calendar day missing');
    await fireEvent.click(day);

    await waitFor(() => {
      expect(nextValue.length).toBe(10);
    });
  });

  test('renders time input for minute granularity and emits datetime value', async () => {
    let nextValue = '';
    const { container } = render(DatePicker, {
      id: 'dp',
      granularity: 'minute',
      value: '2026-06-29T09:30',
      onchange: (value: string | undefined) => {
        nextValue = value ?? '';
      },
    });

    await fireEvent.click(container.querySelector('.cinder-date-picker__trigger')!);
    const timeInput = document.body.querySelector<HTMLInputElement>(
      '.cinder-date-picker__time-input',
    );
    if (!timeInput) throw new Error('time input missing');
    await fireEvent.change(timeInput, { target: { value: '10:15' } });

    expect(nextValue).toBe('2026-06-29T10:15');
  });
});
