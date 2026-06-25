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

  import { resolveFieldControl } from '../../_internal/field-control.ts';
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
    'aria-invalid': consumerAriaInvalid,
    onchange,
    ...rest
  }: TimeFieldProps = $props();

  const formField = getFormFieldContext();
  const includeSeconds = $derived(granularity === 'second');
  const inputStep = $derived(includeSeconds ? 1 : 60);
  let inputMirrorValue = $state<string | undefined>(undefined);
  const submittedValue = $derived(canonicalTimeValue(inputMirrorValue ?? value));
  let resetTimezoneBaseline = $state<string | undefined>(undefined);
  let skipTimezoneBaselineUpdate = false;

  untrack(() => {
    if (value === undefined) value = canonicalTimeValue(defaultValue);
    if (timezone === undefined && timezones && timezones.length > 0) timezone = timezones[0];
    resetTimezoneBaseline = timezone;
  });

  $effect(() => {
    if (!timezones || timezones.length === 0) {
      return;
    }
    if (timezone === undefined || !timezones.includes(timezone)) {
      timezone = timezones[0];
    }
  });

  $effect(() => {
    if (skipTimezoneBaselineUpdate) {
      skipTimezoneBaselineUpdate = false;
      return;
    }
    resetTimezoneBaseline = timezone;
  });

  $effect(() => {
    if (value === undefined) return;
    const nextValue = canonicalTimeValue(value);
    if (value === nextValue) return;
    inputMirrorValue = undefined;
    value = nextValue;
  });

  const generatedId = $props.id();
  const field = $derived(
    resolveFieldControl({
      id: formField?.controlId ?? id,
      generatedId,
      context: formField,
      localIdNamespace: 'time-field',
      hasDescription: !!description,
      hasError: !!error,
      consumerDescribedBy,
      consumerInvalid: consumerAriaInvalid,
      required: required ? true : undefined,
      disabled: disabled ? true : undefined,
    }),
  );
  const inputId = $derived(field.id);
  const labelId = $derived(label ? `${inputId}-label` : formField?.labelId);
  const timezoneLabelId = $derived(`${inputId}-timezone-label`);
  const descriptionId = $derived(field.ownDescriptionId);
  const errorId = $derived(field.ownErrorId);
  const describedBy = $derived(field.describedBy);
  const invalid = $derived(field.ariaInvalid);
  const resolvedDisabled = $derived(field.disabled);
  const resolvedRequired = $derived(field.required);
  const inputAriaLabel = $derived(
    label || formField?.labelId ? undefined : normalizeAriaText(ariaLabel),
  );
  const inputAriaLabelledBy = $derived(
    label ? undefined : (normalizeAriaText(ariaLabelledBy) ?? formField?.labelId),
  );
  const timezoneAriaLabelledBy = $derived(
    labelId
      ? `${labelId} ${timezoneLabelId}`
      : inputAriaLabelledBy
        ? `${inputAriaLabelledBy} ${timezoneLabelId}`
        : undefined,
  );
  const timezoneAriaLabel = $derived(
    timezoneAriaLabelledBy ? undefined : inputAriaLabel ? `${inputAriaLabel} timezone` : 'Timezone',
  );
  const resolvedTimezoneName = $derived(
    timezone !== undefined ? (timezoneName ?? (name ? `${name}-timezone` : undefined)) : undefined,
  );

  function emit(nextValue: string, nextTimezone = timezone): void {
    onchange?.({ value: nextValue, timezone: nextTimezone });
  }

  function normalizeAriaText(text: string | undefined | null): string | undefined {
    return typeof text === 'string' && text.trim().length > 0 ? text : undefined;
  }

  function resetTimezoneFor(options: readonly string[] | undefined): string | undefined {
    if (!options || options.length === 0) return resetTimezoneBaseline;
    return resetTimezoneBaseline && options.includes(resetTimezoneBaseline)
      ? resetTimezoneBaseline
      : options[0];
  }

  function canonicalTimeValue(nextValue: string | undefined): string {
    if (!nextValue) return '';
    const parsed = parseTimeString(nextValue);
    return parsed ? serializeTimeParts(parsed, includeSeconds) : '';
  }

  function handleInputChange(event: Event): void {
    if (resolvedDisabled || readonly) return;
    const target = event.currentTarget as HTMLInputElement;
    const nextValue = canonicalTimeValue(target.value);
    inputMirrorValue = undefined;
    value = nextValue;
    emit(nextValue);
  }

  function handleInput(event: Event): void {
    if (resolvedDisabled || readonly) return;
    inputMirrorValue = (event.currentTarget as HTMLInputElement).value;
  }

  function handleTimezoneChange(event: Event): void {
    if (resolvedDisabled || readonly) return;
    const target = event.currentTarget as HTMLSelectElement;
    skipTimezoneBaselineUpdate = true;
    timezone = target.value;
    const nextValue = canonicalTimeValue(value);
    inputMirrorValue = undefined;
    value = nextValue;
    emit(nextValue, timezone);
  }

  $effect(() => {
    const input = document.getElementById(inputId);
    const form = input instanceof HTMLInputElement ? input.form : null;
    if (!form) return;
    const resetValue = canonicalTimeValue(defaultValue);
    const resetTimezone = resetTimezoneFor(timezones);

    const handleReset = () => {
      if (resolvedDisabled) return;
      inputMirrorValue = undefined;
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
      step={inputStep}
      value={value ?? ''}
      disabled={resolvedDisabled}
      {readonly}
      required={resolvedRequired}
      aria-label={inputAriaLabel}
      aria-labelledby={inputAriaLabelledBy}
      aria-describedby={describedBy}
      aria-invalid={invalid}
      oninput={handleInput}
      onchange={handleInputChange}
    />

    {#if name}
      <input type="hidden" {name} value={submittedValue} disabled={resolvedDisabled} />
    {/if}

    {#if timezones && timezones.length > 0}
      <span id={timezoneLabelId} class="cinder-sr-only">timezone</span>
      <select
        class="cinder-time-field__timezone"
        aria-label={timezoneAriaLabel}
        aria-labelledby={timezoneAriaLabelledBy}
        aria-describedby={describedBy}
        value={timezone}
        disabled={resolvedDisabled || readonly}
        onchange={handleTimezoneChange}
      >
        {#each timezones as option (option)}
          <option value={option}>{option}</option>
        {/each}
      </select>
    {/if}

    {#if resolvedTimezoneName}
      <input
        type="hidden"
        name={resolvedTimezoneName}
        value={timezone}
        disabled={resolvedDisabled}
      />
    {/if}
  </div>

  {#if description}
    <p id={descriptionId} class="cinder-time-field__description">{description}</p>
  {/if}

  {#if error}
    <p id={errorId} class="cinder-time-field__error" aria-live="polite">{error}</p>
  {/if}
</div>
