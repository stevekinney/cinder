/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { injectStrippedStyles } from '../../test/css.ts';
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

  test('forwards arbitrary root attributes to the field wrapper, not the inner control row', () => {
    const { container } = render(DatePicker, {
      id: 'dp',
      value: '2026-06-29',
      title: 'Pick a date',
    });
    const root = container.querySelector('.cinder-date-picker');
    expect(root?.getAttribute('title')).toBe('Pick a date');
    expect(container.querySelector('.cinder-date-picker__control')?.hasAttribute('title')).toBe(
      false,
    );
  });

  test('rejects trailing characters in manually entered day values', async () => {
    let nextValue = 'sentinel';
    const { container } = render(DatePicker, {
      id: 'dp',
      value: '2026-06-29',
      onValueChange: (value: string | undefined) => {
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

  test('commits a complete valid draft during input', async () => {
    let nextValue = '';
    const { container } = render(DatePicker, {
      id: 'dp',
      value: '2026-06-29',
      onValueChange: (value: string | undefined) => {
        nextValue = value ?? '';
      },
    });
    await fireEvent.input(container.querySelector<HTMLInputElement>('#dp')!, {
      target: { value: '2026-07-01' },
    });
    expect(nextValue).toBe('2026-07-01');
  });

  test('does not emit when a valid draft restores the committed value', async () => {
    const values: Array<string | undefined> = [];
    const { container } = render(DatePicker, {
      id: 'dp',
      value: '2026-06-29',
      onValueChange: (value: string | undefined) => values.push(value),
    });
    const input = container.querySelector<HTMLInputElement>('#dp')!;

    await fireEvent.input(input, { target: { value: '2026-06-2' } });
    await fireEvent.input(input, { target: { value: '2026-06-29' } });

    expect(values).toEqual([]);
  });

  test('commits clearing the field during input and does not duplicate on blur', async () => {
    const values: Array<string | undefined> = [];
    const { container } = render(DatePicker, {
      id: 'dp',
      value: '2026-06-29',
      onValueChange: (value: string | undefined) => values.push(value),
    });
    const input = container.querySelector<HTMLInputElement>('#dp')!;
    await fireEvent.input(input, { target: { value: '' } });
    expect(values).toStrictEqual([undefined]);
    await fireEvent.change(input, { target: { value: '' } });
    expect(values).toStrictEqual([undefined]);
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
      onValueChange: (value: string | undefined) => {
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
      expect(document.activeElement?.classList.contains('cinder-calendar__day')).toBe(true);
      expect(document.activeElement?.getAttribute('aria-label')).toContain('June 10, 2026');
    });
  });

  test('disabled disables the input and trigger and blocks opening the popover', async () => {
    const { container } = render(DatePicker, {
      id: 'dp',
      value: '2026-06-29',
      disabled: true,
    });
    const input = container.querySelector<HTMLInputElement>('#dp');
    const trigger = container.querySelector<HTMLButtonElement>('.cinder-date-picker__trigger');
    expect(input?.disabled).toBe(true);
    expect(trigger?.disabled).toBe(true);

    await fireEvent.click(trigger as HTMLButtonElement);

    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
  });

  test('description renders a linked paragraph included in the input aria-describedby', () => {
    const { container } = render(DatePicker, {
      id: 'dp',
      value: '2026-06-29',
      description: 'Use ISO format.',
    });
    const description = container.querySelector('#dp-description');
    const input = container.querySelector<HTMLInputElement>('#dp');
    expect(description?.textContent).toBe('Use ISO format.');
    expect(input?.getAttribute('aria-describedby')?.split(' ')).toContain('dp-description');
  });

  test('error renders a linked paragraph included in the input aria-describedby', () => {
    const { container } = render(DatePicker, {
      id: 'dp',
      value: '2026-06-29',
      error: 'Date is required.',
    });
    const error = container.querySelector('#dp-error');
    const input = container.querySelector<HTMLInputElement>('#dp');
    expect(error?.textContent).toBe('Date is required.');
    expect(input?.getAttribute('aria-describedby')?.split(' ')).toContain('dp-error');
  });

  test('renders time input for minute granularity and emits datetime value', async () => {
    let nextValue = '';
    const rendered = render(DatePicker, {
      id: 'dp',
      granularity: 'minute',
      value: '2026-06-29T09:30',
      onValueChange: (value: string | undefined) => {
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

  test('an out-of-range value at mount fires onValueChange once with the clamped/normalized value', () => {
    const values: Array<string | undefined> = [];
    render(DatePicker, {
      id: 'dp',
      value: '2026-02-30',
      onValueChange: (value: string | undefined) => values.push(value),
    });

    // '2026-02-30' is not a valid date (Feb has 28 days in 2026) — normalizeValue
    // rejects it to undefined, and the mount-time normalization effect must now
    // notify onValueChange about that correction instead of silently rewriting `value`.
    expect(values).toStrictEqual([undefined]);
  });

  test('changing granularity on an already-mounted instance truncates the value and fires onValueChange', async () => {
    const values: Array<string | undefined> = [];
    const { rerender } = render(DatePicker, {
      id: 'dp',
      granularity: 'minute',
      value: '2026-06-29T09:30',
      onValueChange: (value: string | undefined) => values.push(value),
    });

    await rerender({
      id: 'dp',
      granularity: 'day',
      value: '2026-06-29T09:30',
      onValueChange: (value: string | undefined) => values.push(value),
    });

    expect(values).toEqual(['2026-06-29']);
  });

  test('renders a calendar icon while keeping the action in the accessible name', () => {
    const { container } = render(DatePicker, { id: 'dp', value: '2026-06-29' });
    const trigger = container.querySelector('.cinder-date-picker__trigger');
    expect(trigger?.textContent?.trim()).toBe('');
    expect(trigger?.querySelector('svg')).not.toBeNull();
    expect(trigger?.getAttribute('aria-label')).toBe('Open date picker');
  });

  test('the error live region is mounted before any error is set (CIN-315: FormFieldFrame defaults to errorMountedOnDemand=false)', () => {
    const { container } = render(DatePicker, { id: 'dp-no-error', value: '2026-06-29' });
    expect(container.querySelector('.cinder-date-picker__error')).not.toBeNull();
  });

  test('the errorless live region has no layout footprint (shared _form-field-error.css, CIN-315 follow-up)', async () => {
    const datePickerCss = await Bun.file(new URL('./date-picker.css', import.meta.url)).text();
    const sharedErrorCss = await Bun.file(
      new URL('../../styles/components/_form-field-error.css', import.meta.url),
    ).text();
    const removeStyles = injectStrippedStyles(datePickerCss, sharedErrorCss);
    try {
      const { container } = render(DatePicker, {
        id: 'dp-no-error-computed',
        value: '2026-06-29',
      });
      const errorRegion = container.querySelector('.cinder-date-picker__error');
      const computed = getComputedStyle(errorRegion as Element);
      expect(computed.position).toBe('absolute');
      expect(computed.visibility).toBe('hidden');
    } finally {
      removeStyles();
    }
  });
});
