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
  import CalendarDays from 'lucide-svelte/icons/calendar-days';
  import type { Attachment } from 'svelte/attachments';
  import type {
    DateRangeDatePreset,
    DateRangeFieldProps,
    DateRangeGranularity,
    DateRangeValue,
  } from './date-range-field.types.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { normalizeDateValue } from '../../_internal/date-value.ts';
  import Calendar from '../calendar/calendar.svelte';
  import Grid from '../grid/grid.svelte';
  import Input from '../input/input.svelte';
  import Popover from '../popover/popover.svelte';
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
    disabledDate,
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
  let calendarOpen = $state(false);
  let calendarTrigger = $state<HTMLButtonElement | null>(null);
  let startInputInvalid = $state(false);
  let endInputInvalid = $state(false);
  let calendarTimeSnapshot = $state({ start: '', end: '' });
  let startInputElement = $state<HTMLInputElement | null>(null);
  let endInputElement = $state<HTMLInputElement | null>(null);

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
    const boundedStart =
      nextStart && normalizedValue.end && nextStart > normalizedValue.end
        ? normalizedValue.end
        : nextStart;
    const next = normalizeDateRangeValue(
      {
        start: boundedStart,
        end: value.end,
      },
      granularity,
    );
    selectedPresetSnapshot = null;
    value = next;
    onValueChange?.(next);
  }

  function handleEndChange(nextEnd: string | undefined) {
    const boundedEnd =
      nextEnd && normalizedValue.start && nextEnd < normalizedValue.start
        ? normalizedValue.start
        : nextEnd;
    const next = normalizeDateRangeValue(
      {
        start: value.start,
        end: boundedEnd,
      },
      granularity,
    );
    selectedPresetSnapshot = null;
    value = next;
    onValueChange?.(next);
  }

  function timeSuffix(endpoint: string | undefined): string {
    if (granularity === 'day') return '';
    const existing = endpoint?.slice(10);
    if (existing) return existing;
    if (granularity === 'second') return 'T00:00:00';
    return 'T00:00';
  }

  function attachInputElement(endpoint: 'start' | 'end'): Attachment<HTMLInputElement> {
    return (element) => {
      if (endpoint === 'start') startInputElement = element;
      else endInputElement = element;

      return () => {
        if (endpoint === 'start' && startInputElement === element) startInputElement = null;
        if (endpoint === 'end' && endInputElement === element) endInputElement = null;
      };
    };
  }

  const startInputAttachment = attachInputElement('start');
  const endInputAttachment = attachInputElement('end');

  function clearDraftValidity(): void {
    startInputInvalid = false;
    endInputInvalid = false;
    startInputElement?.setCustomValidity('');
    endInputElement?.setCustomValidity('');
  }

  function clampSameDayEndTime(next: DateRangeValue): DateRangeValue {
    if (granularity === 'day' || !next.start || !next.end) return next;
    if (next.start.slice(0, 10) !== next.end.slice(0, 10)) return next;
    if (next.end >= next.start) return next;
    return { start: next.start, end: next.start };
  }

  function openCalendar(): void {
    if (disabled) return;
    calendarTimeSnapshot = { start: timeSuffix(value.start), end: timeSuffix(value.end) };
    calendarOpen = true;
  }
  function handleInputDraft(event: Event, endpoint: 'start' | 'end'): void {
    const input = event.currentTarget as HTMLInputElement;
    const draft = input.value;
    const normalized = normalizeDateValue(draft || undefined, granularity);
    const invalid = draft.length > 0 && !normalized;
    input.setCustomValidity(invalid ? `Enter a valid ${inputPlaceholder}.` : '');
    if (endpoint === 'start') startInputInvalid = invalid;
    else endInputInvalid = invalid;
    if (invalid) return;
    if (endpoint === 'start') handleStartChange(normalized);
    else handleEndChange(normalized);
  }
  function handleCalendarTimeChange(endpoint: 'start' | 'end', time: string): void {
    const date = normalizedValue[endpoint]?.slice(0, 10);
    if (!date) return;
    const suffix = time ? `T${time}` : timeSuffix(undefined);
    if (endpoint === 'start') {
      calendarTimeSnapshot.start = suffix;
      handleStartChange(`${date}${suffix}`);
    } else {
      calendarTimeSnapshot.end = suffix;
      handleEndChange(`${date}${suffix}`);
    }
  }

  function handleCalendarRangeChange(next: {
    start: string | undefined;
    end: string | undefined;
  }): void {
    if (!next.start) return;
    const nextValue = clampSameDayEndTime(
      normalizeDateRangeValue(
        {
          start: `${next.start}${calendarTimeSnapshot.start || timeSuffix(value.start)}`,
          end: next.end
            ? `${next.end}${calendarTimeSnapshot.end || timeSuffix(value.end)}`
            : undefined,
        },
        granularity,
      ),
    );
    selectedPresetSnapshot = null;
    clearDraftValidity();
    value = nextValue;
    onValueChange?.(nextValue);
    if (next.end && granularity === 'day') calendarOpen = false;
  }

  function focusCalendarDay(panel: HTMLElement): HTMLElement | null {
    return panel.querySelector(
      '.cinder-calendar__day[data-range-start], .cinder-calendar__day[data-focused], .cinder-calendar__day[tabindex="0"]',
    );
  }

  const hasError = $derived(!!error);
  const inputStep = $derived(
    granularity === 'day'
      ? undefined
      : granularity === 'second'
        ? 1
        : granularity === 'minute'
          ? 60
          : 3600,
  );
  const inputPlaceholder = $derived(
    granularity === 'day'
      ? 'YYYY-MM-DD'
      : granularity === 'hour'
        ? 'YYYY-MM-DDTHH:00'
        : granularity === 'minute'
          ? 'YYYY-MM-DDTHH:mm'
          : 'YYYY-MM-DDTHH:mm:ss',
  );
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
    <Input
      id={startId}
      class="cinder-date-picker__input cinder-date-range-field__date-input"
      type="text"
      label={resolvedStartLabel}
      value={normalizedValue.start ?? ''}
      placeholder={inputPlaceholder}
      max={normalizedValue.end ?? undefined}
      step={inputStep}
      inputAttachment={startInputAttachment}
      {disabled}
      aria-invalid={hasError || startInputInvalid ? 'true' : undefined}
      aria-describedby={describedBy}
      onchange={(event) => handleInputDraft(event, 'start')}
    />

    <span class="cinder-date-range-field__separator" aria-hidden="true">–</span>

    <Input
      id={endId}
      class="cinder-date-picker__input cinder-date-range-field__date-input"
      type="text"
      label={resolvedEndLabel}
      value={normalizedValue.end ?? ''}
      placeholder={inputPlaceholder}
      min={normalizedValue.start ?? undefined}
      step={inputStep}
      inputAttachment={endInputAttachment}
      {disabled}
      aria-invalid={hasError || endInputInvalid ? 'true' : undefined}
      aria-describedby={describedBy}
      onchange={(event) => handleInputDraft(event, 'end')}
    />

    <button
      bind:this={calendarTrigger}
      type="button"
      class="cinder-date-picker__trigger cinder-date-range-field__calendar-trigger"
      aria-label="Open date range calendar"
      {disabled}
      onclick={openCalendar}
    >
      <CalendarDays class="cinder-icon-sm" aria-hidden="true" />
    </button>
  </div>

  <Popover
    bind:open={calendarOpen}
    triggerRef={calendarTrigger}
    role="dialog"
    label={label ? `${label} calendar` : 'Date range calendar'}
    focusManagement="panel"
    initialFocus={focusCalendarDay}
    widthMode="content"
    class="cinder-date-range-field__calendar-panel"
  >
    <Calendar
      selectionMode="range"
      rangeStart={normalizedValue.start?.slice(0, 10)}
      rangeEnd={normalizedValue.end?.slice(0, 10)}
      value={normalizedValue.end?.slice(0, 10) ?? normalizedValue.start?.slice(0, 10)}
      onRangeChange={handleCalendarRangeChange}
      {...disabledDate ? { disabledDate } : {}}
      {disabled}
    />
    {#if granularity !== 'day'}
      <Grid
        columns="repeat(2, minmax(0, 1fr))"
        gap="var(--cinder-space-3)"
        class="cinder-date-range-field__time-controls"
        role="group"
        aria-label="Range times"
      >
        <Input
          id={`${id}-start-time`}
          type="time"
          label={resolvedStartLabel}
          step={inputStep}
          value={normalizedValue.start?.slice(11) ?? ''}
          {disabled}
          onchange={(event) =>
            handleCalendarTimeChange('start', (event.currentTarget as HTMLInputElement).value)}
        />
        <Input
          id={`${id}-end-time`}
          type="time"
          label={resolvedEndLabel}
          step={inputStep}
          value={normalizedValue.end?.slice(11) ?? ''}
          disabled={disabled || !normalizedValue.end}
          onchange={(event) =>
            handleCalendarTimeChange('end', (event.currentTarget as HTMLInputElement).value)}
        />
      </Grid>
    {/if}
  </Popover>

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
