<script lang="ts" module>
  /**
   * @cinder
   * @category form
   * @status alpha
   * @purpose Controlled date picker that combines a text trigger, floating calendar grid, and optional time controls.
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
  import type { DatePickerGranularity, DatePickerProps } from './date-picker.types.ts';
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
    onchange,
    ...rest
  }: DatePickerProps = $props();

  let open = $state(false);
  let inputElement = $state<HTMLInputElement | null>(null);
  let triggerElement = $state<HTMLButtonElement | null>(null);

  function isLeapYear(year: number): boolean {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  }

  function daysInMonth(year: number, month: number): number {
    if (month === 2) return isLeapYear(year) ? 29 : 28;
    if ([4, 6, 9, 11].includes(month)) return 30;
    return 31;
  }

  function isValidDatePart(datePart: string): boolean {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
    if (!match) return false;
    const [, rawYear, rawMonth, rawDay] = match;
    const year = Number(rawYear);
    const monthValue = Number(rawMonth);
    const day = Number(rawDay);
    return monthValue >= 1 && monthValue <= 12 && day >= 1 && day <= daysInMonth(year, monthValue);
  }

  function isValidTimePart(timePart: string): boolean {
    const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(timePart);
    if (!match) return false;
    const [, rawHour, rawMinute, rawSecond = '00'] = match;
    const hour = Number(rawHour);
    const minute = Number(rawMinute);
    const second = Number(rawSecond);
    return hour <= 23 && minute <= 59 && second <= 59;
  }

  function normalizeValue(
    nextValue: string | undefined,
    nextGranularity: DatePickerGranularity,
  ): string | undefined {
    if (!nextValue) return undefined;
    const datePart = nextValue.slice(0, 10);
    if (!isValidDatePart(datePart)) return undefined;
    if (nextGranularity === 'day') return datePart;
    const timePart =
      nextValue.length === 10 ? '00:00' : nextValue[10] === 'T' ? nextValue.slice(11) : undefined;
    if (!timePart || !isValidTimePart(timePart)) return undefined;
    const [rawHour = '00', rawMinute = '00', rawSecond = '00'] = timePart.split(':');
    const hour = rawHour.padStart(2, '0').slice(0, 2);
    const minute = rawMinute.padStart(2, '0').slice(0, 2);
    const second = rawSecond.padStart(2, '0').slice(0, 2);
    if (nextGranularity === 'hour') return `${datePart}T${hour}:00`;
    if (nextGranularity === 'minute') return `${datePart}T${hour}:${minute}`;
    return `${datePart}T${hour}:${minute}:${second}`;
  }

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
  const step = $derived(granularity === 'second' ? 1 : granularity === 'minute' ? 60 : 3600);
  const inputType = $derived(granularity === 'day' ? 'date' : 'datetime-local');
  const invalid = $derived(
    error ? 'true' : ariaInvalid === true || ariaInvalid === 'true' ? 'true' : undefined,
  );
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
    value = normalizedValue;
  });

  function emit(next: string | undefined) {
    value = next;
    onchange?.(next);
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
    emit(clampToBounds(normalizeValue(target.value, granularity)));
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

<div {...rest} class={classNames('cinder-date-picker', className)}>
  {#if label}
    <label class="cinder-date-picker__label" for={id}>{label}</label>
  {/if}

  <div class="cinder-date-picker__control" data-invalid={invalid ? '' : undefined}>
    <input
      bind:this={inputElement}
      class="cinder-date-picker__input"
      {id}
      type={inputType}
      value={normalizedValue ?? ''}
      min={normalizedMin}
      max={normalizedMax}
      step={granularity === 'day' ? undefined : step}
      {placeholder}
      {disabled}
      aria-invalid={invalid}
      aria-describedby={describedById}
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
      Open
    </button>
  </div>

  <Popover
    bind:open
    triggerRef={triggerElement ?? inputElement}
    role="dialog"
    label={label ? `${label} calendar` : 'Date picker calendar'}
    focusManagement="preserve"
    widthMode="content"
    class="cinder-date-picker__panel"
  >
    <Calendar
      value={selectedDate}
      min={normalizedMin?.slice(0, 10)}
      max={normalizedMax?.slice(0, 10)}
      onchange={handleCalendarChange}
      {disabled}
    />
    {#if granularity !== 'day'}
      <div class="cinder-date-picker__time">
        <span class="cinder-date-picker__time-label">Time</span>
        <input
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

  {#if description}
    <p id={`${id}-description`} class="cinder-date-picker__description">{description}</p>
  {/if}
  {#if error}
    <p id={`${id}-error`} class="cinder-date-picker__error" aria-live="polite">{error}</p>
  {/if}
</div>
