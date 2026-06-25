<script lang="ts" module>
  /**
   * @cinder
   * @category form
   * @status stable
   * @purpose Controlled start/end date range picker with preset shortcuts and validation feedback for time-window filtering.
   * @tag form
   * @tag date
   * @tag filter
   * @useWhen Filtering a list or dashboard by a start and end date (e.g. created between, updated between).
   * @useWhen Offering common presets (last 7 days, last 24 hours) alongside a manual date range.
   * @avoidWhen A single date is sufficient — use a plain date input instead.
   * @avoidWhen Timezone conversion or a standalone time-of-day value is required — use time-field for the latter.
   * @related input, form-field, chip, segmented-control
   */
  export type {
    DateRangeDatePreset,
    DateRangeFieldProps,
    DateRangeGranularity,
    DateRangeValue,
  } from './date-range-field.types.ts';
</script>

<script lang="ts">
  import type {
    DateRangeDatePreset,
    DateRangeFieldProps,
    DateRangeGranularity,
    DateRangeValue,
  } from './date-range-field.types.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import {
    ariaInvalid,
    composeDescribedBy,
    describeId,
    errorId as buildErrorId,
  } from '../../_internal/field-control.ts';

  let {
    id,
    value = $bindable<DateRangeValue>({ start: undefined, end: undefined }),
    label,
    startLabel,
    endLabel,
    granularity = 'day',
    presets,
    hidePresets = false,
    description,
    error,
    disabled = false,
    class: className,
    onchange,
    'aria-describedby': consumerDescribedBy,
    ...rest
  }: DateRangeFieldProps = $props();

  // ──────────────────────────────────────────────────────────────────────────
  // Built-in default presets evaluated at call time so they are always current.
  // ──────────────────────────────────────────────────────────────────────────
  const defaultPresets: DateRangeDatePreset[] = [
    {
      id: 'today',
      label: 'Today',
      resolve: () => {
        const now = new Date();
        return {
          start: formatDateRangePresetValue(startOfDay(now), granularity),
          end: formatDateRangePresetEndValue(now, granularity),
        };
      },
    },
    {
      // Date-only granularity: a rolling 24-hour window can't be expressed as a
      // YYYY-MM-DD pair, so this is the honest calendar-date equivalent —
      // yesterday through today — labeled accordingly rather than "Last 24h".
      id: 'yesterday-today',
      label: 'Yesterday & today',
      resolve: () => {
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        return {
          start: formatDateRangePresetValue(startOfDay(yesterday), granularity),
          end: formatDateRangePresetEndValue(now, granularity),
        };
      },
    },
    {
      id: 'last-7d',
      label: 'Last 7 days',
      resolve: () => {
        const now = new Date();
        const sixDaysAgo = new Date(now);
        sixDaysAgo.setDate(now.getDate() - 6);
        return {
          start: formatDateRangePresetValue(startOfDay(sixDaysAgo), granularity),
          end: formatDateRangePresetEndValue(now, granularity),
        };
      },
    },
  ];

  const resolvedPresets = $derived(presets ?? defaultPresets);
  let selectedPresetSnapshot = $state<{
    id: string;
    value: DateRangeValue;
  } | null>(null);

  // ──────────────────────────────────────────────────────────────────────────
  // Accessible IDs
  // ──────────────────────────────────────────────────────────────────────────
  const generatedId = $props.id();
  const rootId = $derived(id ?? generatedId);
  const startId = $derived(`${rootId}-start`);
  const endId = $derived(`${rootId}-end`);
  const legendId = $derived(label ? `${rootId}-legend` : undefined);
  const descriptionId = $derived(describeId(rootId, !!description));
  const errId = $derived(buildErrorId(rootId, !!error));
  const describedBy = $derived(composeDescribedBy(descriptionId, errId, consumerDescribedBy));

  // ──────────────────────────────────────────────────────────────────────────
  // Active preset tracking: which preset (if any) matches the current controlled value.
  // ──────────────────────────────────────────────────────────────────────────
  const activePresetId = $derived.by(() => {
    if (selectedPresetSnapshot && dateRangeValuesMatch(selectedPresetSnapshot.value, value)) {
      return selectedPresetSnapshot.id;
    }

    const match = resolvedPresets.find((preset) => {
      const resolved = normalizeDateRangeValue(preset.resolve(), granularity);
      return dateRangeValuesMatch(resolved, value);
    });
    return match?.id;
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Utilities
  // ──────────────────────────────────────────────────────────────────────────
  function toISODate(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function startOfDay(date: Date): Date {
    const next = new Date(date);
    next.setHours(0, 0, 0, 0);
    return next;
  }

  function toISODateTime(date: Date, nextGranularity: DateRangeGranularity): string {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    if (nextGranularity === 'hour') return `${toISODate(date)}T${hours}:00`;
    const base = `${toISODate(date)}T${hours}:${minutes}`;
    if (nextGranularity === 'second') {
      return `${base}:${String(date.getSeconds()).padStart(2, '0')}`;
    }
    return base;
  }

  function formatDateRangePresetValue(date: Date, nextGranularity: DateRangeGranularity): string {
    return nextGranularity === 'day' ? toISODate(date) : toISODateTime(date, nextGranularity);
  }

  function endOfActiveHour(date: Date): Date {
    const next = new Date(date);
    if (next.getMinutes() > 0 || next.getSeconds() > 0 || next.getMilliseconds() > 0) {
      next.setHours(Math.min(next.getHours() + 1, 23), 0, 0, 0);
    }
    return next;
  }

  function formatDateRangePresetEndValue(
    date: Date,
    nextGranularity: DateRangeGranularity,
  ): string {
    return formatDateRangePresetValue(
      nextGranularity === 'hour' ? endOfActiveHour(date) : date,
      nextGranularity,
    );
  }

  function dateRangeValuesMatch(left: DateRangeValue, right: DateRangeValue): boolean {
    return left.start === right.start && left.end === right.end;
  }

  function inputTypeFor(nextGranularity: DateRangeGranularity): 'date' | 'datetime-local' {
    return nextGranularity === 'day' ? 'date' : 'datetime-local';
  }

  function inputStepFor(nextGranularity: DateRangeGranularity): number | undefined {
    if (nextGranularity === 'hour') return 3600;
    if (nextGranularity === 'minute') return 60;
    if (nextGranularity === 'second') return 1;
    return undefined;
  }

  function normalizeInputValue(
    nextValue: string,
    nextGranularity: DateRangeGranularity,
  ): string | undefined {
    if (!nextValue) return undefined;
    if (nextGranularity === 'day') return nextValue.slice(0, 10);
    const datePart = nextValue.slice(0, 10);
    const timePart = nextValue.includes('T') ? nextValue.slice(11) : '';
    const [rawHour = '00', rawMinute = '00', rawSecond = '00'] = timePart.split(':');
    const hour = rawHour.padStart(2, '0').slice(0, 2);
    const minute = rawMinute.padStart(2, '0').slice(0, 2);
    const second = rawSecond.padStart(2, '0').slice(0, 2);
    if (nextGranularity === 'hour') return `${datePart}T${hour}:00`;
    if (nextGranularity === 'minute') return `${datePart}T${hour}:${minute}`;
    return `${datePart}T${hour}:${minute}:${second}`;
  }

  function normalizeDateRangeValue(
    nextValue: DateRangeValue,
    nextGranularity: DateRangeGranularity,
  ): DateRangeValue {
    return {
      start: nextValue.start ? normalizeInputValue(nextValue.start, nextGranularity) : undefined,
      end: nextValue.end ? normalizeInputValue(nextValue.end, nextGranularity) : undefined,
    };
  }

  const inputType = $derived(inputTypeFor(granularity));
  const inputStep = $derived(inputStepFor(granularity));
  const defaultStartLabel = $derived(granularity === 'day' ? 'Start date' : 'Start date and time');
  const defaultEndLabel = $derived(granularity === 'day' ? 'End date' : 'End date and time');
  const resolvedStartLabel = $derived(startLabel ?? defaultStartLabel);
  const resolvedEndLabel = $derived(endLabel ?? defaultEndLabel);

  // ──────────────────────────────────────────────────────────────────────────
  // Event handlers
  // ──────────────────────────────────────────────────────────────────────────
  function handlePresetClick(preset: DateRangeDatePreset) {
    if (disabled) return;
    const next = normalizeDateRangeValue(preset.resolve(), granularity);
    selectedPresetSnapshot = { id: preset.id, value: next };
    value = next;
    onchange?.(next);
  }

  function handleStartChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const next: DateRangeValue = {
      start: normalizeInputValue(target.value, granularity),
      end: value.end,
    };
    selectedPresetSnapshot = null;
    value = next;
    onchange?.(next);
  }

  function handleEndChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const next: DateRangeValue = {
      start: value.start,
      end: normalizeInputValue(target.value, granularity),
    };
    selectedPresetSnapshot = null;
    value = next;
    onchange?.(next);
  }

  const hasError = $derived(!!error);
  const invalid = $derived(ariaInvalid(hasError));
</script>

<div
  {...rest}
  class={classNames('cinder-date-range-field', className)}
  role="group"
  aria-labelledby={legendId}
>
  {#if label}
    <p id={legendId} class="cinder-date-range-field__legend" data-disabled={disabled || undefined}>
      {label}
    </p>
  {/if}

  {#if !hidePresets}
    <div
      class="cinder-date-range-field__presets"
      role="group"
      aria-label="Date range presets"
      aria-disabled={disabled || undefined}
    >
      {#each resolvedPresets as preset (preset.id)}
        <button
          type="button"
          class="cinder-date-range-field__preset-btn"
          aria-pressed={activePresetId === preset.id}
          {disabled}
          onclick={() => handlePresetClick(preset)}
        >
          {preset.label}
        </button>
      {/each}
    </div>
  {/if}

  <div class="cinder-date-range-field__inputs">
    <div class="cinder-date-range-field__input-group">
      <label
        for={startId}
        class="cinder-date-range-field__input-label"
        data-disabled={disabled || undefined}
      >
        {resolvedStartLabel}
      </label>
      <input
        id={startId}
        type={inputType}
        class="cinder-date-range-field__date-input"
        value={value.start ?? ''}
        max={value.end ?? undefined}
        step={inputStep}
        {disabled}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onchange={handleStartChange}
      />
    </div>

    <span class="cinder-date-range-field__separator" aria-hidden="true">–</span>

    <div class="cinder-date-range-field__input-group">
      <label
        for={endId}
        class="cinder-date-range-field__input-label"
        data-disabled={disabled || undefined}
      >
        {resolvedEndLabel}
      </label>
      <input
        id={endId}
        type={inputType}
        class="cinder-date-range-field__date-input"
        value={value.end ?? ''}
        min={value.start ?? undefined}
        step={inputStep}
        {disabled}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onchange={handleEndChange}
      />
    </div>
  </div>

  {#if description}
    <p id={descriptionId} class="cinder-date-range-field__description">{description}</p>
  {/if}

  <!-- Always in DOM so screen readers pick up the live region before text is injected. -->
  <p
    id={errId}
    class="cinder-date-range-field__error"
    aria-live="polite"
    data-cinder-error={hasError || undefined}
  >
    {error ?? ''}
  </p>
</div>
