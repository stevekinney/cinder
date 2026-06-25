/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';
import type { TimeFieldChange } from './time-field.types.ts';

setupHappyDom();

const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
const { tick } = await import('svelte');
const { default: TimeField } = await import('./time-field.svelte');
const { default: TimeFieldFormFieldFixture } =
  await import('../../test/fixtures/time-field-form-field-fixture.svelte');

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

function getInput(container: Element): HTMLInputElement {
  return container.querySelector<HTMLInputElement>('input[type="time"]')!;
}

function textForLabelledBy(container: Element, labelledBy: string): string {
  return labelledBy
    .split(/\s+/)
    .map((id) => container.ownerDocument.getElementById(id)?.textContent?.trim() ?? '')
    .filter(Boolean)
    .join(' ');
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

  test('emits an empty value instead of non-canonical time input', async () => {
    const changes: TimeFieldChange[] = [];
    const { container } = render(TimeField, {
      props: {
        id: 'reminder',
        value: '09:30',
        onchange: (detail: TimeFieldChange) => changes.push(detail),
      },
    });

    await fireEvent.change(getInput(container), { target: { value: 'not-a-time' } });

    expect(changes).toEqual([{ value: '', timezone: undefined }]);
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
      'reminder-description external-hint',
    );
    expect(container.querySelector('.cinder-time-field')?.getAttribute('aria-describedby')).toBe(
      null,
    );
  });

  test('wires descriptions to the timezone select', () => {
    const { container } = render(TimeField, {
      props: {
        id: 'reminder',
        value: '09:30',
        timezones: ['UTC', 'Europe/Berlin'],
        description: 'Used for reminders.',
        'aria-describedby': 'external-hint',
      },
    });

    expect(container.querySelector('select')?.getAttribute('aria-describedby')).toBe(
      'reminder-description external-hint',
    );
  });

  test('qualifies timezone select accessible name with the field label', () => {
    const { container } = render(TimeField, {
      props: {
        id: 'reminder',
        label: 'Reminder time',
        value: '09:30',
        timezones: ['UTC', 'Europe/Berlin'],
      },
    });

    const timezone = container.querySelector<HTMLSelectElement>('.cinder-time-field__timezone')!;
    const labelledBy = timezone.getAttribute('aria-labelledby');
    expect(labelledBy).not.toBeNull();
    expect(timezone.getAttribute('aria-label')).toBeNull();
    expect(textForLabelledBy(container, labelledBy!)).toBe('Reminder time timezone');
  });

  test('keeps a generic timezone select label when no field label is available', () => {
    const { container } = render(TimeField, {
      props: {
        id: 'reminder',
        value: '09:30',
        timezones: ['UTC', 'Europe/Berlin'],
      },
    });

    const timezone = container.querySelector<HTMLSelectElement>('.cinder-time-field__timezone')!;
    expect(timezone.getAttribute('aria-label')).toBe('Timezone');
    expect(timezone.getAttribute('aria-labelledby')).toBeNull();
  });

  test('omits empty accessible-name attributes on the time input', () => {
    const { container } = render(TimeField, {
      props: {
        id: 'reminder',
        value: '09:30',
        'aria-label': '',
        'aria-labelledby': '',
      },
    });

    expect(getInput(container).getAttribute('aria-label')).toBeNull();
    expect(getInput(container).getAttribute('aria-labelledby')).toBeNull();
  });

  test('falls back to FormField label id when aria-labelledby is empty', () => {
    const { container } = render(TimeFieldFormFieldFixture, {
      props: { timeFieldAriaLabelledBy: '' },
    });

    expect(getInput(container).getAttribute('aria-labelledby')).toBe('reminder-label');
  });

  test('namespaces local description and error ids inside FormField', () => {
    const { container } = render(TimeFieldFormFieldFixture, {
      props: { id: 'reminder-control', timeFieldId: 'reminder' },
    });
    const ids = Array.from(container.querySelectorAll<HTMLElement>('[id]')).map(
      (element) => element.id,
    );

    expect(new Set(ids).size).toBe(ids.length);
    expect(getInput(container).getAttribute('aria-describedby')).toBe(
      'reminder-control-time-field-description reminder-control-time-field-error reminder-control-description reminder-control-error',
    );
  });

  test('forwards caller-provided accessible name props to the native time input', () => {
    const { container } = render(TimeField, {
      props: { id: 'reminder', value: '09:30', 'aria-label': 'Reminder time' },
    });

    expect(getInput(container).getAttribute('aria-label')).toBe('Reminder time');
    expect(container.querySelector('.cinder-time-field')?.getAttribute('aria-label')).toBeNull();
  });

  test('forwards consumer invalid state to the time input', () => {
    const { container } = render(TimeField, {
      props: { id: 'reminder', value: '09:30', 'aria-invalid': true },
    });

    expect(getInput(container).getAttribute('aria-invalid')).toBe('true');
    expect(container.querySelector('.cinder-time-field')?.getAttribute('aria-invalid')).toBeNull();
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

  test('timezone changes normalize the current time to granularity', async () => {
    const changes: TimeFieldChange[] = [];
    const { container } = render(TimeField, {
      props: {
        id: 'reminder',
        granularity: 'second',
        defaultValue: '09:30',
        timezones: ['UTC', 'Europe/Berlin'],
        onchange: (detail: TimeFieldChange) => changes.push(detail),
      },
    });

    await fireEvent.change(container.querySelector('select')!, {
      target: { value: 'Europe/Berlin' },
    });

    expect(changes).toEqual([{ value: '09:30:00', timezone: 'Europe/Berlin' }]);
  });

  test('preserves timezone value when no timezone list is rendered', async () => {
    const changes: TimeFieldChange[] = [];
    const { container } = render(TimeField, {
      props: {
        id: 'reminder',
        label: 'Reminder time',
        value: '09:30',
        timezone: 'UTC',
        onchange: (detail: TimeFieldChange) => changes.push(detail),
      },
    });

    expect(container.querySelector('.cinder-time-field__timezone')).toBeNull();
    await fireEvent.change(getInput(container), { target: { value: '10:45' } });

    expect(changes[0]).toEqual({ value: '10:45', timezone: 'UTC' });
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

  test('native form reset restores the initial timezone prop', async () => {
    const form = document.createElement('form');
    document.body.appendChild(form);
    const { container } = render(TimeField, {
      target: form,
      props: {
        id: 'reminder',
        label: 'Reminder time',
        defaultValue: '09:30',
        timezones: ['America/Denver', 'UTC'],
        timezone: 'UTC',
      },
    });

    const timezone = container.querySelector<HTMLSelectElement>('.cinder-time-field__timezone')!;
    timezone.value = 'America/Denver';
    await fireEvent.change(timezone);

    form.dispatchEvent(new Event('reset', { bubbles: true, cancelable: true }));
    await tick();

    expect(container.querySelector<HTMLSelectElement>('.cinder-time-field__timezone')?.value).toBe(
      'UTC',
    );
  });

  test('native form reset uses updated default value and timezone options', async () => {
    const form = document.createElement('form');
    document.body.appendChild(form);
    const { container, rerender } = render(TimeField, {
      target: form,
      props: {
        id: 'reminder',
        label: 'Reminder time',
        defaultValue: '09:30',
        timezones: ['America/Denver', 'UTC'],
      },
    });

    await rerender({
      id: 'reminder',
      label: 'Reminder time',
      defaultValue: '08:00',
      timezones: ['UTC'],
    });
    await fireEvent.change(getInput(container), { target: { value: '10:45' } });

    form.dispatchEvent(new Event('reset', { bubbles: true, cancelable: true }));
    await tick();

    expect(getInput(container).value).toBe('08:00');
    expect(container.querySelector<HTMLSelectElement>('.cinder-time-field__timezone')?.value).toBe(
      'UTC',
    );
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

  test('submits fixed timezone with native forms when timezoneName is provided', () => {
    const { container } = render(TimeField, {
      props: {
        id: 'reminder',
        label: 'Reminder time',
        value: '09:30',
        timezone: 'UTC',
        timezoneName: 'reminder_timezone',
      },
    });

    expect(container.querySelector('.cinder-time-field__timezone')).toBeNull();
    const timezoneInput = container.querySelector<HTMLInputElement>(
      'input[type="hidden"][name="reminder_timezone"]',
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
