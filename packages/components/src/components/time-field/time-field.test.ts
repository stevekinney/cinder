/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';
import type { TimeFieldChange } from './time-field.types.ts';

setupHappyDom();

const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
const { default: TimeField } = await import('./time-field.svelte');
const { default: LocaleProviderFixture } =
  await import('../../test/fixtures/time-field-locale-provider-fixture.svelte');

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

  test('period select converts the canonical 24-hour value', async () => {
    const changes: TimeFieldChange[] = [];
    const { container } = render(TimeField, {
      props: {
        id: 'reminder',
        label: 'Reminder time',
        hourCycle: 'h12',
        value: '09:30',
        onchange: (detail: TimeFieldChange) => changes.push(detail),
      },
    });

    const period = container.querySelector<HTMLSelectElement>('.cinder-time-field__period')!;
    expect(period.value).toBe('AM');
    await fireEvent.change(period, { target: { value: 'PM' } });

    expect(changes[0]?.value).toBe('21:30');
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

  test('uses LocaleProvider to resolve the default hour cycle', () => {
    const { container } = render(LocaleProviderFixture, {
      props: { locale: 'de-DE' },
    });

    expect(container.querySelector('.cinder-time-field__period')).toBeNull();
  });
});
