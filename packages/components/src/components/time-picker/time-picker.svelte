<script lang="ts" module>
  /**
   * @cinder
   * @category form
   * @status beta
   * @purpose Time input with optional scroll-list popover for choosing hours, minutes, seconds, and meridiem.
   * @tag form
   * @tag time
   * @useWhen Collecting a time-of-day string while keeping native form participation.
   * @useWhen Offering a keyboard-navigable chooser alongside direct typed entry.
   * @avoidWhen Collecting a date or date range — use a date-specific control instead.
   * @related input, number-input, form-field, popover
   */
  export type { TimePickerProps } from './time-picker.types.ts';
</script>

<script lang="ts">
  import type { TimePickerProps } from './time-picker.types.ts';
  import type { TimeParts } from '../../_internal/time-parts.ts';
  import { onMount, tick } from 'svelte';
  import { DEV } from 'esm-env';

  import {
    displayHourFromTwentyFourHour,
    isTimePartsInRange,
    minuteStepFromSeconds,
    normalizeTimeStep,
    normalizeTimeString,
    parseTimeString,
    rangeValues,
    resolveHourCycle,
    secondStepFromSeconds,
    serializeTimeParts,
    twentyFourHourFromDisplayHour,
  } from '../../_internal/time-parts.ts';
  import {
    ariaInvalid,
    composeDescribedBy,
    describeId,
    errorId as buildErrorId,
  } from '../../_internal/field-control.ts';
  import { getFormFieldContext } from '../../_internal/form-field-context.ts';
  import { cn } from '../../utilities/class-names.ts';
  import { handleRovingKeydown } from '../../utilities/roving-tabindex.ts';
  import Popover from '../popover/popover.svelte';

  let {
    id,
    value = $bindable(''),
    defaultValue = '',
    onchange: onValueChange,
    hourCycle,
    locale,
    seconds = false,
    min,
    max,
    step = seconds ? 1 : 60,
    disabled,
    required,
    name,
    label,
    description,
    error,
    class: className,
    ...rest
  }: TimePickerProps = $props();

  const context = getFormFieldContext();
  let hasInitializedDefaultValue = false;
  let hasMounted = $state(false);

  let inputElement: HTMLInputElement | undefined = $state();
  let toggleButton: HTMLButtonElement | undefined = $state();

  let isFocused = $state(false);
  let isOpen = $state(false);
  let editorValue = $state(value);
  let internalError = $state<string | null>(null);

  let hourFocusIndex = $state(0);
  let minuteFocusIndex = $state(0);
  let secondFocusIndex = $state(0);
  let periodFocusIndex = $state(0);

  let hourOptionElements: Array<HTMLElement | null> = $state([]);
  let minuteOptionElements: Array<HTMLElement | null> = $state([]);
  let secondOptionElements: Array<HTMLElement | null> = $state([]);
  let periodOptionElements: Array<HTMLElement | null> = $state([]);

  onMount(() => {
    hasMounted = true;
  });

  const resolvedLocale = $derived(locale ?? (hasMounted ? navigator.language : 'en-US'));
  const resolvedHourCycle = $derived(resolveHourCycle(hourCycle, resolvedLocale));
  const resolvedDisabled = $derived(disabled ?? context?.disabled ?? false);
  const resolvedRequired = $derived(required ?? context?.required ?? false);
  const resolvedStep = $derived(normalizeTimeStep(step, seconds));
  const minuteStep = $derived(minuteStepFromSeconds(resolvedStep));
  const secondStep = $derived(secondStepFromSeconds(resolvedStep));
  const minuteValues = $derived(rangeValues(minuteStep, 59));
  const secondValues = $derived(seconds ? rangeValues(secondStep, 59) : []);
  const hourValues = $derived(
    resolvedHourCycle === 'h23'
      ? Array.from({ length: 24 }, (_, index) => index)
      : resolvedHourCycle === 'h24'
        ? Array.from({ length: 24 }, (_, index) => index + 1)
        : resolvedHourCycle === 'h11'
          ? Array.from({ length: 12 }, (_, index) => index)
          : Array.from({ length: 12 }, (_, index) => index + 1),
  );
  const selectedPeriod = $derived.by<'AM' | 'PM'>(() => {
    const parsedValue = parseTimeString(editorValue) ?? { hours: 0, minutes: 0, seconds: 0 };
    return parsedValue.hours < 12 ? 'AM' : 'PM';
  });
  const periodValues = ['AM', 'PM'] as const;

  const parsedMin = $derived(min ? parseTimeString(min) : null);
  const parsedMax = $derived(max ? parseTimeString(max) : null);

  const defaultDescriptionId = $derived(describeId(id, !!description));
  const defaultErrorId = $derived(buildErrorId(id, !!error));
  const ownDescriptionId = $derived(
    description && defaultDescriptionId === context?.descriptionId
      ? `${id}-time-picker-description`
      : defaultDescriptionId,
  );
  const ownErrorId = $derived(
    error && defaultErrorId === context?.errorId ? `${id}-time-picker-error` : defaultErrorId,
  );
  const resolvedDescriptionId = $derived(ownDescriptionId ?? context?.descriptionId);
  const resolvedErrorId = $derived(ownErrorId ?? context?.errorId);
  const internalErrorId = $derived(internalError ? `${id}-time-picker-internal-error` : undefined);
  const describedBy = $derived(
    composeDescribedBy(resolvedDescriptionId, resolvedErrorId, internalErrorId),
  );
  const resolvedAriaInvalid = $derived(
    error || internalError
      ? ariaInvalid(true)
      : (context?.invalid ?? rest['aria-invalid'] ?? ariaInvalid(false)),
  );
  const isInvalid = $derived(resolvedAriaInvalid === 'true' || resolvedAriaInvalid === true);

  $effect(() => {
    if (hasInitializedDefaultValue) return;
    hasInitializedDefaultValue = true;
    if (value.length === 0 && defaultValue.length > 0) {
      value = defaultValue;
      editorValue = defaultValue;
    }
  });

  $effect(() => {
    if (resolvedDisabled && isOpen) {
      isOpen = false;
    }
  });

  $effect(() => {
    if (isFocused) return;
    editorValue = value;
  });

  $effect(() => {
    if (!DEV) return;
    if (context && context.controlId !== id) {
      console.warn(
        `[cinder/TimePicker] id mismatch: TimePicker id="${id}" but wrapping FormField expects controlId="${context.controlId}". Set the same id on both.`,
      );
    }
  });

  function setNativeValidity(message: string): void {
    inputElement?.setCustomValidity(message);
  }

  function clearInternalValidity(): void {
    internalError = null;
    setNativeValidity('');
  }

  function parseCommittedValue(rawValue: string): TimeParts | null {
    const normalizedValue = normalizeTimeString(rawValue, seconds);
    if (!normalizedValue) return null;
    return parseTimeString(normalizedValue);
  }

  function commitValue(nextValue: string, emitChange: boolean): boolean {
    if (resolvedDisabled) return false;

    if (nextValue.length === 0) {
      clearInternalValidity();
      editorValue = '';
      if (value !== '') {
        value = '';
        if (emitChange) onValueChange?.('');
      }
      return true;
    }

    const normalizedValue = normalizeTimeString(nextValue, seconds);
    if (!normalizedValue) {
      internalError = 'Please enter a valid time.';
      setNativeValidity(internalError);
      return false;
    }

    const parsedValue = parseTimeString(normalizedValue);
    if (!parsedValue) {
      internalError = 'Please enter a valid time.';
      setNativeValidity(internalError);
      return false;
    }

    if (!isTimePartsInRange(parsedValue, parsedMin, parsedMax)) {
      internalError = 'Please choose a time within the allowed range.';
      setNativeValidity(internalError);
      return false;
    }

    clearInternalValidity();
    editorValue = normalizedValue;

    if (value !== normalizedValue) {
      value = normalizedValue;
      if (emitChange) onValueChange?.(normalizedValue);
    }

    return true;
  }

  function handleInput(event: Event): void {
    editorValue = (event.currentTarget as HTMLInputElement).value;
    internalError = null;
    setNativeValidity('');
  }

  function handleBlur(): void {
    isFocused = false;
    void commitValue(editorValue, true);
  }

  function handleFocus(): void {
    isFocused = true;
  }

  function closestValueIndex(values: readonly number[], target: number): number {
    if (values.length === 0) return 0;

    const exactIndex = values.findIndex((value) => value === target);
    if (exactIndex >= 0) return exactIndex;

    let closestIndex = 0;
    let closestDistance = Math.abs((values[0] ?? target) - target);

    for (let index = 1; index < values.length; index += 1) {
      const value = values[index];
      if (value === undefined) continue;

      const distance = Math.abs(value - target);
      if (distance < closestDistance) {
        closestIndex = index;
        closestDistance = distance;
      }
    }

    return closestIndex;
  }

  function syncFocusIndicesFromValue(source: TimeParts | null): void {
    const nextValue = source ?? { hours: 0, minutes: 0, seconds: 0 };
    const displayHour = displayHourFromTwentyFourHour(nextValue.hours, resolvedHourCycle);

    hourFocusIndex = closestValueIndex(hourValues, displayHour.hour);
    minuteFocusIndex = closestValueIndex(minuteValues, nextValue.minutes);
    secondFocusIndex = closestValueIndex(secondValues, nextValue.seconds);
    periodFocusIndex = displayHour.period === 'PM' ? 1 : 0;
  }

  async function focusSelectedHourAfterOpen(): Promise<void> {
    await tick();
    await new Promise((resolve) => setTimeout(resolve, 0));
    hourOptionElements[hourFocusIndex]?.focus();
  }

  function handleToggleClick(): void {
    if (resolvedDisabled) return;

    if (!isOpen) {
      syncFocusIndicesFromValue(parseCommittedValue(editorValue) ?? parseCommittedValue(value));
      isOpen = true;
      void focusSelectedHourAfterOpen();
      return;
    }

    isOpen = false;
  }

  async function focusHourOption(index: number): Promise<void> {
    hourFocusIndex = index;
    await tick();
    hourOptionElements[index]?.focus();
  }

  async function focusMinuteOption(index: number): Promise<void> {
    minuteFocusIndex = index;
    await tick();
    minuteOptionElements[index]?.focus();
  }

  async function focusSecondOption(index: number): Promise<void> {
    secondFocusIndex = index;
    await tick();
    secondOptionElements[index]?.focus();
  }

  async function focusPeriodOption(index: number): Promise<void> {
    periodFocusIndex = index;
    await tick();
    periodOptionElements[index]?.focus();
  }

  function currentParts(): TimeParts {
    return (
      parseCommittedValue(editorValue) ??
      parseCommittedValue(value) ?? { hours: 0, minutes: 0, seconds: 0 }
    );
  }

  function selectHours(nextDisplayHour: number): void {
    const nextParts = currentParts();
    const period = selectedPeriod;

    nextParts.hours =
      resolvedHourCycle === 'h23'
        ? nextDisplayHour
        : resolvedHourCycle === 'h24'
          ? nextDisplayHour === 24
            ? 0
            : nextDisplayHour
          : twentyFourHourFromDisplayHour(nextDisplayHour, period, resolvedHourCycle);

    void commitValue(serializeTimeParts(nextParts, seconds), true);
  }

  function selectMinutes(nextMinutes: number): void {
    const nextParts = currentParts();
    nextParts.minutes = nextMinutes;
    void commitValue(serializeTimeParts(nextParts, seconds), true);
  }

  function selectSeconds(nextSeconds: number): void {
    const nextParts = currentParts();
    nextParts.seconds = nextSeconds;
    void commitValue(serializeTimeParts(nextParts, true), true);
  }

  function selectPeriod(nextPeriod: 'AM' | 'PM'): void {
    const nextParts = currentParts();
    const displayHour = displayHourFromTwentyFourHour(nextParts.hours, resolvedHourCycle);
    nextParts.hours = twentyFourHourFromDisplayHour(
      displayHour.hour,
      nextPeriod,
      resolvedHourCycle,
    );
    void commitValue(serializeTimeParts(nextParts, seconds), true);
  }

  async function handleHourKeydown(event: KeyboardEvent): Promise<void> {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectHours(hourValues[hourFocusIndex] ?? hourValues[0] ?? 0);
      return;
    }

    const nextIndex = handleRovingKeydown(event, hourFocusIndex, hourValues.length, {
      vertical: true,
      horizontal: false,
    });

    if (nextIndex !== null) {
      event.preventDefault();
      await focusHourOption(nextIndex);
    }
  }

  async function handleMinuteKeydown(event: KeyboardEvent): Promise<void> {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectMinutes(minuteValues[minuteFocusIndex] ?? minuteValues[0] ?? 0);
      return;
    }

    const nextIndex = handleRovingKeydown(event, minuteFocusIndex, minuteValues.length, {
      vertical: true,
      horizontal: false,
    });

    if (nextIndex !== null) {
      event.preventDefault();
      await focusMinuteOption(nextIndex);
    }
  }

  async function handleSecondKeydown(event: KeyboardEvent): Promise<void> {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectSeconds(secondValues[secondFocusIndex] ?? secondValues[0] ?? 0);
      return;
    }

    const nextIndex = handleRovingKeydown(event, secondFocusIndex, secondValues.length, {
      vertical: true,
      horizontal: false,
    });

    if (nextIndex !== null) {
      event.preventDefault();
      await focusSecondOption(nextIndex);
    }
  }

  async function handlePeriodKeydown(event: KeyboardEvent): Promise<void> {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectPeriod(periodValues[periodFocusIndex] ?? 'AM');
      return;
    }

    const nextIndex = handleRovingKeydown(event, periodFocusIndex, periodValues.length, {
      vertical: true,
      horizontal: false,
    });

    if (nextIndex !== null) {
      event.preventDefault();
      await focusPeriodOption(nextIndex);
    }
  }

  function handleInputKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' && !resolvedDisabled) {
      event.preventDefault();
      if (!isOpen) {
        syncFocusIndicesFromValue(parseCommittedValue(editorValue) ?? parseCommittedValue(value));
      }
      isOpen = true;
      void focusSelectedHourAfterOpen();
    }
  }

  $effect(() => {
    if (!inputElement) return;
    const form = inputElement.closest('form');
    if (!form) return;

    const onSubmit = () => {
      if (resolvedDisabled) return;
      if (isFocused) {
        void commitValue(editorValue, true);
      }
    };

    const onReset = (event: Event) => {
      if (resolvedDisabled) return;
      queueMicrotask(() => {
        if (event.defaultPrevented) return;
        clearInternalValidity();
        editorValue = defaultValue;
        value = defaultValue;
        onValueChange?.(defaultValue);
      });
    };

    form.addEventListener('submit', onSubmit, true);
    form.addEventListener('reset', onReset);

    return () => {
      form.removeEventListener('submit', onSubmit, true);
      form.removeEventListener('reset', onReset);
    };
  });

  const hourSelection = $derived(
    displayHourFromTwentyFourHour(currentParts().hours, resolvedHourCycle),
  );
