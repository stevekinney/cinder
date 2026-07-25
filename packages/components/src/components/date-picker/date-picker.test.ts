/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

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

  test.each(['2026-06-29junk', '2026-02-31'])(
    'marks malformed empty-model edits invalid: %s',
    async (rawValue) => {
      const { container } = render(DatePicker, {
        id: 'dp',
        value: undefined,
      });
      const input = container.querySelector<HTMLInputElement>('#dp')!;

      await fireEvent.change(input, {
        target: { value: rawValue },
      });

      expect(input.value).toBe(rawValue);
      expect(input.checkValidity()).toBe(false);
    },
  );

  test('marks malformed drafts invalid before change or blur', async () => {
    const { container } = render(DatePicker, {
      id: 'dp',
      value: undefined,
    });
    const input = container.querySelector<HTMLInputElement>('#dp')!;

    await fireEvent.input(input, {
      target: { value: 'not-a-date' },
    });

    expect(input.value).toBe('not-a-date');
    expect(input.checkValidity()).toBe(false);
  });

  test('clears custom validity after a native form reset', async () => {
    const form = document.createElement('form');
    document.body.append(form);
    const { container } = render(DatePicker, {
      target: form,
      props: {
        id: 'dp',
        value: undefined,
      },
    });
    const input = container.querySelector<HTMLInputElement>('#dp')!;

    await fireEvent.change(input, {
      target: { value: 'not-a-date' },
    });
    expect(input.checkValidity()).toBe(false);

    form.reset();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(input.value).toBe('');
    expect(input.checkValidity()).toBe(true);
  });

  test('marks controlled out-of-range values invalid', () => {
    const { container } = render(DatePicker, {
      id: 'dp',
      value: '2026-06-29',
      min: '2026-07-01',
    });

    expect(container.querySelector<HTMLInputElement>('#dp')?.checkValidity()).toBe(false);
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

  test.each([
    {
      bounds: { min: '2090-04-10' },
      expectedMonth: 'April 2090',
    },
    {
      bounds: { max: '2000-03-20' },
      expectedMonth: 'March 2000',
    },
  ])('opens an empty bounded picker at $expectedMonth', async ({ bounds, expectedMonth }) => {
    const { container } = render(DatePicker, {
      id: 'dp',
      value: undefined,
      ...bounds,
    });

    await fireEvent.click(container.querySelector('.cinder-date-picker__trigger')!);

    expect(document.body.querySelector('.cinder-calendar__title')?.textContent).toContain(
      expectedMonth,
    );
  });

  test('moves focus into the custom picker when the trigger opens it', async () => {
    const { container } = render(DatePicker, {
      id: 'dp',
      value: '2026-06-10',
    });

    await fireEvent.click(container.querySelector('.cinder-date-picker__trigger')!);

    await waitFor(() => {
      const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]');
      expect(dialog).not.toBeNull();
      expect(dialog?.contains(document.activeElement)).toBe(true);
    });
  });

  test('renders time input for minute granularity and emits datetime value', async () => {
    let nextValue = '';
    const rendered = render(DatePicker, {
      id: 'dp',
      granularity: 'minute',
      value: '2026-06-29T09:30',
      onchange: (value: string | undefined) => {
        nextValue = value ?? '';
      },
    });
    const { container } = rendered;

    await fireEvent.click(container.querySelector('.cinder-date-picker__trigger')!);
    const timeInput = rendered.getByLabelText('Time') as HTMLInputElement;
    expect(timeInput.classList.contains('cinder-date-picker__time-input')).toBe(true);
    await fireEvent.change(timeInput, { target: { value: '10:15' } });

    expect(nextValue).toBe('2026-06-29T10:15');
  });
});
