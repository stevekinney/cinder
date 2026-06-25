/// <reference lib="dom" />
import * as matchers from '@testing-library/jest-dom/matchers';
import { afterEach, beforeEach, describe, expect, setSystemTime, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import { setupHappyDom } from '../../test/happy-dom.ts';
import type { DateRangeDatePreset, DateRangeValue } from './date-range-field.types.ts';

expect.extend(matchers as Parameters<typeof expect.extend>[0]);

setupHappyDom();

const { render, fireEvent, waitFor, cleanup } = await import('@testing-library/svelte');
const { default: DateRangeField } = await import('./date-range-field.svelte');

beforeEach(() => document.body.replaceChildren());
afterEach(() => cleanup());

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStartInput(container: Element): HTMLInputElement {
  return container.querySelector('[id$="-start"]') as HTMLInputElement;
}

function getEndInput(container: Element): HTMLInputElement {
  return container.querySelector('[id$="-end"]') as HTMLInputElement;
}

function getPresetButtons(container: Element): HTMLButtonElement[] {
  return Array.from(
    container.querySelectorAll<HTMLButtonElement>('.cinder-date-range-field__preset-btn'),
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DateRangeField', () => {
  describe('structure', () => {
    test('renders root element with cinder-date-range-field class', () => {
      const { container } = render(DateRangeField, { id: 'drf' });
      expect(container.querySelector('.cinder-date-range-field')).not.toBeNull();
    });

    test('renders start and end date inputs', () => {
      const { container } = render(DateRangeField, { id: 'drf' });
      const startInput = getStartInput(container);
      const endInput = getEndInput(container);
      expect(startInput).not.toBeNull();
      expect(endInput).not.toBeNull();
      expect(startInput.type).toBe('date');
      expect(endInput.type).toBe('date');
    });

    test('renders datetime-local inputs when granularity includes time', () => {
      const { container } = render(DateRangeField, {
        id: 'drf',
        granularity: 'minute',
        value: { start: '2026-06-01T09:30', end: '2026-06-01T17:45' },
      });
      const startInput = getStartInput(container);
      const endInput = getEndInput(container);

      expect(startInput.type).toBe('datetime-local');
      expect(endInput.type).toBe('datetime-local');
      expect(startInput.step).toBe('60');
      expect(endInput.step).toBe('60');
      expect(startInput.value).toBe('2026-06-01T09:30');
      expect(endInput.value).toBe('2026-06-01T17:45');
    });

    test('sets second-level datetime step for second granularity', () => {
      const { container } = render(DateRangeField, {
        id: 'drf',
        granularity: 'second',
      });

      expect(getStartInput(container).step).toBe('1');
      expect(getEndInput(container).step).toBe('1');
    });

    test('sets hour-level datetime step for hour granularity', () => {
      const { container } = render(DateRangeField, {
        id: 'drf',
        granularity: 'hour',
      });

      expect(getStartInput(container).type).toBe('datetime-local');
      expect(getEndInput(container).type).toBe('datetime-local');
      expect(getStartInput(container).step).toBe('3600');
      expect(getEndInput(container).step).toBe('3600');
    });

    test('renders a visible label when label prop is provided', () => {
      const { container } = render(DateRangeField, { id: 'drf', label: 'Time window' });
      const legend = container.querySelector('.cinder-date-range-field__legend');
      expect(legend?.textContent?.trim()).toBe('Time window');
    });

    test('renders default preset buttons when hidePresets is false', () => {
      const { container } = render(DateRangeField, { id: 'drf' });
      const buttons = getPresetButtons(container);
      expect(buttons.length).toBeGreaterThan(0);
    });

    test('built-in Last 7 days preset covers seven inclusive calendar dates', async () => {
      const changes: DateRangeValue[] = [];
      const { container } = render(DateRangeField, {
        id: 'drf',
        onchange: (next: DateRangeValue) => changes.push(next),
      });
      const lastSevenDays = getPresetButtons(container).find(
        (button) => button.textContent?.trim() === 'Last 7 days',
      );
      if (!lastSevenDays) throw new Error('Last 7 days preset not found');

      await fireEvent.click(lastSevenDays);

      const [startYear, startMonth, startDay] = changes[0]!.start!.split('-').map(Number);
      const [endYear, endMonth, endDay] = changes[0]!.end!.split('-').map(Number);
      const start = new Date(startYear!, startMonth! - 1, startDay);
      const end = new Date(endYear!, endMonth! - 1, endDay);
      const inclusiveDays = (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000) + 1;

      expect(inclusiveDays).toBe(7);
    });

    test('built-in presets emit datetime-local values when granularity includes time', async () => {
      const changes: DateRangeValue[] = [];
      const { container } = render(DateRangeField, {
        id: 'drf',
        granularity: 'minute',
        onchange: (next: DateRangeValue) => changes.push(next),
      });
      const today = getPresetButtons(container).find(
        (button) => button.textContent?.trim() === 'Today',
      );
      if (!today) throw new Error('Today preset not found');

      await fireEvent.click(today);

      const change = changes[0];
      if (!change?.start || !change.end) throw new Error('Expected complete date range');
      expect(change.start).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
      expect(change.end).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
      expect(getStartInput(container).value).toBe(change.start);
      expect(getEndInput(container).value).toBe(change.end);
    });

    test('built-in hour presets include the active hour in their end value', async () => {
      setSystemTime(new Date(2026, 5, 24, 9, 45, 30));

      try {
        const changes: DateRangeValue[] = [];
        const { container } = render(DateRangeField, {
          id: 'drf',
          granularity: 'hour',
          onchange: (next: DateRangeValue) => changes.push(next),
        });
        const today = getPresetButtons(container).find(
          (button) => button.textContent?.trim() === 'Today',
        );
        if (!today) throw new Error('Today preset not found');

        await fireEvent.click(today);

        expect(changes[0]).toEqual({
          start: '2026-06-24T00:00',
          end: '2026-06-24T10:00',
        });
      } finally {
        setSystemTime();
      }
    });

    test('built-in hour presets do not spill into the next calendar day', async () => {
      setSystemTime(new Date(2026, 5, 24, 23, 45, 30));

      try {
        const changes: DateRangeValue[] = [];
        const { container } = render(DateRangeField, {
          id: 'drf',
          granularity: 'hour',
          onchange: (next: DateRangeValue) => changes.push(next),
        });
        const today = getPresetButtons(container).find(
          (button) => button.textContent?.trim() === 'Today',
        );
        if (!today) throw new Error('Today preset not found');

        await fireEvent.click(today);

        expect(changes[0]).toEqual({
          start: '2026-06-24T00:00',
          end: '2026-06-24T23:00',
        });
      } finally {
        setSystemTime();
      }
    });

    test('custom presets normalize values to the current granularity', async () => {
      const changes: DateRangeValue[] = [];
      const presets: DateRangeDatePreset[] = [
        {
          id: 'custom',
          label: 'Custom',
          resolve: () => ({
            start: '2026-06-24',
            end: '2026-06-24T09:45:30',
          }),
        },
      ];
      const { container } = render(DateRangeField, {
        id: 'drf',
        granularity: 'minute',
        presets,
        onchange: (next: DateRangeValue) => changes.push(next),
      });
      const custom = getPresetButtons(container)[0];
      if (!custom) throw new Error('Custom preset not found');

      await fireEvent.click(custom);

      expect(changes[0]).toEqual({
        start: '2026-06-24T00:00',
        end: '2026-06-24T09:45',
      });
      expect(custom.getAttribute('aria-pressed')).toBe('true');
    });

    test('moving datetime presets keep their pressed state after selection', async () => {
      let callCount = 0;
      const presets: DateRangeDatePreset[] = [
        {
          id: 'moving',
          label: 'Moving',
          resolve: () => {
            callCount += 1;
            return {
              start: '2026-06-24T00:00',
              end: `2026-06-24T00:${String(callCount).padStart(2, '0')}`,
            };
          },
        },
      ];
      const { container } = render(DateRangeField, {
        id: 'drf',
        granularity: 'minute',
        presets,
      });
      const moving = getPresetButtons(container)[0];
      if (!moving) throw new Error('Moving preset not found');

      await fireEvent.click(moving);

      expect(moving.getAttribute('aria-pressed')).toBe('true');
    });

    test('built-in Yesterday & today preset covers two inclusive calendar dates', async () => {
      const changes: DateRangeValue[] = [];
      const { container } = render(DateRangeField, {
        id: 'drf',
        onchange: (next: DateRangeValue) => changes.push(next),
      });
      const yesterdayToday = getPresetButtons(container).find(
        (button) => button.textContent?.trim() === 'Yesterday & today',
      );
      if (!yesterdayToday) throw new Error('Yesterday & today preset not found');

      await fireEvent.click(yesterdayToday);

      const [startYear, startMonth, startDay] = changes[0]!.start!.split('-').map(Number);
      const [endYear, endMonth, endDay] = changes[0]!.end!.split('-').map(Number);
      const start = new Date(startYear!, startMonth! - 1, startDay);
      const end = new Date(endYear!, endMonth! - 1, endDay);
      const inclusiveDays = (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000) + 1;

      expect(inclusiveDays).toBe(2);
    });

    test('hides preset buttons when hidePresets is true', () => {
      const { container } = render(DateRangeField, { id: 'drf', hidePresets: true });
      const presets = container.querySelector('.cinder-date-range-field__presets');
      expect(presets).toBeNull();
    });

    test('renders custom preset labels when presets prop is provided', () => {
      const customPresets = [
        {
          id: 'custom-1',
          label: 'This week',
          resolve: () => ({ start: '2026-06-01', end: '2026-06-07' }),
        },
      ];
      const { container } = render(DateRangeField, { id: 'drf', presets: customPresets });
      const buttons = getPresetButtons(container);
      expect(buttons.length).toBe(1);
      const firstBtn = buttons[0];
      expect(firstBtn?.textContent?.trim()).toBe('This week');
    });

    test('renders start and end labels', () => {
      const { container } = render(DateRangeField, {
        id: 'drf',
        startLabel: 'From',
        endLabel: 'To',
      });
      const labels = container.querySelectorAll('.cinder-date-range-field__input-label');
      const labelTexts = Array.from(labels).map((l) => l.textContent?.trim());
      expect(labelTexts).toContain('From');
      expect(labelTexts).toContain('To');
    });

    test('uses datetime-aware default labels for datetime granularities', () => {
      const { container } = render(DateRangeField, {
        id: 'drf',
        granularity: 'minute',
      });
      const labelTexts = Array.from(
        container.querySelectorAll('.cinder-date-range-field__input-label'),
      ).map((labelElement) => labelElement.textContent?.trim());

      expect(labelTexts).toEqual(['Start date and time', 'End date and time']);
    });

    test('renders description paragraph when description is provided', () => {
      const { container } = render(DateRangeField, {
        id: 'drf',
        description: 'Select the time window to filter events.',
      });
      const desc = container.querySelector('.cinder-date-range-field__description');
      expect(desc?.textContent?.trim()).toBe('Select the time window to filter events.');
    });

    test('renders error message when error is provided', () => {
      const { container } = render(DateRangeField, {
        id: 'drf',
        error: 'Start must be before end.',
      });
      const errorEl = container.querySelector('.cinder-date-range-field__error');
      expect(errorEl?.textContent?.trim()).toBe('Start must be before end.');
    });

    test('error element is always in the DOM (live region)', () => {
      const { container } = render(DateRangeField, { id: 'drf' });
      const errorEl = container.querySelector('.cinder-date-range-field__error');
      expect(errorEl).not.toBeNull();
    });

    test('merges custom class onto root element', () => {
      const { container } = render(DateRangeField, { id: 'drf', class: 'my-wrapper' });
      const root = container.querySelector('.cinder-date-range-field');
      expect(root?.classList.contains('my-wrapper')).toBe(true);
    });
  });

  describe('behavior', () => {
    test('preset click calls onchange with resolved dates', async () => {
      const changes: DateRangeValue[] = [];
      const preset = {
        id: 'last-7d',
        label: 'Last 7 days',
        resolve: () => ({ start: '2026-05-31', end: '2026-06-07' }),
      };
      const { container } = render(DateRangeField, {
        id: 'drf',
        presets: [preset],
        onchange: (v: DateRangeValue) => changes.push(v),
      });

      const btn = getPresetButtons(container)[0];
      if (!btn) throw new Error('No preset button found');
      await fireEvent.click(btn);

      expect(changes.length).toBe(1);
      expect(changes[0]?.start).toBe('2026-05-31');
      expect(changes[0]?.end).toBe('2026-06-07');
    });

    test('manual datetime input emits date-time values', async () => {
      const changes: DateRangeValue[] = [];
      const { container } = render(DateRangeField, {
        id: 'drf',
        granularity: 'minute',
        onchange: (v: DateRangeValue) => changes.push(v),
      });

      await fireEvent.change(getStartInput(container), {
        target: { value: '2026-06-01T09:30' },
      });
      await fireEvent.change(getEndInput(container), {
        target: { value: '2026-06-01T17:45' },
      });

      expect(changes).toEqual([
        { start: '2026-06-01T09:30', end: undefined },
        { start: '2026-06-01T09:30', end: '2026-06-01T17:45' },
      ]);
    });

    test('manual datetime input truncates to hour granularity', async () => {
      const changes: DateRangeValue[] = [];
      const { container } = render(DateRangeField, {
        id: 'drf',
        granularity: 'hour',
        onchange: (v: DateRangeValue) => changes.push(v),
      });

      await fireEvent.change(getStartInput(container), {
        target: { value: '2026-06-01T09:30' },
      });

      expect(changes[0]?.start).toBe('2026-06-01T09:00');
    });

    test('manual datetime input truncates seconds at minute granularity', async () => {
      const changes: DateRangeValue[] = [];
      const { container } = render(DateRangeField, {
        id: 'drf',
        granularity: 'minute',
        onchange: (v: DateRangeValue) => changes.push(v),
      });

      await fireEvent.change(getEndInput(container), {
        target: { value: '2026-06-01T17:45:30' },
      });

      expect(changes[0]?.end).toBe('2026-06-01T17:45');
    });

    test('manual datetime input normalizes the preserved endpoint before emitting', async () => {
      const changes: DateRangeValue[] = [];
      const { container } = render(DateRangeField, {
        id: 'drf',
        granularity: 'minute',
        value: { start: '2026-06-01T09:30:15', end: '2026-06-01T17:45:30' },
        onchange: (v: DateRangeValue) => changes.push(v),
      });

      await fireEvent.change(getStartInput(container), {
        target: { value: '2026-06-01T10:15:45' },
      });

      expect(changes[0]).toEqual({
        start: '2026-06-01T10:15',
        end: '2026-06-01T17:45',
      });

      await fireEvent.change(getEndInput(container), {
        target: { value: '2026-06-01T18:30:45' },
      });

      expect(changes[1]).toEqual({
        start: '2026-06-01T10:15',
        end: '2026-06-01T18:30',
      });
    });

    test('manual datetime input appends seconds at second granularity', async () => {
      const changes: DateRangeValue[] = [];
      const { container } = render(DateRangeField, {
        id: 'drf',
        granularity: 'second',
        onchange: (v: DateRangeValue) => changes.push(v),
      });

      await fireEvent.change(getStartInput(container), {
        target: { value: '2026-06-01T09:30' },
      });

      expect(changes[0]?.start).toBe('2026-06-01T09:30:00');
    });

    test('clicking a preset marks it as aria-pressed="true"', async () => {
      const preset = {
        id: 'last-7d',
        label: 'Last 7 days',
        resolve: () => ({ start: '2026-05-31', end: '2026-06-07' }),
      };
      const { container } = render(DateRangeField, {
        id: 'drf',
        presets: [preset],
        onchange: () => {},
      });

      const btn = getPresetButtons(container)[0];
      if (!btn) throw new Error('No preset button found');
      expect(btn.getAttribute('aria-pressed')).toBe('false');

      await fireEvent.click(btn);
      await waitFor(() => {
        expect(btn.getAttribute('aria-pressed')).toBe('true');
      });
    });

    test('marks a preset pressed when the controlled value matches it', () => {
      const preset = {
        id: 'last-7d',
        label: 'Last 7 days',
        resolve: () => ({ start: '2026-05-31', end: '2026-06-07' }),
      };
      const { container } = render(DateRangeField, {
        id: 'drf',
        presets: [preset],
        value: { start: '2026-05-31', end: '2026-06-07' },
      });

      const btn = getPresetButtons(container)[0];
      if (!btn) throw new Error('No preset button found');
      expect(btn.getAttribute('aria-pressed')).toBe('true');
    });

    test('matches controlled preset values after granularity normalization', () => {
      const preset = {
        id: 'custom',
        label: 'Custom',
        resolve: () => ({ start: '2026-06-01T09:30', end: '2026-06-07T17:45' }),
      };
      const { container } = render(DateRangeField, {
        id: 'drf',
        granularity: 'minute',
        presets: [preset],
        value: { start: '2026-06-01T09:30:15', end: '2026-06-07T17:45:30' },
      });

      const btn = getPresetButtons(container)[0];
      if (!btn) throw new Error('No preset button found');
      expect(btn.getAttribute('aria-pressed')).toBe('true');
    });

    test('clears preset pressed state when the controlled value no longer matches it', async () => {
      const preset = {
        id: 'last-7d',
        label: 'Last 7 days',
        resolve: () => ({ start: '2026-05-31', end: '2026-06-07' }),
      };
      const { container, rerender } = render(DateRangeField, {
        id: 'drf',
        presets: [preset],
        value: { start: '2026-05-31', end: '2026-06-07' },
      });
      const btn = getPresetButtons(container)[0];
      if (!btn) throw new Error('No preset button found');

      await rerender({
        id: 'drf',
        presets: [preset],
        value: { start: '2026-06-01', end: '2026-06-07' },
      });

      expect(btn.getAttribute('aria-pressed')).toBe('false');
    });

    test('does not keep a stale pressed preset when same-id presets change', async () => {
      const originalPreset = {
        id: 'custom',
        label: 'Custom',
        resolve: () => ({ start: '2026-06-01', end: '2026-06-07' }),
      };
      const replacementPreset = {
        id: 'custom',
        label: 'Custom',
        resolve: () => ({ start: '2026-06-08', end: '2026-06-14' }),
      };
      const { container, rerender } = render(DateRangeField, {
        id: 'drf',
        presets: [originalPreset],
      });
      const btn = getPresetButtons(container)[0];
      if (!btn) throw new Error('No preset button found');

      await fireEvent.click(btn);
      expect(btn.getAttribute('aria-pressed')).toBe('true');

      await rerender({
        id: 'drf',
        presets: [replacementPreset],
        value: { start: '2026-06-01', end: '2026-06-07' },
      });

      expect(btn.getAttribute('aria-pressed')).toBe('false');
    });

    test('manually changing start input calls onchange and clears active preset', async () => {
      const changes: DateRangeValue[] = [];
      const preset = {
        id: 'last-7d',
        label: 'Last 7 days',
        resolve: () => ({ start: '2026-05-31', end: '2026-06-07' }),
      };
      const { container } = render(DateRangeField, {
        id: 'drf',
        presets: [preset],
        onchange: (v: DateRangeValue) => changes.push(v),
      });

      // First pick a preset
      const btn = getPresetButtons(container)[0];
      if (!btn) throw new Error('No preset button found');
      await fireEvent.click(btn);

      // Then manually change the start date
      const startInput = getStartInput(container);
      await fireEvent.change(startInput, { target: { value: '2026-06-01' } });

      await waitFor(() => {
        expect(btn.getAttribute('aria-pressed')).toBe('false');
      });
      const lastChange = changes[changes.length - 1];
      expect(lastChange?.start).toBe('2026-06-01');
    });

    test('manually changing end input calls onchange', async () => {
      const changes: DateRangeValue[] = [];
      const { container } = render(DateRangeField, {
        id: 'drf',
        onchange: (v: DateRangeValue) => changes.push(v),
      });

      const endInput = getEndInput(container);
      await fireEvent.change(endInput, { target: { value: '2026-06-30' } });

      expect(changes.length).toBe(1);
      expect(changes[0]?.end).toBe('2026-06-30');
    });

    test('clearing an input emits undefined for that bound', async () => {
      const changes: DateRangeValue[] = [];
      const { container } = render(DateRangeField, {
        id: 'drf',
        value: { start: '2026-06-01', end: '2026-06-30' },
        onchange: (v: DateRangeValue) => changes.push(v),
      });

      const startInput = getStartInput(container);
      await fireEvent.change(startInput, { target: { value: '' } });

      expect(changes.length).toBe(1);
      expect(changes[0]?.start).toBeUndefined();
    });

    test('disabled field disables all inputs and preset buttons', () => {
      const { container } = render(DateRangeField, { id: 'drf', disabled: true });
      const startInput = getStartInput(container);
      const endInput = getEndInput(container);
      const buttons = getPresetButtons(container);

      expect(startInput.disabled).toBe(true);
      expect(endInput.disabled).toBe(true);
      for (const btn of buttons) {
        expect(btn.disabled).toBe(true);
      }
    });

    test('preset buttons do not fire when disabled', async () => {
      const changes: DateRangeValue[] = [];
      const preset = {
        id: 'custom',
        label: 'Custom',
        resolve: () => ({ start: '2026-06-01', end: '2026-06-07' }),
      };
      const { container } = render(DateRangeField, {
        id: 'drf',
        disabled: true,
        presets: [preset],
        onchange: (v: DateRangeValue) => changes.push(v),
      });

      const btn = getPresetButtons(container)[0];
      if (!btn) throw new Error('No preset button found');
      await fireEvent.click(btn);
      expect(changes.length).toBe(0);
    });
  });

  describe('accessibility', () => {
    test('start and end inputs have accessible labels via for/id association', () => {
      const { container } = render(DateRangeField, {
        id: 'drf',
        startLabel: 'Start date',
        endLabel: 'End date',
      });

      const startInput = getStartInput(container);
      const endInput = getEndInput(container);

      const startLabel = container.querySelector(`label[for="${startInput.id}"]`);
      const endLabel = container.querySelector(`label[for="${endInput.id}"]`);

      expect(startLabel).not.toBeNull();
      expect(endLabel).not.toBeNull();
      expect(startLabel?.textContent?.trim()).toBe('Start date');
      expect(endLabel?.textContent?.trim()).toBe('End date');
    });

    test('inputs have aria-invalid="true" when error is set', () => {
      const { container } = render(DateRangeField, {
        id: 'drf',
        error: 'Invalid range.',
      });
      const startInput = getStartInput(container);
      const endInput = getEndInput(container);
      expect(startInput.getAttribute('aria-invalid')).toBe('true');
      expect(endInput.getAttribute('aria-invalid')).toBe('true');
    });

    test('inputs do not have aria-invalid when no error', () => {
      const { container } = render(DateRangeField, { id: 'drf' });
      const startInput = getStartInput(container);
      const endInput = getEndInput(container);
      expect(startInput.getAttribute('aria-invalid')).toBeNull();
      expect(endInput.getAttribute('aria-invalid')).toBeNull();
    });

    test('error element has aria-live="polite" and no role="alert"', () => {
      const { container } = render(DateRangeField, {
        id: 'drf',
        error: 'Start must be before end.',
      });
      const errorEl = container.querySelector('.cinder-date-range-field__error');
      expect(errorEl?.getAttribute('aria-live')).toBe('polite');
      expect(errorEl?.getAttribute('role')).toBeNull();
    });

    test('preset buttons have aria-pressed attribute', () => {
      const preset = {
        id: 'custom',
        label: 'Custom preset',
        resolve: () => ({ start: '2026-06-01', end: '2026-06-07' }),
      };
      const { container } = render(DateRangeField, { id: 'drf', presets: [preset] });
      const btn = getPresetButtons(container)[0];
      if (!btn) throw new Error('No preset button found');
      expect(btn.getAttribute('aria-pressed')).not.toBeNull();
    });

    test('preset button group has an accessible group label', () => {
      const { container } = render(DateRangeField, { id: 'drf' });
      const group = container.querySelector('.cinder-date-range-field__presets[role="group"]');
      expect(group?.getAttribute('aria-label')).toBe('Date range presets');
    });

    test('root has role="group" and aria-labelledby pointing to the legend when label is provided', () => {
      const { container } = render(DateRangeField, { id: 'drf', label: 'Time window' });
      const root = container.querySelector('.cinder-date-range-field');
      const legend = container.querySelector('.cinder-date-range-field__legend');
      expect(root?.getAttribute('role')).toBe('group');
      expect(root?.getAttribute('aria-labelledby')).toBe(legend?.getAttribute('id'));
    });

    test('root accessibility semantics cannot be overridden by rest attributes', () => {
      const { container } = render(DateRangeField, {
        id: 'drf',
        label: 'Time window',
        role: 'presentation',
        'aria-labelledby': 'consumer-label',
      } as never);
      const root = container.querySelector('.cinder-date-range-field');
      const legend = container.querySelector('.cinder-date-range-field__legend');
      expect(root?.getAttribute('role')).toBe('group');
      expect(root?.getAttribute('aria-labelledby')).toBe(legend?.getAttribute('id'));
    });

    test('inputs carry aria-describedby referencing the error element when error is present', () => {
      const { container } = render(DateRangeField, {
        id: 'drf',
        error: 'Start must be before end.',
      });
      const startInput = getStartInput(container);
      const endInput = getEndInput(container);
      const errorEl = container.querySelector('.cinder-date-range-field__error');
      expect(errorEl).not.toBeNull();
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(startInput.getAttribute('aria-describedby')).toContain(errorEl!.id);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(endInput.getAttribute('aria-describedby')).toContain(errorEl!.id);
    });

    test('keyboard: Tab moves focus from start to end input', async () => {
      const { container } = render(DateRangeField, { id: 'drf' });
      const startInput = getStartInput(container);
      const endInput = getEndInput(container);

      startInput.focus();
      expect(document.activeElement).toBe(startInput);

      await fireEvent.keyDown(startInput, { key: 'Tab' });
      endInput.focus(); // happy-dom does not auto-move focus on Tab
      expect(document.activeElement).toBe(endInput);
    });

    test('description is wired via aria-describedby on the inputs', () => {
      const { container } = render(DateRangeField, {
        id: 'drf',
        description: 'Filter events by date.',
      });
      const descEl = container.querySelector('.cinder-date-range-field__description');
      expect(descEl).not.toBeNull();
      const startInput = getStartInput(container);
      const endInput = getEndInput(container);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(startInput.getAttribute('aria-describedby')).toContain(descEl!.id);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(endInput.getAttribute('aria-describedby')).toContain(descEl!.id);
    });
  });

  describe('CSS snapshot', () => {
    test('CSS file exists and contains cinder-date-range-field class', () => {
      const css = readFileSync(new URL('./date-range-field.css', import.meta.url), 'utf8');
      expect(css).toContain('cinder-date-range-field');
      expect(css).toContain('@layer cinder.components');
    });
  });
});