</script>

{#snippet clockIcon()}
  <svg
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <circle cx="12" cy="12" r="9"></circle>
    <path d="M12 7v5l3 3"></path>
  </svg>
{/snippet}

<div class="cinder-time-picker-field">
  {#if label && !context}
    <label
      for={id}
      class="cinder-time-picker-field__label"
      data-disabled={resolvedDisabled || undefined}
    >
      {label}
    </label>
  {/if}

  <div
    class="cinder-time-picker"
    data-disabled={resolvedDisabled ? '' : undefined}
    data-invalid={isInvalid ? '' : undefined}
  >
    <input
      {...rest}
      bind:this={inputElement}
      bind:value={editorValue}
      {id}
      type="time"
      {name}
      {min}
      {max}
      step={resolvedStep}
      class={cn('cinder-input cinder-time-picker__input', className)}
      disabled={resolvedDisabled}
      required={resolvedRequired}
      aria-invalid={resolvedAriaInvalid}
      aria-describedby={describedBy}
      oninput={handleInput}
      onfocus={handleFocus}
      onblur={handleBlur}
      onkeydown={handleInputKeydown}
    />

    <button
      bind:this={toggleButton}
      type="button"
      class="cinder-time-picker__toggle"
      aria-label="Choose time"
      disabled={resolvedDisabled}
      onclick={handleToggleClick}
    >
      {@render clockIcon()}
    </button>
  </div>

  {#if description}
    <p id={ownDescriptionId} class="cinder-time-picker-field__description">{description}</p>
  {/if}

  {#if error}
    <p id={ownErrorId} class="cinder-time-picker-field__error" aria-live="polite">{error}</p>
  {:else if internalError}
    <p id={internalErrorId} class="cinder-time-picker-field__error" aria-live="polite">
      {internalError}
    </p>
  {/if}
</div>

<Popover
  bind:open={isOpen}
  triggerRef={toggleButton}
  role="dialog"
  label="Choose time"
  class="cinder-time-picker__popover"
>
  {#snippet children()}
    <div class="cinder-time-picker__columns">
      <section class="cinder-time-picker__column">
        <p class="cinder-time-picker__heading">Hours</p>
        <ul
          class="cinder-time-picker__listbox"
          role="listbox"
          aria-label="Hours"
          onkeydown={handleHourKeydown}
        >
          {#each hourValues as hourValue, index (hourValue)}
            <li class="cinder-time-picker__option-item">
              <button
                bind:this={hourOptionElements[index]}
                type="button"
                class="cinder-time-picker__option"
                role="option"
                aria-selected={hourValue === hourSelection.hour}
                tabindex={index === hourFocusIndex ? 0 : -1}
                onclick={() => {
                  hourFocusIndex = index;
                  selectHours(hourValue);
                }}
              >
                {String(hourValue).padStart(2, '0')}
              </button>
            </li>
          {/each}
        </ul>
      </section>

      <section class="cinder-time-picker__column">
        <p class="cinder-time-picker__heading">Minutes</p>
        <ul
          class="cinder-time-picker__listbox"
          role="listbox"
          aria-label="Minutes"
          onkeydown={handleMinuteKeydown}
        >
          {#each minuteValues as minuteValue, index (minuteValue)}
            <li class="cinder-time-picker__option-item">
              <button
                bind:this={minuteOptionElements[index]}
                type="button"
                class="cinder-time-picker__option"
                role="option"
                aria-selected={minuteValue === currentParts().minutes}
                tabindex={index === minuteFocusIndex ? 0 : -1}
                onclick={() => {
                  minuteFocusIndex = index;
                  selectMinutes(minuteValue);
                }}
              >
                {String(minuteValue).padStart(2, '0')}
              </button>
            </li>
          {/each}
        </ul>
      </section>

      {#if seconds}
        <section class="cinder-time-picker__column">
          <p class="cinder-time-picker__heading">Seconds</p>
          <ul
            class="cinder-time-picker__listbox"
            role="listbox"
            aria-label="Seconds"
            onkeydown={handleSecondKeydown}
          >
            {#each secondValues as secondValue, index (secondValue)}
              <li class="cinder-time-picker__option-item">
                <button
                  bind:this={secondOptionElements[index]}
                  type="button"
                  class="cinder-time-picker__option"
                  role="option"
                  aria-selected={secondValue === currentParts().seconds}
                  tabindex={index === secondFocusIndex ? 0 : -1}
                  onclick={() => {
                    secondFocusIndex = index;
                    selectSeconds(secondValue);
                  }}
                >
                  {String(secondValue).padStart(2, '0')}
                </button>
              </li>
            {/each}
          </ul>
        </section>
      {/if}

      {#if resolvedHourCycle === 'h11' || resolvedHourCycle === 'h12'}
        <section class="cinder-time-picker__column">
          <p class="cinder-time-picker__heading">AM/PM</p>
          <div class="cinder-time-picker__periods" role="radiogroup" aria-label="AM and PM">
            {#each periodValues as periodValue, index (periodValue)}
              <button
                bind:this={periodOptionElements[index]}
                type="button"
                class="cinder-time-picker__period"
                role="radio"
                aria-checked={periodValue === selectedPeriod}
                tabindex={index === periodFocusIndex ? 0 : -1}
                onkeydown={handlePeriodKeydown}
                onclick={() => {
                  periodFocusIndex = index;
                  selectPeriod(periodValue);
                }}
              >
                {periodValue}
              </button>
            {/each}
          </div>
        </section>
      {/if}
    </div>
  {/snippet}
</Popover>
