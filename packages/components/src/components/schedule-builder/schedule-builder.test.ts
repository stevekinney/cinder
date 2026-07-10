/// <reference lib="dom" />
import { afterEach, describe, expect, mock, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';
import type { ScheduleFire, ScheduleValue } from './schedule-builder.types.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
const { default: ScheduleBuilder } = await import('./schedule-builder.svelte');
// createRawSnippet must be imported dynamically so Bun's svelte plugin (which patches
// the svelte package to resolve to the client build) applies before this import resolves.
// A top-level static import of 'svelte' resolves to svelte/index-server.js in Bun's
// non-browser environment, making `mount()` throw "not available on the server".
const { createRawSnippet } = await import('svelte');

/** Creates a Svelte 5 Snippet that renders text content. */
function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
  }));
}

const STATIC_FIRES: ScheduleFire[] = [
  { id: 'fire-1', label: 'Mon Jun 1, 09:00' },
  { id: 'fire-2', label: 'Tue Jun 2, 09:00' },
];

function stubComputeNextFires(fires: ScheduleFire[] = STATIC_FIRES) {
  return mock((_value: ScheduleValue, _count: number) => fires);
}

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

describe('ScheduleBuilder', () => {
  describe('structure', () => {
    test('renders the cinder-schedule-builder root with a default label', () => {
      const { container } = render(ScheduleBuilder, {});
      const root = container.querySelector('.cinder-schedule-builder');
      expect(root).not.toBeNull();
      expect(root?.getAttribute('aria-label')).toBe('Schedule');
      expect(root?.getAttribute('role')).toBe('group');
    });

    test('merges a custom class onto the root element', () => {
      const { container } = render(ScheduleBuilder, { class: 'my-schedule' });
      const root = container.querySelector('.cinder-schedule-builder');
      expect(root?.classList.contains('my-schedule')).toBe(true);
    });

    test('honors a custom label prop', () => {
      const { container } = render(ScheduleBuilder, { label: 'Job schedule' });
      const root = container.querySelector('.cinder-schedule-builder');
      expect(root?.getAttribute('aria-label')).toBe('Job schedule');
    });

    test('allows a consumer aria-labelledby to take precedence over the default label', () => {
      const { container } = render(ScheduleBuilder, {
        'aria-labelledby': 'external-heading',
      } as never);
      const root = container.querySelector('.cinder-schedule-builder');
      expect(root?.getAttribute('aria-labelledby')).toBe('external-heading');
      expect(root?.getAttribute('aria-label')).toBeNull();
    });

    test('normalizes an empty aria-label to fall back to the label default, not an empty attribute', () => {
      const { container } = render(ScheduleBuilder, { 'aria-label': '' } as never);
      const root = container.querySelector('.cinder-schedule-builder');
      expect(root?.getAttribute('aria-label')).toBe('Schedule');
    });

    test('normalizes a whitespace-only aria-label to fall back to the label default', () => {
      const { container } = render(ScheduleBuilder, { 'aria-label': '   ' } as never);
      const root = container.querySelector('.cinder-schedule-builder');
      expect(root?.getAttribute('aria-label')).toBe('Schedule');
    });

    test('normalizes an empty aria-labelledby so it is omitted rather than rendered empty', () => {
      const { container } = render(ScheduleBuilder, { 'aria-labelledby': '' } as never);
      const root = container.querySelector('.cinder-schedule-builder');
      expect(root?.hasAttribute('aria-labelledby')).toBe(false);
      // With aria-labelledby normalized away, the label default takes over.
      expect(root?.getAttribute('aria-label')).toBe('Schedule');
    });

    test('defaults to presets mode', () => {
      const { container } = render(ScheduleBuilder, {});
      const root = container.querySelector('.cinder-schedule-builder');
      expect(root?.getAttribute('data-sb-mode')).toBe('presets');
      expect(container.querySelector('[data-sb-panel="presets"]')).not.toBeNull();
    });
  });

  describe('initial authoring mode', () => {
    test('defaults to presets when no value is passed', () => {
      const { container } = render(ScheduleBuilder, {});
      expect(container.querySelector('[data-sb-panel="presets"]')).not.toBeNull();
    });

    test('starts in presets for a minutes/hours interval value (it cleanly matches "every N")', () => {
      const value: ScheduleValue = { mode: 'interval', every: 5, unit: 'hours' };
      const { container, getByLabelText } = render(ScheduleBuilder, { value });

      expect(container.querySelector('[data-sb-panel="presets"]')).not.toBeNull();
      expect(container.querySelector('.cinder-schedule-builder__summary-text')?.textContent).toBe(
        'Every 5 hours',
      );
      expect((getByLabelText('Every') as HTMLInputElement).value).toBe('5');
      expect((getByLabelText('Unit') as HTMLSelectElement).value).toBe('hours');
    });

    test('starts in interval mode for a days interval value (presets cannot represent it)', () => {
      const value: ScheduleValue = { mode: 'interval', every: 3, unit: 'days' };
      const { container, getByLabelText } = render(ScheduleBuilder, { value });

      expect(container.querySelector('[data-sb-panel="interval"]')).not.toBeNull();
      expect(container.querySelector('.cinder-schedule-builder__summary-text')?.textContent).toBe(
        'Every 3 days',
      );
      expect((getByLabelText('Every') as HTMLInputElement).value).toBe('3');
      expect((getByLabelText('Unit') as HTMLSelectElement).value).toBe('days');
    });

    test('starts in interval mode for a weeks interval value (presets cannot represent it)', () => {
      const value: ScheduleValue = { mode: 'interval', every: 2, unit: 'weeks' };
      const { container } = render(ScheduleBuilder, { value });

      expect(container.querySelector('[data-sb-panel="interval"]')).not.toBeNull();
    });

    test('starts in cron mode for any cron value, with the value seeded and described immediately', () => {
      const value: ScheduleValue = { mode: 'cron', expression: '30 14 * * *' };
      const { container, getByLabelText } = render(ScheduleBuilder, { value });

      expect(container.querySelector('[data-sb-panel="cron"]')).not.toBeNull();
      expect(container.querySelector('.cinder-schedule-builder__summary-text')?.textContent).toBe(
        'Daily at 14:30',
      );
      expect((getByLabelText('Minute') as HTMLInputElement).value).toBe('30');
      expect((getByLabelText('Hour') as HTMLInputElement).value).toBe('14');
    });
  });

  describe('controlled value resync', () => {
    test('a post-mount value change re-renders the summary and mode', async () => {
      const initialValue: ScheduleValue = { mode: 'interval', every: 15, unit: 'minutes' };
      const { container, rerender } = render(ScheduleBuilder, { value: initialValue });

      expect(container.querySelector('[data-sb-panel="presets"]')).not.toBeNull();
      expect(container.querySelector('.cinder-schedule-builder__summary-text')?.textContent).toBe(
        'Every 15 minutes',
      );

      // Simulate a parent loading a saved schedule / resetting the form: a
      // genuinely different, unrelated value arrives as a prop update.
      const nextValue: ScheduleValue = { mode: 'cron', expression: '0 9 * * 1' };
      await rerender({ value: nextValue });

      expect(container.querySelector('[data-sb-panel="cron"]')).not.toBeNull();
      expect(container.querySelector('.cinder-schedule-builder__summary-text')?.textContent).toBe(
        'Weekly on Monday at 09:00',
      );
    });

    test('re-passing the same value (a controlled onchange echo) does not reset a mid-edit cron field', async () => {
      const onchange = mock();
      const initialValue: ScheduleValue = { mode: 'cron', expression: '0 9 * * 1' };
      const { getByLabelText, getByRole, rerender } = render(ScheduleBuilder, {
        value: initialValue,
        onchange,
      });

      // Already in cron mode (a cron `value` opens directly there). Start an
      // in-progress, momentarily-invalid edit to the minute field.
      const minuteField = getByLabelText('Minute') as HTMLInputElement;
      await fireEvent.input(minuteField, { target: { value: '9' } });
      expect(minuteField.value).toBe('9');
      // A single-digit "9" is a valid cron token on its own, so this commits —
      // simulate the typical controlled pattern: the parent stores whatever
      // onchange emitted and passes the SAME content back down as `value`,
      // often as a freshly-constructed object (not the same reference).
      expect(onchange).toHaveBeenCalledTimes(1);
      const echoed: ScheduleValue = { ...(onchange.mock.calls[0]![0] as ScheduleValue) };

      await rerender({ value: echoed, onchange });

      // The field must still read the same committed value — an echo of an
      // unchanged value must not re-seed and must not appear as a reset.
      expect(minuteField.value).toBe('9');
      expect(getByRole('tab', { name: 'Cron', selected: true })).not.toBeNull();
    });

    test('a value prop that is undefined at mount and stays undefined never triggers a resync', async () => {
      const { getByLabelText, getByRole, rerender } = render(ScheduleBuilder, {});

      await fireEvent.click(getByRole('tab', { name: 'Cron' }));
      const minuteField = getByLabelText('Minute') as HTMLInputElement;
      await fireEvent.input(minuteField, { target: { value: '0' } });

      // A re-render with no `value` prop at all (still uncontrolled) must not
      // clobber the in-progress cron edit.
      await rerender({});

      expect((getByLabelText('Minute') as HTMLInputElement).value).toBe('0');
    });

    test('a controlled parent that rejects an edit by re-passing the prior value reverts the field', async () => {
      const onchange = mock();
      const initialValue: ScheduleValue = { mode: 'cron', expression: '0 9 * * 1' };
      const { getByLabelText, rerender } = render(ScheduleBuilder, {
        value: initialValue,
        onchange,
      });

      const minuteField = getByLabelText('Minute') as HTMLInputElement;
      await fireEvent.input(minuteField, { target: { value: '30' } });
      expect(minuteField.value).toBe('30');
      expect(onchange).toHaveBeenCalledTimes(1);

      // A validating/authorizing parent that rejects the edit does NOT echo
      // what onchange emitted — it re-passes its own (distinct, unaccepted)
      // prior value instead. Because that's content-different from what the
      // child optimistically emitted, the resync effect's `scheduleValuesEqual`
      // guard treats it as a genuine external change and reseeds.
      await rerender({ value: { ...initialValue }, onchange });

      expect((getByLabelText('Minute') as HTMLInputElement).value).toBe('0');
    });

    test('a controlled value change to undefined resets the visible mode and summary to the default', async () => {
      const initialValue: ScheduleValue = { mode: 'cron', expression: '0 9 * * 1' };
      const { container, rerender } = render(ScheduleBuilder, { value: initialValue });

      expect(container.querySelector('[data-sb-panel="cron"]')).not.toBeNull();
      expect(container.querySelector('.cinder-schedule-builder__summary-text')?.textContent).toBe(
        'Weekly on Monday at 09:00',
      );

      // A controlled parent clearing `value` back to `undefined` is a
      // documented reset to the default/omitted state (e.g. a form reset),
      // not "stop controlling and freeze on whatever was last shown".
      await rerender({ value: undefined });

      expect(container.querySelector('[data-sb-panel="presets"]')).not.toBeNull();
      expect(container.querySelector('.cinder-schedule-builder__summary-text')?.textContent).toBe(
        'Every 15 minutes',
      );
    });

    test('an uncontrolled component (no value prop, ever) does not reset a mid-edit cron field on re-render', async () => {
      const { getByLabelText, getByRole, rerender } = render(ScheduleBuilder, {});

      await fireEvent.click(getByRole('tab', { name: 'Cron' }));
      const minuteField = getByLabelText('Minute') as HTMLInputElement;
      await fireEvent.input(minuteField, { target: { value: '7' } });

      // Re-render with the same (absent) props, as an uncontrolled consumer
      // would on any unrelated parent update. `value` stays `undefined`
      // throughout, so the resync effect must not treat this as a reset.
      await rerender({});
      await rerender({});

      expect((getByLabelText('Minute') as HTMLInputElement).value).toBe('7');
    });
  });

  describe('mode switching', () => {
    test('switching to cron mode shows the cron panel and hides the presets panel', async () => {
      const { container, getByRole } = render(ScheduleBuilder, {});
      const cronTab = getByRole('tab', { name: 'Cron' });

      await fireEvent.click(cronTab);

      expect(container.querySelector('[data-sb-panel="cron"]')).not.toBeNull();
      expect(container.querySelector('[data-sb-panel="presets"]')).toBeNull();
      expect(container.querySelectorAll('.cinder-schedule-builder__cron-fields > *')).toHaveLength(
        5,
      );
    });

    test('switching to interval mode shows the interval panel', async () => {
      const { container, getByRole } = render(ScheduleBuilder, {});
      const intervalTab = getByRole('tab', { name: 'Interval' });

      await fireEvent.click(intervalTab);

      expect(container.querySelector('[data-sb-panel="interval"]')).not.toBeNull();
    });

    test('switching modes does not call onchange', async () => {
      const onchange = mock();
      const { getByRole } = render(ScheduleBuilder, { onchange });

      await fireEvent.click(getByRole('tab', { name: 'Cron' }));
      await fireEvent.click(getByRole('tab', { name: 'Interval' }));
      await fireEvent.click(getByRole('tab', { name: 'Presets' }));

      expect(onchange).not.toHaveBeenCalled();
    });

    test('entering cron mode seeds the five fields from the default interval value', async () => {
      const { getByLabelText, getByRole } = render(ScheduleBuilder, {});

      await fireEvent.click(getByRole('tab', { name: 'Cron' }));

      // Default value is "every 15 minutes" -> */15 * * * *
      expect((getByLabelText('Minute') as HTMLInputElement).value).toBe('*/15');
      expect((getByLabelText('Hour') as HTMLInputElement).value).toBe('*');
      expect((getByLabelText('Day of month') as HTMLInputElement).value).toBe('*');
      expect((getByLabelText('Month') as HTMLInputElement).value).toBe('*');
      expect((getByLabelText('Day of week') as HTMLInputElement).value).toBe('*');
    });

    test('entering interval mode from a representable cron value seeds every/unit losslessly', async () => {
      const value: ScheduleValue = { mode: 'cron', expression: '0 */2 * * *' };
      const { getByLabelText, getByRole } = render(ScheduleBuilder, { value });

      await fireEvent.click(getByRole('tab', { name: 'Interval' }));

      expect((getByLabelText('Every') as HTMLInputElement).value).toBe('2');
      const unitSelect = getByLabelText('Unit') as HTMLSelectElement;
      expect(unitSelect.value).toBe('hours');
    });

    test('entering interval mode from a non-representable cron value leaves interval fields at their default', async () => {
      const value: ScheduleValue = { mode: 'cron', expression: '30 9 * * 1' };
      const { getByLabelText, getByRole } = render(ScheduleBuilder, { value });

      await fireEvent.click(getByRole('tab', { name: 'Interval' }));

      expect((getByLabelText('Every') as HTMLInputElement).value).toBe('15');
      const unitSelect = getByLabelText('Unit') as HTMLSelectElement;
      expect(unitSelect.value).toBe('minutes');
    });

    test('round-tripping presets -> cron -> presets -> cron preserves a committed cron edit', async () => {
      // A cron field edit only re-seeds mode fields against the last COMMITTED
      // value (not the untouched default of whichever mode happens to be
      // active), so a valid edit survives bouncing through presets and back.
      const { getByLabelText, getByRole } = render(ScheduleBuilder, {});

      await fireEvent.click(getByRole('tab', { name: 'Cron' }));
      const minuteField = getByLabelText('Minute') as HTMLInputElement;
      await fireEvent.input(minuteField, { target: { value: '0' } });
      expect(minuteField.value).toBe('0');

      await fireEvent.click(getByRole('tab', { name: 'Presets' }));
      await fireEvent.click(getByRole('tab', { name: 'Cron' }));

      expect((getByLabelText('Minute') as HTMLInputElement).value).toBe('0');
    });
  });

  describe('presets mode', () => {
    test('presets "every" kind commits an interval value via onchange', async () => {
      const onchange = mock();
      const { getByLabelText } = render(ScheduleBuilder, { onchange });

      const everyInput = getByLabelText('Every') as HTMLInputElement;
      await fireEvent.input(everyInput, { target: { value: '30' } });
      await fireEvent.blur(everyInput);

      expect(onchange).toHaveBeenCalledTimes(1);
      const [emitted] = onchange.mock.calls[0]!;
      expect(emitted).toEqual({ mode: 'interval', every: 30, unit: 'minutes' });
    });

    test('coerces a fractional "every" to a positive integer before emitting', async () => {
      const onchange = mock();
      const { getByLabelText } = render(ScheduleBuilder, { onchange });

      const everyInput = getByLabelText('Every') as HTMLInputElement;
      await fireEvent.input(everyInput, { target: { value: '2.5' } });
      await fireEvent.blur(everyInput);

      // The emitted `every` must always be a positive integer — no fractional leak.
      const [emitted] = onchange.mock.calls.at(-1)! as [{ mode: string; every: number }];
      expect(emitted.mode).toBe('interval');
      expect(Number.isInteger(emitted.every)).toBe(true);
      expect(emitted.every).toBeGreaterThanOrEqual(1);
    });

    test('presets "every" unit select commits an interval value via onchange', async () => {
      const onchange = mock();
      const { getByLabelText } = render(ScheduleBuilder, { onchange });

      const unitSelect = getByLabelText('Unit') as HTMLSelectElement;
      await fireEvent.change(unitSelect, { target: { value: 'hours' } });

      expect(onchange).toHaveBeenCalledTimes(1);
      expect(onchange.mock.calls[0]![0]).toEqual({ mode: 'interval', every: 15, unit: 'hours' });
    });

    test('presets "daily at" commits a cron value via onchange', async () => {
      const onchange = mock();
      const { container, getByLabelText, getByRole } = render(ScheduleBuilder, { onchange });

      await fireEvent.click(getByRole('radio', { name: 'Daily' }));
      // Switching preset kind commits immediately with that kind's current
      // fields (default time 09:00) — see "preset-kind switch commits an
      // onchange" below for a dedicated assertion on that behavior.
      expect(onchange).toHaveBeenCalledTimes(1);
      expect(onchange.mock.calls[0]![0]).toEqual({ mode: 'cron', expression: '0 9 * * *' });

      const timeInput = container.querySelector<HTMLInputElement>('#' + getByLabelText('At').id)!;
      await fireEvent.change(timeInput, { target: { value: '09:15' } });

      expect(onchange).toHaveBeenCalledTimes(2);
      const [emitted] = onchange.mock.calls[1]!;
      expect(emitted).toEqual({ mode: 'cron', expression: '15 9 * * *' });
    });

    test('clearing a Daily time keeps the prior time in the emitted value and in the field, instead of silently becoming midnight', async () => {
      const onchange = mock();
      const { container, getByLabelText, getByRole } = render(ScheduleBuilder, { onchange });

      await fireEvent.click(getByRole('radio', { name: 'Daily' }));
      const timeInput = container.querySelector<HTMLInputElement>('#' + getByLabelText('At').id)!;
      await fireEvent.change(timeInput, { target: { value: '09:15' } });
      onchange.mockClear();

      // Clear the field. A real clear fires `input` before `change` (the
      // browser updates the value live, then commits on blur); firing both,
      // in order, is what lets TimeField's own input-mirror state settle
      // back to the bound value once the empty edit is rejected.
      await fireEvent.input(timeInput, { target: { value: '' } });
      await fireEvent.change(timeInput, { target: { value: '' } });

      // Must NOT silently commit midnight, and must NOT emit at all — nothing
      // actually changed from the component's point of view.
      expect(onchange).not.toHaveBeenCalled();
      expect(container.querySelector('.cinder-schedule-builder__summary-text')?.textContent).toBe(
        'Daily at 09:15',
      );
      // The field itself must re-assert the prior time rather than staying
      // blank, so it never visually diverges from the emitted/summarized value.
      expect(timeInput.value).toBe('09:15');
    });

    test('presets "weekly on" toggling a day and committing a time emits a cron value with the selected day', async () => {
      const onchange = mock();
      const { getByLabelText, getByRole } = render(ScheduleBuilder, { onchange });

      await fireEvent.click(getByRole('radio', { name: 'Weekly' }));
      expect(onchange).toHaveBeenCalledTimes(1);
      expect(onchange.mock.calls[0]![0]).toEqual({ mode: 'cron', expression: '0 9 * * *' });

      await fireEvent.click(getByRole('button', { name: 'Monday' }));

      expect(onchange).toHaveBeenCalledTimes(2);
      expect(onchange.mock.calls[1]![0]).toEqual({ mode: 'cron', expression: '0 9 * * 1' });

      const timeInput = getByLabelText('At') as HTMLInputElement;
      await fireEvent.change(timeInput, { target: { value: '10:00' } });

      expect(onchange).toHaveBeenCalledTimes(3);
      expect(onchange.mock.calls[2]![0]).toEqual({ mode: 'cron', expression: '0 10 * * 1' });
    });

    test('weekly day chip toggles pressed state and can be deselected', async () => {
      const { getByRole } = render(ScheduleBuilder, {});

      await fireEvent.click(getByRole('radio', { name: 'Weekly' }));
      const mondayChip = getByRole('button', { name: 'Monday' });
      expect(mondayChip.getAttribute('aria-pressed')).toBe('false');

      await fireEvent.click(mondayChip);
      expect(mondayChip.getAttribute('aria-pressed')).toBe('true');

      await fireEvent.click(mondayChip);
      expect(mondayChip.getAttribute('aria-pressed')).toBe('false');
    });

    test('presets "monthly on day" commits a cron value with the day and time', async () => {
      const onchange = mock();
      const { getByLabelText, getByRole } = render(ScheduleBuilder, { onchange });

      await fireEvent.click(getByRole('radio', { name: 'Monthly' }));
      expect(onchange).toHaveBeenCalledTimes(1);
      // presetMonthlyDay defaults to 1, presetMonthlyTime defaults to '09:00'.
      expect(onchange.mock.calls[0]![0]).toEqual({ mode: 'cron', expression: '0 9 1 * *' });

      const dayInput = getByLabelText('Day of month') as HTMLInputElement;
      await fireEvent.input(dayInput, { target: { value: '15' } });
      await fireEvent.blur(dayInput);

      expect(onchange).toHaveBeenCalledTimes(2);
      expect(onchange.mock.calls[1]![0]).toEqual({ mode: 'cron', expression: '0 9 15 * *' });
    });

    test("preset-kind switch commits an onchange with that kind's current fields", async () => {
      const onchange = mock();
      const { getByRole } = render(ScheduleBuilder, { onchange });

      // Default kind is "every" (interval); switching to another kind changes
      // the derived value immediately, so it must emit — unlike the top-level
      // authoring-mode tabs, there is no "browsing an empty panel" state here.
      await fireEvent.click(getByRole('radio', { name: 'Daily' }));

      expect(onchange).toHaveBeenCalledTimes(1);
      expect(onchange.mock.calls[0]![0]).toEqual({ mode: 'cron', expression: '0 9 * * *' });
    });

    test('re-selecting the already-active preset kind does not emit a redundant onchange', async () => {
      const onchange = mock();
      const { getByRole } = render(ScheduleBuilder, { onchange });

      await fireEvent.click(getByRole('radio', { name: 'Every N' }));

      expect(onchange).not.toHaveBeenCalled();
    });

    test('presets never emit mode: "preset" — only cron or interval', async () => {
      const onchange = mock();
      const { getByLabelText, getByRole } = render(ScheduleBuilder, { onchange });

      // every
      await fireEvent.change(getByLabelText('Unit') as HTMLSelectElement, {
        target: { value: 'hours' },
      });
      // daily
      await fireEvent.click(getByRole('radio', { name: 'Daily' }));
      await fireEvent.change(getByLabelText('At') as HTMLInputElement, {
        target: { value: '08:00' },
      });
      // weekly
      await fireEvent.click(getByRole('radio', { name: 'Weekly' }));
      await fireEvent.click(getByRole('button', { name: 'Friday' }));
      // monthly
      await fireEvent.click(getByRole('radio', { name: 'Monthly' }));
      const dayInput = getByLabelText('Day of month') as HTMLInputElement;
      await fireEvent.input(dayInput, { target: { value: '1' } });
      await fireEvent.blur(dayInput);

      expect(onchange).toHaveBeenCalled();
      for (const call of onchange.mock.calls) {
        const emitted = call[0] as ScheduleValue;
        expect(['cron', 'interval']).toContain(emitted.mode);
      }
    });
  });

  describe('interval mode', () => {
    test('emits an interval value when the every field is committed', async () => {
      const onchange = mock();
      const { getByLabelText, getByRole } = render(ScheduleBuilder, { onchange });

      await fireEvent.click(getByRole('tab', { name: 'Interval' }));
      const everyInput = getByLabelText('Every') as HTMLInputElement;
      await fireEvent.input(everyInput, { target: { value: '5' } });
      await fireEvent.blur(everyInput);

      expect(onchange).toHaveBeenCalledTimes(1);
      expect(onchange.mock.calls[0]![0]).toEqual({ mode: 'interval', every: 5, unit: 'minutes' });
    });

    test('emits an interval value when the unit select changes', async () => {
      const onchange = mock();
      const { getByLabelText, getByRole } = render(ScheduleBuilder, { onchange });

      await fireEvent.click(getByRole('tab', { name: 'Interval' }));
      const unitSelect = getByLabelText('Unit') as HTMLSelectElement;
      await fireEvent.change(unitSelect, { target: { value: 'weeks' } });

      expect(onchange).toHaveBeenCalledTimes(1);
      expect(onchange.mock.calls[0]![0]).toEqual({ mode: 'interval', every: 15, unit: 'weeks' });
    });
  });

  describe('cron mode', () => {
    test('a valid cron field edit commits a joined cron expression via onchange', async () => {
      const onchange = mock();
      const { getByLabelText, getByRole } = render(ScheduleBuilder, { onchange });

      await fireEvent.click(getByRole('tab', { name: 'Cron' }));
      const minuteField = getByLabelText('Minute') as HTMLInputElement;
      await fireEvent.input(minuteField, { target: { value: '0' } });

      expect(onchange).toHaveBeenCalledTimes(1);
      expect(onchange.mock.calls[0]![0]).toEqual({
        mode: 'cron',
        expression: '0 * * * *',
      });
    });

    test('an out-of-range cron field surfaces an inline error and does not call onchange', async () => {
      const onchange = mock();
      const { getByLabelText, getByRole } = render(ScheduleBuilder, { onchange });

      await fireEvent.click(getByRole('tab', { name: 'Cron' }));
      const hourField = getByLabelText('Hour') as HTMLInputElement;
      await fireEvent.input(hourField, { target: { value: '99' } });

      expect(hourField.getAttribute('aria-invalid')).toBe('true');
      const describedBy = hourField.getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();
      const errorNode = document.getElementById(
        describedBy!.split(' ').find((id) => id.includes('error')) ?? '',
      );
      expect(errorNode?.textContent).toBe('Out of range (0–23).');
      expect(onchange).not.toHaveBeenCalled();
    });

    test('correcting an invalid cron field back to valid resumes emitting onchange', async () => {
      const onchange = mock();
      const { getByLabelText, getByRole } = render(ScheduleBuilder, { onchange });

      await fireEvent.click(getByRole('tab', { name: 'Cron' }));
      const hourField = getByLabelText('Hour') as HTMLInputElement;
      await fireEvent.input(hourField, { target: { value: '99' } });
      expect(onchange).not.toHaveBeenCalled();

      await fireEvent.input(hourField, { target: { value: '9' } });
      expect(onchange).toHaveBeenCalledTimes(1);
      expect(onchange.mock.calls[0]![0]).toEqual({ mode: 'cron', expression: '*/15 9 * * *' });
    });

    test('cron field description carries its numeric hint', async () => {
      const { getByLabelText, getByRole } = render(ScheduleBuilder, {});

      await fireEvent.click(getByRole('tab', { name: 'Cron' }));

      const minuteField = getByLabelText('Minute') as HTMLInputElement;
      const describedBy = minuteField.getAttribute('aria-describedby') ?? '';
      const hintId = describedBy.split(' ')[0] ?? '';
      expect(document.getElementById(hintId)?.textContent).toBe('0–59');
    });
  });

  describe('summary line', () => {
    test('reflects the default value', () => {
      const { container } = render(ScheduleBuilder, {});
      const summary = container.querySelector('.cinder-schedule-builder__summary-text');
      expect(summary?.textContent).toBe('Every 15 minutes');
    });

    test('updates live as interval fields change', async () => {
      const { container, getByLabelText, getByRole } = render(ScheduleBuilder, {});

      await fireEvent.click(getByRole('tab', { name: 'Interval' }));
      const unitSelect = getByLabelText('Unit') as HTMLSelectElement;
      await fireEvent.change(unitSelect, { target: { value: 'hours' } });

      const summary = container.querySelector('.cinder-schedule-builder__summary-text');
      expect(summary?.textContent).toBe('Every 15 hours');
    });

    test('reflects a controlled initial cron value immediately, without opening the Cron tab', () => {
      // A cron `value` opens directly in Cron mode (see "initial authoring mode"
      // below), so the real value is seeded and described on the very first
      // render instead of showing the presets "every N" default.
      const value: ScheduleValue = { mode: 'cron', expression: '0 9 * * 1' };
      const { container } = render(ScheduleBuilder, { value });
      const summary = container.querySelector('.cinder-schedule-builder__summary-text');
      expect(summary?.textContent).toBe('Weekly on Monday at 09:00');
    });
  });

  describe('next-fires preview', () => {
    test('is hidden entirely when computeNextFires is absent', () => {
      const { container } = render(ScheduleBuilder, {});
      expect(container.querySelector('.cinder-schedule-builder__preview')).toBeNull();
    });

    test('does not crash when computeNextFires is absent and fields change', async () => {
      const { container, getByRole } = render(ScheduleBuilder, {});
      await fireEvent.click(getByRole('tab', { name: 'Cron' }));
      expect(container.querySelector('.cinder-schedule-builder')).not.toBeNull();
    });

    test('renders fires returned from an injected computeNextFires', () => {
      const computeNextFires = stubComputeNextFires();
      const { container, getAllByRole } = render(ScheduleBuilder, { computeNextFires });

      expect(computeNextFires).toHaveBeenCalled();
      const [calledValue, calledCount] = computeNextFires.mock.calls[0]!;
      expect(calledValue).toEqual({ mode: 'interval', every: 15, unit: 'minutes' });
      expect(calledCount).toBe(5);

      const items = getAllByRole('listitem');
      expect(items.map((item) => item.textContent)).toEqual([
        'Mon Jun 1, 09:00',
        'Tue Jun 2, 09:00',
      ]);
      expect(container.querySelector('.cinder-schedule-builder__preview')).not.toBeNull();
    });

    test('shows an empty state when computeNextFires returns no fires', () => {
      const computeNextFires = stubComputeNextFires([]);
      const { container } = render(ScheduleBuilder, { computeNextFires });

      expect(container.querySelector('.cinder-schedule-builder__preview-list')).toBeNull();
      expect(container.textContent).toContain('No upcoming fires.');
    });

    test('passes a custom previewCount through to computeNextFires', () => {
      const computeNextFires = stubComputeNextFires();
      render(ScheduleBuilder, { computeNextFires, previewCount: 3 });

      expect(computeNextFires.mock.calls[0]![1]).toBe(3);
    });

    test('does not call computeNextFires while a cron field is invalid, and shows an unavailable message', async () => {
      const computeNextFires = stubComputeNextFires();
      const { container, getByLabelText, getByRole } = render(ScheduleBuilder, {
        computeNextFires,
      });

      await fireEvent.click(getByRole('tab', { name: 'Cron' }));
      computeNextFires.mockClear();

      const hourField = getByLabelText('Hour') as HTMLInputElement;
      await fireEvent.input(hourField, { target: { value: '99' } });

      expect(computeNextFires).not.toHaveBeenCalled();
      expect(container.textContent).toContain(
        'Preview unavailable — fix the cron expression above.',
      );
      expect(container.querySelector('.cinder-schedule-builder__preview-list')).toBeNull();
    });

    test('resumes calling computeNextFires once the cron field is corrected back to valid', async () => {
      const computeNextFires = stubComputeNextFires();
      const { getByLabelText, getByRole } = render(ScheduleBuilder, { computeNextFires });

      await fireEvent.click(getByRole('tab', { name: 'Cron' }));
      const hourField = getByLabelText('Hour') as HTMLInputElement;
      await fireEvent.input(hourField, { target: { value: '99' } });
      computeNextFires.mockClear();

      await fireEvent.input(hourField, { target: { value: '9' } });

      expect(computeNextFires).toHaveBeenCalledTimes(1);
      expect(computeNextFires.mock.calls[0]![0]).toEqual({
        mode: 'cron',
        expression: '*/15 9 * * *',
      });
    });

    test('degrades to an unavailable message instead of crashing when computeNextFires throws', () => {
      const computeNextFires = mock(() => {
        throw new Error('boom');
      });
      const { container } = render(ScheduleBuilder, { computeNextFires });

      expect(container.querySelector('.cinder-schedule-builder')).not.toBeNull();
      expect(container.textContent).toContain('Preview unavailable.');
      expect(container.querySelector('.cinder-schedule-builder__preview-list')).toBeNull();
    });
  });

  describe('timezone slot', () => {
    test('renders nothing but a placeholder when neither timezone nor timezoneLabel is supplied', () => {
      const { container } = render(ScheduleBuilder, {});
      const timezoneBlock = container.querySelector('.cinder-schedule-builder__timezone');
      expect(timezoneBlock?.textContent?.trim()).toContain('Not set');
    });

    test('renders timezoneLabel text', () => {
      const { container } = render(ScheduleBuilder, { timezoneLabel: 'America/New_York' });
      const timezoneBlock = container.querySelector('.cinder-schedule-builder__timezone');
      expect(timezoneBlock?.textContent).toContain('America/New_York');
    });

    test('renders the timezone snippet, taking precedence over timezoneLabel', () => {
      const { container } = render(ScheduleBuilder, {
        timezoneLabel: 'UTC',
        timezone: textSnippet('Custom timezone content'),
      });
      const timezoneBlock = container.querySelector('.cinder-schedule-builder__timezone');
      expect(timezoneBlock?.textContent).toContain('Custom timezone content');
      expect(timezoneBlock?.textContent).not.toContain('UTC');
    });
  });

  describe('accessibility', () => {
    test('mode switch is a tablist with three tabs', () => {
      const { getByRole } = render(ScheduleBuilder, {});
      const tablist = getByRole('tablist');
      expect(tablist).not.toBeNull();
      expect(getByRole('tab', { name: 'Presets' })).not.toBeNull();
      expect(getByRole('tab', { name: 'Cron' })).not.toBeNull();
      expect(getByRole('tab', { name: 'Interval' })).not.toBeNull();
    });

    test('the active mode panel is a labeled tabpanel', () => {
      const { container, getByRole } = render(ScheduleBuilder, {});
      const panel = container.querySelector('[role="tabpanel"]');
      const presetsTab = getByRole('tab', { name: 'Presets' });
      expect(panel?.getAttribute('aria-labelledby')).toBe(presetsTab.id);
    });

    test('keyboard: mode tabs are activated via arrow keys and Enter (native tab semantics)', async () => {
      const { getByRole } = render(ScheduleBuilder, {});
      const presetsTab = getByRole('tab', { name: 'Presets' });
      const cronTab = getByRole('tab', { name: 'Cron' });

      presetsTab.focus();
      await fireEvent.keyDown(presetsTab, { key: 'ArrowRight' });

      expect(cronTab.getAttribute('aria-selected')).toBe('true');
    });

    test('weekday chips are native buttons with aria-pressed (guarantees Enter/Space activation)', async () => {
      const { getByRole } = render(ScheduleBuilder, {});
      await fireEvent.click(getByRole('radio', { name: 'Weekly' }));
      const chip = getByRole('button', { name: 'Monday' });
      expect(chip.tagName).toBe('BUTTON');
      expect(chip.hasAttribute('aria-pressed')).toBe(true);
    });
  });

  describe('CSS snapshot', () => {
    test('CSS file exists, is non-empty, and declares its cascade layer', async () => {
      const { readFileSync } = await import('node:fs');
      const css = readFileSync(new URL('./schedule-builder.css', import.meta.url), 'utf8');
      expect(css).toContain('cinder-schedule-builder');
      expect(css).toContain('@layer cinder.components');
    });
  });
});
