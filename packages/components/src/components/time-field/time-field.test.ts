/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';
import type { TimeFieldChange } from './time-field.types.ts';

setupHappyDom();

const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
const { tick } = await import('svelte');
const { default: TimeField } = await import('./time-field.svelte');

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

function getInput(container: Element): HTMLInputElement {
  return container.querySelector<HTMLInputElement>('input[type="time"]')!;
}

describe('TimeField', () => {
  test('renders a labelled native time input', () => {
    const { container } = render(TimeField, {
      props: { id: 'reminder', label: 'Reminder time', value: '09:30' },
    });

    expect(container.querySelector('label')?.getAttribute('for')).toBe('reminder');
    expect(getInput(container).value).toBe('09:30');
    expect(getInput(container).step).toBe('60');
  });

  test('does not replace a controlled empty value with defaultValue', () => {
    const { container } = render(TimeField, {
      props: { id: 'reminder', label: 'Reminder time', value: '', defaultValue: '09:30' },
    });

    expect(getInput(container).value).toBe('');
  });

  test('emits a canonical minute value when the input changes', async () => {
    const changes: TimeFieldChange[] = [];
    const { container } = render(TimeField, {
      props: {
        id: 'reminder',
        label: 'Reminder time',
        value: '09:30',
        onchange: (detail: TimeFieldChange) => changes.push(detail),
      },
    });

    await fireEvent.change(getInput(container), { target: { value: '10:45' } });

    expect(changes).toEqual([{ value: '10:45', timezone: undefined }]);
  });

  test('supports second granularity', async () => {
    const changes: TimeFieldChange[] = [];
    const { container } = render(TimeField, {
      props: {
        id: 'reminder',
        label: 'Reminder time',
        granularity: 'second',
        value: '09:30:00',
        onchange: (detail: TimeFieldChange) => changes.push(detail),
      },
    });

    expect(getInput(container).step).toBe('1');
    await fireEvent.change(getInput(container), { target: { value: '10:45:30' } });
    expect(changes[0]?.value).toBe('10:45:30');
  });

  test('wires description, error, invalid, and required state to the time input', () => {
    const { container } = render(TimeField, {
      props: {
        id: 'reminder',
        label: 'Reminder time',
        value: '09:30',
        description: 'Used for reminders.',
        error: 'Choose a valid time.',
        required: true,
      },
    });

    const input = getInput(container);
    expect(input.getAttribute('aria-describedby')).toBe('reminder-description reminder-error');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.required).toBe(true);
    expect(container.querySelector('#reminder-description')?.textContent).toBe(
      'Used for reminders.',
    );
    expect(container.querySelector('#reminder-error')?.textContent).toBe('Choose a valid time.');
    expect(container.querySelector('#reminder-error')?.getAttribute('aria-live')).toBe('polite');
  });

  test('includes consumer descriptions on the time input', () => {
    const { container } = render(TimeField, {
      props: {
        id: 'reminder',
        label: 'Reminder time',
        value: '09:30',
        description: 'Used for reminders.',
        'aria-describedby': 'external-hint',
      },
    });

    expect(getInput(container).getAttribute('aria-describedby')).toBe(
      'external-hint reminder-description',
    );
    expect(container.querySelector('.cinder-time-field')?.getAttribute('aria-describedby')).toBe(
      null,
    );
  });

  test('forwards caller-provided accessible name props to the native time input', () => {
    const { container } = render(TimeField, {
      props: { id: 'reminder', value: '09:30', 'aria-label': 'Reminder time' },
    });

    expect(getInput(container).getAttribute('aria-label')).toBe('Reminder time');
    expect(container.querySelector('.cinder-time-field')?.getAttribute('aria-label')).toBeNull();
  });

  test('disabled state disables both time and timezone controls', () => {
    const { container } = render(TimeField, {
      props: {
        id: 'reminder',
        label: 'Reminder time',
        value: '09:30',
        disabled: true,
        timezones: ['America/Denver', 'UTC'],
      },
    });

    expect(getInput(container).disabled).toBe(true);
    expect(
      container.querySelector<HTMLSelectElement>('.cinder-time-field__timezone')?.disabled,
    ).toBe(true);
  });

  test('readonly state prevents emitted input and timezone changes', async () => {
    const changes: TimeFieldChange[] = [];
    const { container } = render(TimeField, {
      props: {
        id: 'reminder',
        label: 'Reminder time',
        value: '09:30',
        readonly: true,
        timezones: ['America/Denver', 'UTC'],
        onchange: (detail: TimeFieldChange) => changes.push(detail),
      },
    });

    const timezone = container.querySelector<HTMLSelectElement>('.cinder-time-field__timezone')!;
    expect(getInput(container).readOnly).toBe(true);
    expect(timezone.disabled).toBe(true);

    await fireEvent.change(getInput(container), { target: { value: '10:45' } });
    await fireEvent.change(timezone, { target: { value: 'UTC' } });
    expect(changes).toEqual([]);
  });

  test('timezone select updates bindable timezone and emits detail', async () => {
    const changes: TimeFieldChange[] = [];
    const { container } = render(TimeField, {
      props: {
        id: 'reminder',
        label: 'Reminder time',
        value: '09:30',
        timezones: ['America/Denver', 'UTC'],
        onchange: (detail: TimeFieldChange) => changes.push(detail),
      },
    });

    const timezone = container.querySelector<HTMLSelectElement>('.cinder-time-field__timezone')!;
    expect(timezone.value).toBe('America/Denver');
    await fireEvent.change(timezone, { target: { value: 'UTC' } });

    expect(changes[0]).toEqual({ value: '09:30', timezone: 'UTC' });
  });

  test('native form reset restores default value and initial timezone', async () => {
    const changes: TimeFieldChange[] = [];
    const form = document.createElement('form');
    document.body.appendChild(form);
    const { container } = render(TimeField, {
      target: form,
      props: {
        id: 'reminder',
        label: 'Reminder time',
        defaultValue: '09:30',
        timezones: ['America/Denver', 'UTC'],
        onchange: (detail: TimeFieldChange) => changes.push(detail),
      },
    });

    const input = getInput(container);
    const timezone = container.querySelector<HTMLSelectElement>('.cinder-time-field__timezone')!;
    await fireEvent.change(input, { target: { value: '10:45' } });
    await fireEvent.change(timezone, { target: { value: 'UTC' } });
    expect(changes.at(-1)).toEqual({ value: '10:45', timezone: 'UTC' });

    form.dispatchEvent(new Event('reset', { bubbles: true, cancelable: true }));
    await tick();
    const resetTimezone = container.querySelector<HTMLSelectElement>(
      '.cinder-time-field__timezone',
    )!;
    expect(resetTimezone.value).toBe('America/Denver');

    resetTimezone.value = 'UTC';
    await fireEvent.change(resetTimezone);

    expect(changes.at(-1)).toEqual({ value: '09:30', timezone: 'UTC' });
  });

  test('normalizes selected timezone when timezone options appear or change', async () => {
    const view = render(TimeField, {
      props: {
        id: 'reminder',
        label: 'Reminder time',
        value: '09:30',
        timezones: [],
      },
    });
    const { container, rerender } = view;

    await rerender({
      id: 'reminder',
      label: 'Reminder time',
      value: '09:30',
      timezones: ['America/Denver', 'UTC'],
    });

    let timezone = container.querySelector<HTMLSelectElement>('.cinder-time-field__timezone')!;
    expect(timezone.value).toBe('America/Denver');

    await rerender({
      id: 'reminder',
      label: 'Reminder time',
      value: '09:30',
      timezones: ['UTC'],
    });

    timezone = container.querySelector<HTMLSelectElement>('.cinder-time-field__timezone')!;
    expect(timezone.value).toBe('UTC');
  });

  test('submits selected timezone with native forms when name is provided', () => {
    const { container } = render(TimeField, {
      props: {
        id: 'reminder',
        label: 'Reminder time',
        value: '09:30',
        name: 'reminder_time',
        timezones: ['America/Denver', 'UTC'],
        timezone: 'UTC',
      },
    });

    const timezoneInput = container.querySelector<HTMLInputElement>(
      'input[type="hidden"][name="reminder_time-timezone"]',
    );
    expect(timezoneInput?.value).toBe('UTC');
  });

  test('does not render a second period control around the native time input', () => {
    const { container } = render(TimeField, {
      props: { id: 'reminder', label: 'Reminder time', value: '09:30' },
    });

    expect(container.querySelector('.cinder-time-field__period')).toBeNull();
  });
});
