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
   * @avoidWhen Date-time precision (hours/minutes/timezone) is required — this v1 is date-only.
   * @related input, form-field, chip, segmented-control
   */
  export type {
    DateRangeDatePreset,
    DateRangeFieldProps,
    DateRangeValue,
  } from './date-range-field.types.ts';
</script>

<script lang="ts">
  import type {
    DateRangeDatePreset,
    DateRangeFieldProps,
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
    startLabel = 'Start date',
    endLabel = 'End date',
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
        return { start: toISODate(now), end: toISODate(now) };
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
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        return { start: toISODate(yesterday), end: toISODate(now) };
      },
    },
    {
      id: 'last-7d',
      label: 'Last 7 days',
      resolve: () => {
        const now = new Date();
        const sixDaysAgo = new Date(now);
        sixDaysAgo.setDate(now.getDate() - 6);
        return { start: toISODate(sixDaysAgo), end: toISODate(now) };
      },
    },
  ];

  const resolvedPresets = $derived(presets ?? defaultPresets);

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
    const match = resolvedPresets.find((preset) => {
      const resolved = preset.resolve();
      return resolved.start === value.start && resolved.end === value.end;
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

  // ──────────────────────────────────────────────────────────────────────────
  // Event handlers
  // ──────────────────────────────────────────────────────────────────────────
  function handlePresetClick(preset: DateRangeDatePreset) {
    if (disabled) return;
    const next = preset.resolve();
    value = next;
    onchange?.(next);
  }

  function handleStartChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const next: DateRangeValue = { start: target.value || undefined, end: value.end };
    value = next;
    onchange?.(next);
  }

  function handleEndChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const next: DateRangeValue = { start: value.start, end: target.value || undefined };
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
        {startLabel}
      </label>
      <input
        id={startId}
        type="date"
        class="cinder-date-range-field__date-input"
        value={value.start ?? ''}
        max={value.end ?? undefined}
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
        {endLabel}
      </label>
      <input
        id={endId}
        type="date"
        class="cinder-date-range-field__date-input"
        value={value.end ?? ''}
        min={value.start ?? undefined}
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
