<script lang="ts" module>
  /**
   * @cinder
   * @category form
   * @status stable
   * @purpose Standalone time-of-day field that collects a canonical time string with locale-aware hour-cycle defaults and optional timezone selection.
   * @tag form
   * @tag time
   * @tag internationalization
   * @useWhen Collecting a time of day without a date, such as a reminder time or office-hours boundary.
   * @useWhen Pairing a time value with an optional timezone while keeping a canonical `HH:mm` or `HH:mm:ss` value.
   * @avoidWhen Collecting a full date range — use date-range-field instead.
   * @related date-range-field, number-input
   */
  export type {
    HourCycle,
    TimeFieldChange,
    TimeFieldGranularity,
    TimeFieldProps,
  } from './time-field.types.ts';
</script>

<script lang="ts">
  import { untrack } from 'svelte';

  import { getFormFieldContext } from '../../_internal/form-field-context.ts';
  import { getLocaleContext } from '../../_internal/locale-context.ts';
  import {
    displayHourFromTwentyFourHour,
    parseTimeString,
    resolveHourCycle,
    serializeTimeParts,
    twentyFourHourFromDisplayHour,
  } from '../../_internal/time-parts.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import type { TimeFieldProps } from './time-field.types.ts';

  let {
    id,
    value = $bindable(''),
    defaultValue = '',
    locale,
    hourCycle,
    granularity = 'minute',
    timezones,
    timezone = $bindable<string | undefined>(undefined),
    label,
    description,
    error,
    disabled = false,
    readonly = false,
    required = false,
    name,
    class: className,
    onchange,
    ...rest
  }: TimeFieldProps = $props();

  const formField = getFormFieldContext();
  const localeContext = getLocaleContext();

  untrack(() => {
    if (value === '' && defaultValue !== '') value = defaultValue;
    if (timezone === undefined && timezones && timezones.length > 0) timezone = timezones[0];
  });

  const resolvedLocale = $derived(locale ?? localeContext?.locale);
  const resolvedHourCycle = $derived(resolveHourCycle(hourCycle, resolvedLocale));
  const includeSeconds = $derived(granularity === 'second');
  const inputStep = $derived(includeSeconds ? 1 : 60);
  const parsedValue = $derived(value ? parseTimeString(value) : null);
  const displayHour = $derived(
    parsedValue ? displayHourFromTwentyFourHour(parsedValue.hours, resolvedHourCycle) : null,
  );
  const showPeriod = $derived(resolvedHourCycle === 'h11' || resolvedHourCycle === 'h12');
  const selectedPeriod = $derived(displayHour?.period ?? 'AM');

  const inputId = $derived(formField?.controlId ?? id);
  const labelId = $derived(label ? `${id}-label` : formField?.labelId);
  const descriptionId = $derived(description ? `${id}-description` : undefined);
  const errorId = $derived(error ? `${id}-error` : undefined);
  const describedBy = $derived(
    [formField?.describedBy, descriptionId, errorId].filter(Boolean).join(' ') || undefined,
  );
  const invalid = $derived(error || formField?.invalid ? 'true' : undefined);
  const resolvedDisabled = $derived(disabled || (formField?.disabled ?? false));
  const resolvedRequired = $derived(required || (formField?.required ?? false));

  function emit(nextValue: string, nextTimezone = timezone): void {
    onchange?.({ value: nextValue, timezone: nextTimezone });
  }

  function handleInputChange(event: Event): void {
    const target = event.currentTarget as HTMLInputElement;
    const parsed = parseTimeString(target.value);
    const nextValue = parsed ? serializeTimeParts(parsed, includeSeconds) : target.value;
    value = nextValue;
    emit(nextValue);
  }

  function handlePeriodChange(event: Event): void {
    if (!parsedValue) return;
    const target = event.currentTarget as HTMLSelectElement;
    const period = target.value === 'PM' ? 'PM' : 'AM';
    const nextHours = twentyFourHourFromDisplayHour(
      displayHour?.hour ?? 12,
      period,
      resolvedHourCycle,
    );
    const nextValue = serializeTimeParts({ ...parsedValue, hours: nextHours }, includeSeconds);
    value = nextValue;
    emit(nextValue);
  }

  function handleTimezoneChange(event: Event): void {
    const target = event.currentTarget as HTMLSelectElement;
    timezone = target.value;
    emit(value, timezone);
  }
</script>

<div {...rest} class={classNames('cinder-time-field', className)}>
  {#if label}
    <label id={labelId} class="cinder-time-field__label" for={inputId}>{label}</label>
  {/if}

  <div class="cinder-time-field__controls">
    <input
      id={inputId}
      class="cinder-time-field__input"
      type="time"
      {value}
      step={inputStep}
      {name}
      disabled={resolvedDisabled}
      {readonly}
      required={resolvedRequired}
      aria-describedby={describedBy}
      aria-invalid={invalid}
      onchange={handleInputChange}
    />

    {#if showPeriod}
      <select
        class="cinder-time-field__period"
        aria-label="Period"
        value={selectedPeriod}
        disabled={resolvedDisabled || readonly}
        onchange={handlePeriodChange}
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    {/if}

    {#if timezones && timezones.length > 0}
      <select
        class="cinder-time-field__timezone"
        aria-label="Timezone"
        value={timezone}
        disabled={resolvedDisabled || readonly}
        onchange={handleTimezoneChange}
      >
        {#each timezones as option (option)}
          <option value={option}>{option}</option>
        {/each}
      </select>
    {/if}
  </div>

  {#if description}
    <p id={descriptionId} class="cinder-time-field__description">{description}</p>
  {/if}

  {#if error}
    <p id={errorId} class="cinder-time-field__error">{error}</p>
  {/if}
</div>
