/// <reference lib="dom" />
import { afterEach, describe, expect, mock, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const computePositionSpy = mock(async () => ({
  x: 10,
  y: 20,
  placement: 'bottom-start',
  middlewareData: {},
}));

const autoUpdateTeardown = mock(() => {});
const autoUpdateSpy = mock((_anchor: HTMLElement, _panel: HTMLElement, update: () => void) => {
  update();
  return autoUpdateTeardown;
});

mock.module('@floating-ui/dom', () => ({
  computePosition: computePositionSpy,
  autoUpdate: autoUpdateSpy,
  arrow: () => ({ name: 'arrow', fn: () => ({}) }),
  flip: () => ({ name: 'flip', fn: () => ({}) }),
  shift: () => ({ name: 'shift', fn: () => ({}) }),
  offset: (value: unknown) => ({ name: 'offset', options: value, fn: () => ({}) }),
}));

const { render, fireEvent } = await import('@testing-library/svelte/pure');
const { default: TimePicker } = await import('./time-picker.svelte');
const { default: TimePickerFormFieldFixture } =
  await import('../../test/fixtures/time-picker-form-field-fixture.svelte');
const { default: TimePickerResetFixture } =
  await import('../../test/fixtures/time-picker-reset-fixture.svelte');
const { _resetEscapeStack } = await import('../../_internal/overlay.ts');

afterEach(() => {
  document.body.innerHTML = '';
  computePositionSpy.mockClear();
  autoUpdateSpy.mockClear();
  autoUpdateTeardown.mockClear();
  _resetEscapeStack();
});

async function waitForPopoverFocus(): Promise<void> {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('TimePicker', () => {
  test('renders a time input and toggle button', () => {
    const { container, getByLabelText } = render(TimePicker, {
      id: 'appointment-time',
      label: 'Appointment time',
    });

    expect(container.querySelector('input[type="time"]')).not.toBeNull();
    expect(getByLabelText('Choose time')).not.toBeNull();
  });

  test('commits a valid typed value on blur', async () => {
    let changedValue = '';
    const { container } = render(TimePicker, {
      id: 'appointment-time',
      label: 'Appointment time',
      onchange: (value: string) => {
        changedValue = value;
      },
    });

    const input = container.querySelector('input') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: '09:30' } });
    await fireEvent.blur(input);

    expect(changedValue).toBe('09:30');
    expect(input.value).toBe('09:30');
  });

  test('opens the popover from ArrowDown and moves focus through the hour list', async () => {
    const { container } = render(TimePicker, {
      id: 'appointment-time',
      label: 'Appointment time',
      value: '09:30',
    });

    const input = container.querySelector('input') as HTMLInputElement;
    await fireEvent.keyDown(input, { key: 'ArrowDown' });

    const hourListbox = document.body.querySelector('[aria-label="Hours"]') as HTMLElement;
    expect(hourListbox).not.toBeNull();

    const options = Array.from(hourListbox.querySelectorAll('[role="option"]'));
    const initiallyFocusedOption = options.find(
      (option) => option.getAttribute('tabindex') === '0',
    );
    expect(initiallyFocusedOption).not.toBeUndefined();
    await waitForPopoverFocus();
    expect(document.activeElement).toBe(initiallyFocusedOption ?? null);

    await fireEvent.keyDown(hourListbox, { key: 'ArrowDown' });

    const nextFocusedOption = options.find((option) => option.getAttribute('tabindex') === '0');
    expect(nextFocusedOption).not.toBeUndefined();
    expect(document.activeElement).toBe(nextFocusedOption ?? null);

    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await Promise.resolve();
  });

  test('keeps a valid roving option when the value is between step options', async () => {
    const { getByLabelText } = render(TimePicker, {
      id: 'appointment-time',
      label: 'Appointment time',
      value: '09:07',
      step: 900,
    });

    await fireEvent.click(getByLabelText('Choose time'));
    await waitForPopoverFocus();

    const minuteListbox = document.body.querySelector('[aria-label="Minutes"]') as HTMLElement;
    const tabbableMinuteOptions = Array.from(
      minuteListbox.querySelectorAll('[role="option"][tabindex="0"]'),
    );

    expect(tabbableMinuteOptions).toHaveLength(1);

    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await Promise.resolve();
  });

  test('normalizes popover steps to match the native input step', async () => {
    const { container, getByLabelText } = render(TimePicker, {
      id: 'appointment-time',
      label: 'Appointment time',
      value: '09:30',
      step: 90,
    });

    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.getAttribute('step')).toBe('60');

    await fireEvent.click(getByLabelText('Choose time'));

    const minuteListbox = document.body.querySelector('[aria-label="Minutes"]') as HTMLElement;
    const minuteOptions = Array.from(minuteListbox.querySelectorAll('[role="option"]'));
    expect(minuteOptions.slice(0, 3).map((option) => option.textContent)).toEqual([
      '00',
      '01',
      '02',
    ]);

    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await Promise.resolve();
  });

  test('renders h11 and h24 hour-cycle options accurately', async () => {
    const h11 = render(TimePicker, {
      id: 'h11-time',
      label: 'H11 time',
      value: '00:30',
      hourCycle: 'h11',
    });

    await fireEvent.click(h11.getByLabelText('Choose time'));
    let hourListbox = document.body.querySelector('[aria-label="Hours"]') as HTMLElement;
    expect(
      Array.from(hourListbox.querySelectorAll('[role="option"]'))
        .slice(0, 3)
        .map((option) => option.textContent),
    ).toEqual(['00', '01', '02']);

    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await Promise.resolve();
    h11.unmount();

    const h24 = render(TimePicker, {
      id: 'h24-time',
      label: 'H24 time',
      value: '00:30',
      hourCycle: 'h24',
    });

    await fireEvent.click(h24.getByLabelText('Choose time'));
    hourListbox = document.body.querySelector('[aria-label="Hours"]') as HTMLElement;
    expect(
      Array.from(hourListbox.querySelectorAll('[role="option"]'))
        .slice(-3)
        .map((option) => option.textContent),
    ).toEqual(['22', '23', '24']);

    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await Promise.resolve();
  });

  test('supports seconds and commits popover selections', async () => {
    let changedValue = '';
    const { container, getByLabelText } = render(TimePicker, {
      id: 'appointment-time',
      label: 'Appointment time',
      seconds: true,
      value: '09:30:00',
      onchange: (value: string) => {
        changedValue = value;
      },
    });

    await fireEvent.click(getByLabelText('Choose time'));

    const secondListbox = document.body.querySelector('[aria-label="Seconds"]') as HTMLElement;
    const options = Array.from(secondListbox.querySelectorAll('[role="option"]'));
    const targetOption = options[1] as HTMLElement;

    await fireEvent.click(targetOption);

    expect(changedValue).toBe('09:30:01');
    expect((container.querySelector('input') as HTMLInputElement).value).toBe('09:30:01');

    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await Promise.resolve();
  });

  test('resets to the default value inside a form', async () => {
    const { container } = render(TimePickerResetFixture);

    const input = container.querySelector('input') as HTMLInputElement;
    const form = container.querySelector('form') as HTMLFormElement;
    await fireEvent.input(input, { target: { value: '10:30' } });
    form.dispatchEvent(new Event('reset'));
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(input.value).toBe('09:30');
  });

  test('inherits describedBy and required state from FormField', () => {
    const { container } = render(TimePickerFormFieldFixture);
    const picker = container.querySelector('input') as HTMLInputElement;

    expect(picker.getAttribute('aria-describedby') ?? '').toContain('appointment-time-description');
    expect(picker.required).toBe(true);
  });
});
