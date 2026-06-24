<script lang="ts" module>
  /**
   * @cinder
   * @category form
   * @status stable
   * @purpose Standalone time-of-day field that collects a canonical time string with optional timezone selection.
   * @tag form
   * @tag time
   * @tag internationalization
   * @useWhen Collecting a time of day without a date, such as a reminder time or office-hours boundary.
   * @useWhen Pairing a time value with an optional timezone while keeping a canonical `HH:mm` or `HH:mm:ss` value.
   * @avoidWhen Collecting a full date range — use date-range-field instead.
   * @related date-range-field, number-input
   */
  export type {
    TimeFieldChange,
    TimeFieldGranularity,
    TimeFieldProps,
  } from './time-field.types.ts';
</script>

<script lang="ts">
  import { untrack } from 'svelte';

  import { getFormFieldContext } from '../../_internal/form-field-context.ts';
  import { parseTimeString, serializeTimeParts } from '../../_internal/time-parts.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import type { TimeFieldProps } from './time-field.types.ts';

  let {
    id,
    value = $bindable<string | undefined>(undefined),
    defaultValue = '',
    granularity = 'minute',
    timezones,
    timezone = $bindable<string | undefined>(undefined),
    timezoneName,
    label,
    description,
    error,
    disabled = false,
    readonly = false,
    required = false,
    name,
    class: className,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': consumerDescribedBy,
    onchange,
    ...rest
  }: TimeFieldProps = $props();

  const formField = getFormFieldContext();
  untrack(() => {
    if (value === undefined) value = defaultValue;
    if (timezone === undefined && timezones && timezones.length > 0) timezone = timezones[0];
  });
  const initialTimezone = untrack(() => timezone);

  $effect(() => {
    if (!timezones || timezones.length === 0) {
      if (timezone !== undefined) timezone = undefined;
      return;
    }
    if (timezone === undefined || !timezones.includes(timezone)) {
      timezone = timezones[0];
    }
  });

  const includeSeconds = $derived(granularity === 'second');
  const inputStep = $derived(includeSeconds ? 1 : 60);

  const inputId = $derived(formField?.controlId ?? id);
  const labelId = $derived(label ? `${id}-label` : formField?.labelId);
  const localIdBase = $derived(formField ? `${id}-time-field` : id);
  const descriptionId = $derived(description ? `${localIdBase}-description` : undefined);
  const errorId = $derived(error ? `${localIdBase}-error` : undefined);
  const describedBy = $derived(
    [formField?.describedBy, consumerDescribedBy, descriptionId, errorId]
      .filter(Boolean)
      .join(' ') || undefined,
  );
  const invalid = $derived(error || formField?.invalid ? 'true' : undefined);
  const resolvedDisabled = $derived(disabled || (formField?.disabled ?? false));
  const resolvedRequired = $derived(required || (formField?.required ?? false));
  const inputAriaLabel = $derived(
    label || formField?.labelId ? undefined : normalizeAriaText(ariaLabel),
  );
  const inputAriaLabelledBy = $derived(
    label ? undefined : normalizeAriaText(ariaLabelledBy ?? formField?.labelId),
  );
  const resolvedTimezoneName = $derived(
    timezones && timezones.length > 0 && timezone !== undefined
      ? (timezoneName ?? (name ? `${name}-timezone` : undefined))
      : undefined,
  );

  function emit(nextValue: string, nextTimezone = timezone): void {
    onchange?.({ value: nextValue, timezone: nextTimezone });
  }

  function normalizeAriaText(text: string | undefined | null): string | undefined {
    return typeof text === 'string' && text.trim().length > 0 ? text : undefined;
  }

  function resetTimezoneFor(options: readonly string[] | undefined): string | undefined {
    if (!options || options.length === 0) return undefined;
    return initialTimezone && options.includes(initialTimezone) ? initialTimezone : options[0];
  }

  function handleInputChange(event: Event): void {
    if (resolvedDisabled || readonly) return;
    const target = event.currentTarget as HTMLInputElement;
    const parsed = parseTimeString(target.value);
    const nextValue = parsed ? serializeTimeParts(parsed, includeSeconds) : target.value;
    value = nextValue;
    emit(nextValue);
  }

  function handleTimezoneChange(event: Event): void {
    if (resolvedDisabled || readonly) return;
    const target = event.currentTarget as HTMLSelectElement;
    timezone = target.value;
    emit(value ?? '', timezone);
  }

  $effect(() => {
    const input = document.getElementById(inputId);
    const form = input instanceof HTMLInputElement ? input.form : null;
    if (!form) return;
    const resetValue = defaultValue;
    const resetTimezone = resetTimezoneFor(timezones);

    const handleReset = () => {
      if (resolvedDisabled) return;
      value = resetValue;
      timezone = resetTimezone;
    };

    form.addEventListener('reset', handleReset);
    return () => form.removeEventListener('reset', handleReset);
  });
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
      value={value ?? ''}
      step={inputStep}
      {name}
      disabled={resolvedDisabled}
      {readonly}
      required={resolvedRequired}
      aria-label={inputAriaLabel}
      aria-labelledby={inputAriaLabelledBy}
      aria-describedby={describedBy}
      aria-invalid={invalid}
      onchange={handleInputChange}
    />

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
      {#if resolvedTimezoneName}
        <input
          type="hidden"
          name={resolvedTimezoneName}
          value={timezone ?? ''}
          disabled={resolvedDisabled}
        />
      {/if}
    {/if}
  </div>

  {#if description}
    <p id={descriptionId} class="cinder-time-field__description">{description}</p>
  {/if}

  {#if error}
    <p id={errorId} class="cinder-time-field__error" aria-live="polite">{error}</p>
  {/if}
</div>
