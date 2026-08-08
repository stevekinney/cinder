<script lang="ts" module>
  /**
   * @cinder
   * @category form
   * @status alpha
   * @purpose Controlled date picker that combines a text field, calendar-trigger button, floating calendar grid, and optional time controls.
   * @tag form
   * @tag date
   * @tag calendar
   * @useWhen Collecting a date with consistent cross-browser UI and keyboard support.
   * @useWhen Collecting local datetime values while keeping ISO strings as the controlled model.
   * @avoidWhen Browser-native date controls are acceptable and custom styling is unnecessary.
   * @related calendar, date-range-field, popover
   */
  export type { DatePickerGranularity, DatePickerProps } from './date-picker.types.ts';
</script>

<script lang="ts">
  import type { DatePickerProps } from './date-picker.types.ts';
  import { normalizeDateValue as normalizeValue } from '../../_internal/date-value.ts';
  import FormFieldFrame from '../../_internal/form-field-frame.svelte';
  import { classNames } from '../../utilities/class-names.ts';
  import Calendar from '../calendar/calendar.svelte';
  import Popover from '../popover/popover.svelte';

  let {
    id,
    value = $bindable<string | undefined>(undefined),
    label,
    placeholder = 'YYYY-MM-DD',
    granularity = 'day',
    min,
    max,
    description,
    error,
    disabled = false,
    class: className,
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': ariaInvalid,
    onValueChange,
    triggerLabel = 'Open',
    ...rest
  }: DatePickerProps = $props();

  let open = $state(false);
  let inputElement = $state<HTMLInputElement | null>(null);
  let triggerElement = $state<HTMLButtonElement | null>(null);

  const normalizedValue = $derived(normalizeValue(value, granularity));
  const normalizedMin = $derived(normalizeValue(min, granularity));
  const normalizedMax = $derived(normalizeValue(max, granularity));
  const selectedDate = $derived(normalizedValue?.slice(0, 10));
  const selectedTime = $derived(
    granularity === 'day'
      ? undefined
      : (normalizedValue?.slice(11) ??
          (granularity === 'second' ? '00:00:00' : granularity === 'minute' ? '00:00' : '00:00')),
  );
  let hasInputValidityError = $state(false);
  const step = $derived(granularity === 'second' ? 1 : granularity === 'minute' ? 60 : 3600);
  const invalid = $derived(
    error || hasInputValidityError
      ? 'true'
      : ariaInvalid === true || ariaInvalid === 'true'
        ? 'true'
        : undefined,
  );
  const resolvedPlaceholder = $derived(
    placeholder === 'YYYY-MM-DD' && granularity !== 'day'
      ? granularity === 'hour'
        ? 'YYYY-MM-DDTHH:00'
        : granularity === 'minute'
          ? 'YYYY-MM-DDTHH:mm'
          : 'YYYY-MM-DDTHH:mm:ss'
      : placeholder,
  );

  function updateInputValidity(element: HTMLInputElement): void {
    const current = element.value;
    const normalizedCurrent = normalizeValue(current || undefined, granularity);
    const valid =
      current === '' ||
      (normalizedCurrent === current && clampToBounds(normalizedCurrent) === normalizedCurrent);
    hasInputValidityError = !valid;
    element.setCustomValidity(valid ? '' : 'Enter a valid date within the allowed range.');
  }

  $effect(() => {
    normalizedValue;
    if (!inputElement) return;
    updateInputValidity(inputElement);
  });

  $effect(() => {
    if (!inputElement) return;
    const element = inputElement;
    const form = element.form;
    if (!form) return;

    function handleFormReset(): void {
      queueMicrotask(() => {
        if (inputElement !== element) return;
        value = normalizeValue(element.value || undefined, granularity);
        updateInputValidity(element);
      });
    }

    form.addEventListener('reset', handleFormReset);
    return () => {
      form.removeEventListener('reset', handleFormReset);
    };
  });

  const describedById = $derived(
    [
      ariaDescribedBy,
      description ? `${id}-description` : undefined,
      error ? `${id}-error` : undefined,
    ]
      .filter(Boolean)
      .join(' ') || undefined,
  );

  $effect(() => {
    if (value === normalizedValue) return;
    emit(normalizedValue);
  });

  function emit(next: string | undefined) {
    value = next;
    onValueChange?.(next);
  }

  function clampToBounds(next: string | undefined): string | undefined {
    if (!next) return undefined;
    if (normalizedMin && next < normalizedMin) return normalizedMin;
    if (normalizedMax && next > normalizedMax) return normalizedMax;
    return next;
  }

  function handleCalendarChange(nextDate: string) {
    if (granularity === 'day') {
      emit(clampToBounds(nextDate));
      open = false;
      return;
    }
    const existingTime = selectedTime ?? (granularity === 'second' ? '00:00:00' : '00:00');
    emit(clampToBounds(normalizeValue(`${nextDate}T${existingTime}`, granularity)));
  }

  function handleTimeChange(event: Event) {
    const target = event.currentTarget as HTMLInputElement;
    if (!selectedDate) return;
    emit(clampToBounds(normalizeValue(`${selectedDate}T${target.value}`, granularity)));
  }

  function handleInputChange(event: Event) {
    const target = event.currentTarget as HTMLInputElement;
    const pattern =
      granularity === 'day' ? /^\d{4}-\d{2}-\d{2}$/ : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/;
    updateInputValidity(target);
    const nextValue = pattern.test(target.value)
      ? clampToBounds(normalizeValue(target.value, granularity))
      : undefined;
    if (nextValue !== value) emit(nextValue);
    else if (nextValue !== undefined && target.value !== nextValue) {
      target.value = nextValue;
      updateInputValidity(target);
    }
  }

  function handleInput(event: Event) {
    const target = event.currentTarget as HTMLInputElement;
    updateInputValidity(target);
    const normalizedDraft = normalizeValue(target.value || undefined, granularity);
    if (
      (normalizedDraft === target.value || target.value === '') &&
      clampToBounds(normalizedDraft) === normalizedDraft &&
      normalizedDraft !== value
    ) {
      emit(normalizedDraft);
    }
  }

  function focusCalendarDay(panel: HTMLElement, date = selectedDate): HTMLElement | null {
    return (
      (date &&
        panel.querySelector<HTMLElement>(
          `.cinder-calendar__day[id$="-day-${date}"]:not([disabled])`,
        )) ||
      panel.querySelector(
        '.cinder-calendar__day[data-focused], .cinder-calendar__day[tabindex="0"]',
      )
    );
  }

  const timeMin = $derived.by(() => {
    if (granularity === 'day' || !selectedDate || !normalizedMin) return undefined;
    if (!normalizedMin.startsWith(`${selectedDate}T`)) return undefined;
    return normalizedMin.slice(11);
  });
  const timeMax = $derived.by(() => {
    if (granularity === 'day' || !selectedDate || !normalizedMax) return undefined;
    if (!normalizedMax.startsWith(`${selectedDate}T`)) return undefined;
    return normalizedMax.slice(11);
  });
