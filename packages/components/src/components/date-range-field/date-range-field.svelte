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
  import { normalizeDateValue } from '../../_internal/date-value.ts';
  import DatePicker from '../date-picker/date-picker.svelte';
  import {
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
    presetsVisible = true,
    description,
    error,
    disabled = false,
    class: className,
    onValueChange,
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
  let selectedPresetSnapshot = $state.raw<{
    id: string;
    preset: DateRangeDatePreset;
    value: DateRangeValue;
  } | null>(null);

  // ──────────────────────────────────────────────────────────────────────────
  // Accessible IDs
  // ──────────────────────────────────────────────────────────────────────────
  const startId = $derived(`${id}-start`);
  const endId = $derived(`${id}-end`);
  const legendId = $derived(label ? `${id}-legend` : undefined);
  const descriptionId = $derived(describeId(id, !!description));
  const errId = $derived(buildErrorId(id, !!error));
  const describedBy = $derived(composeDescribedBy(descriptionId, errId, consumerDescribedBy));

  // ──────────────────────────────────────────────────────────────────────────
  // Active preset tracking: which preset (if any) matches the current controlled value.
  // ──────────────────────────────────────────────────────────────────────────
  const activePresetId = $derived.by(() => {
    const normalizedValue = normalizeDateRangeValue(value, granularity);
    const snapshot = selectedPresetSnapshot;
    if (snapshot && dateRangeValuesMatch(snapshot.value, normalizedValue)) {
      const selectedPreset = resolvedPresets.find((preset) => {
        return preset.id === snapshot.id && preset === snapshot.preset;
      });
      if (selectedPreset) {
        return snapshot.id;
      }
    }

    const match = resolvedPresets.find((preset) => {
      const resolved = normalizeDateRangeValue(preset.resolve(), granularity);
      return dateRangeValuesMatch(resolved, normalizedValue);
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

  function normalizeDateRangeValue(
    nextValue: DateRangeValue,
    nextGranularity: DateRangeGranularity,
  ): DateRangeValue {
    return {
      start: nextValue.start ? normalizeDateValue(nextValue.start, nextGranularity) : undefined,
      end: nextValue.end ? normalizeDateValue(nextValue.end, nextGranularity) : undefined,
    };
  }

  const normalizedValue = $derived(normalizeDateRangeValue(value, granularity));

  $effect(() => {
    if (dateRangeValuesMatch(value, normalizedValue)) return;
    value = normalizedValue;
    onValueChange?.(normalizedValue);
  });

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
    selectedPresetSnapshot = { id: preset.id, preset, value: next };
    value = next;
    onValueChange?.(next);
  }

  function handleStartChange(nextStart: string | undefined) {
    const next = normalizeDateRangeValue(
      {
        start: nextStart,
        end: value.end,
      },
      granularity,
    );
    selectedPresetSnapshot = null;
    value = next;
    onValueChange?.(next);
  }

  function handleEndChange(nextEnd: string | undefined) {
    const next = normalizeDateRangeValue(
      {
        start: value.start,
        end: nextEnd,
      },
      granularity,
    );
    selectedPresetSnapshot = null;
    value = next;
    onValueChange?.(next);
  }

  const hasError = $derived(!!error);
</script>

<div
  {...rest}
  class={classNames('cinder-date-range-field', className)}
  role="group"
  aria-labelledby={legendId}
  aria-describedby={describedBy}
>
  {#if label}
    <p id={legendId} class="cinder-date-range-field__legend" data-disabled={disabled || undefined}>
      {label}
    </p>
  {/if}

  {#if presetsVisible}
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
      <DatePicker
        id={startId}
        class="cinder-date-range-field__date-picker"
        {granularity}
        value={normalizedValue.start}
        label={resolvedStartLabel}
        max={normalizedValue.end ?? undefined}
        {disabled}
        aria-invalid={hasError ? 'true' : undefined}
        aria-describedby={describedBy}
        onValueChange={(next) => handleStartChange(next)}
      />
    </div>

    <span class="cinder-date-range-field__separator" aria-hidden="true">–</span>

    <div class="cinder-date-range-field__input-group">
      <DatePicker
        id={endId}
        class="cinder-date-range-field__date-picker"
        {granularity}
        value={normalizedValue.end}
        label={resolvedEndLabel}
        min={normalizedValue.start ?? undefined}
        {disabled}
        aria-invalid={hasError ? 'true' : undefined}
        aria-describedby={describedBy}
        onValueChange={(next) => handleEndChange(next)}
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