</script>

{#snippet dateControl()}
  <div class="cinder-date-picker__control" data-invalid={invalid ? '' : undefined}>
    <input
      bind:this={inputElement}
      class="cinder-date-picker__input"
      {id}
      type="text"
      value={normalizedValue ?? ''}
      min={normalizedMin}
      max={normalizedMax}
      step={granularity === 'day' ? undefined : step}
      placeholder={resolvedPlaceholder}
      {disabled}
      aria-invalid={invalid}
      aria-describedby={describedById}
      oninput={handleInput}
      onchange={handleInputChange}
    />
    <button
      bind:this={triggerElement}
      type="button"
      class="cinder-date-picker__trigger"
      aria-label={label ? `Open ${label} calendar` : 'Open date picker'}
      {disabled}
      onclick={() => {
        if (!disabled) open = true;
      }}
    >
      {triggerLabel}
    </button>
  </div>

  <Popover
    bind:open
    triggerRef={triggerElement ?? inputElement}
    role="dialog"
    label={label ? `${label} calendar` : 'Date picker calendar'}
    focusManagement="panel"
    initialFocus={focusCalendarDay}
    outsideClickIgnoreRefs={[() => inputElement]}
    widthMode="content"
    class="cinder-date-picker__panel"
  >
    <Calendar
      value={selectedDate}
      min={normalizedMin?.slice(0, 10)}
      max={normalizedMax?.slice(0, 10)}
      onValueChange={handleCalendarChange}
      {disabled}
    />
    {#if granularity !== 'day'}
      <div class="cinder-date-picker__time">
        <label class="cinder-date-picker__time-label" for={`${id}-time`}>Time</label>
        <input
          id={`${id}-time`}
          class="cinder-date-picker__time-input"
          type="time"
          {step}
          value={selectedTime}
          min={timeMin}
          max={timeMax}
          disabled={disabled || !selectedDate}
          onchange={handleTimeChange}
        />
      </div>
    {/if}
  </Popover>
{/snippet}

<FormFieldFrame
  {...rest}
  {id}
  {label}
  {description}
  {error}
  {disabled}
  class={classNames('cinder-date-picker', className)}
  labelClass="cinder-date-picker__label"
  descriptionClass="cinder-date-picker__description"
  errorClass="cinder-date-picker__error"
  control={dateControl}
/>
