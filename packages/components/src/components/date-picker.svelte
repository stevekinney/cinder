<script lang="ts" module>
  import type { Snippet } from 'svelte';

  export type DatePickerMode = 'single' | 'range';

  export type DatePickerSingleValue = Date | null;
  export type DatePickerRangeValue = [Date, Date] | null;
  export type DatePickerValue = DatePickerSingleValue | DatePickerRangeValue;

  type DatePickerSharedProps = {
    id: string;
    label?: string;
    description?: string;
    error?: string;
    locale?: string;
    min?: Date;
    max?: Date;
    disabled?: boolean;
    required?: boolean;
    name?: string;
    placeholder?: string;
    class?: string;
    dayContent?: Snippet<
      [Date, { isToday: boolean; isSelected: boolean; isInRange: boolean; isDisabled: boolean }]
    >;
  };

  export type DatePickerProps =
    | (DatePickerSharedProps & {
        mode?: 'single';
        value?: Date | null;
        defaultValue?: Date | null;
        onchange?: (value: Date | null) => void;
      })
    | (DatePickerSharedProps & {
        mode: 'range';
        value?: [Date, Date] | null;
        defaultValue?: [Date, Date] | null;
        onchange?: (value: [Date, Date] | null) => void;
      });
</script>

<script lang="ts">
  import { DEV } from 'esm-env';
  import { tick } from 'svelte';

  import {
    addDays,
    addMonths,
    addYears,
    buildMonthMatrix,
    dayOfWeekHeaders,
    firstDayOfWeek,
    isAfter,
    isBefore,
    isSameDay,
    serializeDate,
    validateLocale,
  } from '../_internal/calendar.ts';
  import {
    ariaInvalid,
    composeDescribedBy,
    describeId,
    errorId as buildErrorId,
  } from '../_internal/field-control.ts';
  import { pushEscapeHandler, restoreFocusTo } from '../_internal/overlay.ts';
  import { cn } from '../utilities/class-names.ts';

  let {
    id,
    value = $bindable<DatePickerValue | undefined>(),
    defaultValue = null,
    mode = 'single' as DatePickerMode,
    label,
    description,
    error,
    locale,
    min,
    max,
    disabled = false,
    required = false,
    name,
    placeholder,
    class: className,
    dayContent,
    onchange,
  }: DatePickerProps = $props();

  const initialMode: DatePickerMode = mode;

  if (DEV) {
    $effect(() => {
      if (mode !== initialMode) {
        console.warn(
          `[date-picker] The 'mode' prop changed after mount on component "${id}". Mode is non-reactive; use {#key mode} to remount.`,
        );
      }
    });
  }

  // Locale resolution — use $derived so no effect loop occurs.
  // On the server (no navigator), falls back to undefined.
  // If locale prop is truthy but invalid, fall through to navigator.language.
  const resolvedLocale = $derived.by(() => {
    if (locale) {
      const validated = validateLocale(locale);
      if (validated) return validated;
    }
    if (typeof navigator !== 'undefined') return validateLocale(navigator.language);
    return undefined;
  });

  if (DEV) {
    $effect(() => {
      if (!label) {
        console.warn(
          `[date-picker] component "${id}" has no label. Pass a 'label' prop for accessibility.`,
        );
      }
    });
  }

  // Internal state
  let open = $state(false);
  let anchor = $state<Date>(new Date());
  let focusedDate = $state<Date>(new Date());

  // Range draft state machine — NOT synced from value via effect
  // (doing so causes an effect_update_depth_exceeded loop).
  // Instead, range display helpers read currentValue directly.
  type RangeDraft = { stage: 'idle' } | { stage: 'picking-end'; start: Date; hover: Date | null };

  let rangeDraft = $state<RangeDraft>({ stage: 'idle' });

  const currentValue = $derived(value === undefined ? (defaultValue as DatePickerValue) : value);

  // Derived helpers
  const descriptionId = $derived(describeId(id, !!description));
  const errId = $derived(buildErrorId(id, !!error));
  const popoverId = `${id}-popover`;
  const titleId = `${id}-title`;
  const liveRegionId = `${id}-live`;

  // Invalid/required state
  const isValueEmpty = $derived(currentValue === null);

  const invalid = $derived(
    !!error ||
      (required && isValueEmpty) ||
      (min !== undefined && max !== undefined && isBefore(max, min)),
  );

  const invalidMinMax = $derived(min !== undefined && max !== undefined && isBefore(max, min));

  if (DEV) {
    $effect(() => {
      if (invalidMinMax) {
        console.warn(
          `[date-picker] min (${min?.toISOString()}) is after max (${max?.toISOString()}); all days will be disabled.`,
        );
      }
    });
  }

  const describedBy = $derived(
    composeDescribedBy(descriptionId, errId, invalid && !error ? `${id}-error` : undefined),
  );

  // Trigger display text
  const triggerText = $derived.by(() => {
    if (!resolvedLocale) return '';
    const val = currentValue;
    if (!val) return '';

    const formatter = new Intl.DateTimeFormat(resolvedLocale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    if (initialMode === 'single') {
      return formatter.format(val as Date);
    } else {
      const range = val as [Date, Date];
      return `${formatter.format(range[0])} – ${formatter.format(range[1])}`;
    }
  });

  const triggerPlaceholder = $derived.by(() => {
    if (placeholder) return placeholder;
    if (!resolvedLocale) return '';
    const formatter = new Intl.DateTimeFormat(resolvedLocale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(new Date(2000, 0, 15));
    return parts
      .map((part) => {
        switch (part.type) {
          case 'year':
            return 'YYYY';
          case 'month':
            return 'MM';
          case 'day':
            return 'DD';
          default:
            return part.value;
        }
      })
      .join('');
  });

  // Calendar matrix
  const matrix = $derived(buildMonthMatrix(anchor, resolvedLocale));
  const headers = $derived(dayOfWeekHeaders(resolvedLocale));

  const monthTitle = $derived.by(() => {
    if (!resolvedLocale) return '';
    return new Intl.DateTimeFormat(resolvedLocale, {
      month: 'long',
      year: 'numeric',
    }).format(anchor);
  });

  let liveRegionText = $state('');

  // DOM refs
  let triggerInput = $state<HTMLInputElement | null>(null);
  let popoverEl = $state<HTMLDialogElement | null>(null);
  let gridEl = $state<HTMLTableElement | null>(null);

  // Focus-on-open rule
  function computeInitialFocus(): Date {
    const today = new Date();

    if (invalidMinMax) return today;

    if (currentValue !== null) {
      const target =
        initialMode === 'single' ? (currentValue as Date) : (currentValue as [Date, Date])[0];
      if (target) {
        const inRange = (!min || !isBefore(target, min)) && (!max || !isAfter(target, max));
        if (inRange) return target;
      }
    }

    const todayInRange = (!min || !isBefore(today, min)) && (!max || !isAfter(today, max));
    if (todayInRange) return today;

    if (min && isBefore(today, min)) return min;
    if (max) return max;
    return today;
  }

  function isDateDisabled(date: Date): boolean {
    if (invalidMinMax) return true;
    if (min && isBefore(date, min)) return true;
    if (max && isAfter(date, max)) return true;
    return false;
  }

  function isDateSelected(date: Date): boolean {
    if (initialMode === 'single') {
      return currentValue !== null && isSameDay(date, currentValue as Date);
    }
    // Range mode: show start endpoint during picking-end, both endpoints when complete
    if (rangeDraft.stage === 'picking-end') {
      return isSameDay(date, rangeDraft.start);
    }
    if (currentValue === null) return false;
    const [start, end] = currentValue as [Date, Date];
    return isSameDay(date, start) || isSameDay(date, end);
  }

  function isDateInRange(date: Date): boolean {
    if (initialMode !== 'range') return false;

    if (rangeDraft.stage === 'picking-end') {
      const hover = rangeDraft.hover;
      if (!hover) return false;
      const rangeStart = isBefore(rangeDraft.start, hover) ? rangeDraft.start : hover;
      const rangeEnd = isAfter(rangeDraft.start, hover) ? rangeDraft.start : hover;
      return (
        !isBefore(date, rangeStart) &&
        !isAfter(date, rangeEnd) &&
        !isSameDay(date, rangeStart) &&
        !isSameDay(date, rangeEnd)
      );
    }

    if (currentValue === null) return false;
    const [start, end] = currentValue as [Date, Date];
    return (
      !isBefore(date, start) &&
      !isAfter(date, end) &&
      !isSameDay(date, start) &&
      !isSameDay(date, end)
    );
  }

  function isRangeStart(date: Date): boolean {
    if (initialMode !== 'range') return false;
    if (rangeDraft.stage === 'picking-end') return isSameDay(date, rangeDraft.start);
    if (currentValue === null) return false;
    return isSameDay(date, (currentValue as [Date, Date])[0]);
  }

  function isRangeEnd(date: Date): boolean {
    if (initialMode !== 'range') return false;
    if (rangeDraft.stage === 'picking-end') return false;
    if (currentValue === null) return false;
    return isSameDay(date, (currentValue as [Date, Date])[1]);
  }

  function isToday(date: Date): boolean {
    return isSameDay(date, new Date());
  }

  // Focus management
  function focusDay(date: Date): void {
    if (!gridEl) return;
    focusedDate = date;

    // If the date is outside the current anchor month, navigate and focus after re-render
    if (date.getFullYear() !== anchor.getFullYear() || date.getMonth() !== anchor.getMonth()) {
      const newAnchor = new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0, 0);
      anchor = newAnchor;
      liveRegionText = new Intl.DateTimeFormat(resolvedLocale, {
        month: 'long',
        year: 'numeric',
      }).format(newAnchor);
      void tick().then(() => {
        if (!gridEl) return;
        const iso = serializeDate(date);
        const btn = gridEl.querySelector<HTMLElement>(`[data-date="${iso}"]`);
        btn?.focus();
      });
      return;
    }

    const iso = serializeDate(date);
    const btn = gridEl.querySelector<HTMLElement>(`[data-date="${iso}"]`);
    btn?.focus();
  }

  let releaseEscape: (() => void) | null = null;

  // Release the escape handler if the component unmounts while the popover is open
  $effect(() => () => {
    releaseEscape?.();
    releaseEscape = null;
  });

  function openPopover(): void {
    if (disabled || open) return;
    open = true;
    const initial = computeInitialFocus();
    focusedDate = initial;
    anchor = new Date(initial.getFullYear(), initial.getMonth(), 1, 12, 0, 0, 0);

    // Reset to idle when reopening (resume is not supported in v1)
    rangeDraft = { stage: 'idle' };

    releaseEscape = pushEscapeHandler(closePopover);

    // Focus the correct day after Svelte flushes the DOM update
    void tick().then(() => {
      if (open) focusDay(initial);
    });
  }

  function closePopover(): void {
    if (!open) return;
    open = false;
    if (initialMode === 'range' && rangeDraft.stage === 'picking-end') {
      // Escape during picking-end: cancel the in-progress range
      rangeDraft = { stage: 'idle' };
    }
    releaseEscape?.();
    releaseEscape = null;
    restoreFocusTo(triggerInput);
  }

  function selectDate(date: Date): void {
    if (isDateDisabled(date)) return;

    if (initialMode === 'single') {
      const newValue = date as Date;
      value = newValue;
      (onchange as ((v: Date | null) => void) | undefined)?.(newValue);
      closePopover();
    } else {
      if (rangeDraft.stage === 'idle') {
        rangeDraft = { stage: 'picking-end', start: date, hover: null };
      } else {
        // Second click — finalize range
        const start = rangeDraft.start;
        const end = date;
        const sorted: [Date, Date] =
          isBefore(start, end) || isSameDay(start, end) ? [start, end] : [end, start];

        rangeDraft = { stage: 'idle' };
        value = sorted;
        (onchange as ((v: [Date, Date] | null) => void) | undefined)?.(sorted);
        closePopover();
      }
    }
  }

  function navigateMonth(delta: number): void {
    const newAnchor = addMonths(anchor, delta);
    anchor = newAnchor;
    liveRegionText = new Intl.DateTimeFormat(resolvedLocale, {
      month: 'long',
      year: 'numeric',
    }).format(newAnchor);

    // Keep focusedDate in the new month
    const clamped = new Date(
      newAnchor.getFullYear(),
      newAnchor.getMonth(),
      Math.min(
        focusedDate.getDate(),
        new Date(newAnchor.getFullYear(), newAnchor.getMonth() + 1, 0).getDate(),
      ),
      12,
      0,
      0,
      0,
    );
    focusedDate = clamped;
    void tick().then(() => {
      if (open) focusDay(clamped);
    });
  }

  function navigateYear(delta: number): void {
    const newAnchor = addYears(anchor, delta);
    anchor = newAnchor;
    liveRegionText = new Intl.DateTimeFormat(resolvedLocale, {
      month: 'long',
      year: 'numeric',
    }).format(newAnchor);

    const clamped = new Date(
      newAnchor.getFullYear(),
      newAnchor.getMonth(),
      Math.min(
        focusedDate.getDate(),
        new Date(newAnchor.getFullYear(), newAnchor.getMonth() + 1, 0).getDate(),
      ),
      12,
      0,
      0,
      0,
    );
    focusedDate = clamped;
    void tick().then(() => {
      if (open) focusDay(clamped);
    });
  }

  function handleTriggerKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' || event.key === ' ' || event.key === 'Enter') {
      if (event.altKey || event.key === 'ArrowDown') {
        event.preventDefault();
        openPopover();
      } else if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        openPopover();
      }
    }
  }

  function handleGridKeydown(event: KeyboardEvent): void {
    const key = event.key;
    const ctrlOrMeta = event.ctrlKey || event.metaKey;

    if (key === 'ArrowLeft') {
      event.preventDefault();
      focusDay(addDays(focusedDate, -1));
    } else if (key === 'ArrowRight') {
      event.preventDefault();
      focusDay(addDays(focusedDate, 1));
    } else if (key === 'ArrowUp') {
      event.preventDefault();
      focusDay(addDays(focusedDate, -7));
    } else if (key === 'ArrowDown') {
      event.preventDefault();
      focusDay(addDays(focusedDate, 7));
    } else if (key === 'Home') {
      event.preventDefault();
      const firstDay = firstDayOfWeek(resolvedLocale);
      const dayOfWeek = focusedDate.getDay();
      const diff = (dayOfWeek - firstDay + 7) % 7;
      focusDay(addDays(focusedDate, -diff));
    } else if (key === 'End') {
      event.preventDefault();
      const firstDay = firstDayOfWeek(resolvedLocale);
      const lastDay = (firstDay + 6) % 7;
      const dayOfWeek = focusedDate.getDay();
      const diff = (lastDay - dayOfWeek + 7) % 7;
      focusDay(addDays(focusedDate, diff));
    } else if (key === 'PageUp' && !ctrlOrMeta) {
      event.preventDefault();
      navigateMonth(-1);
    } else if (key === 'PageDown' && !ctrlOrMeta) {
      event.preventDefault();
      navigateMonth(1);
    } else if (key === 'PageUp' && ctrlOrMeta) {
      event.preventDefault();
      navigateYear(-1);
    } else if (key === 'PageDown' && ctrlOrMeta) {
      event.preventDefault();
      navigateYear(1);
    } else if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      selectDate(focusedDate);
    } else if (key === 'Escape') {
      event.preventDefault();
      closePopover();
    }
  }

  // Outside click
  $effect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent): void {
      const target = event.target as Node;
      if (popoverEl?.contains(target)) return;
      if (triggerInput?.contains(target)) return;
      const iconBtn = triggerInput?.parentElement?.querySelector(
        '.cinder-date-picker__icon-button',
      );
      if (iconBtn?.contains(target)) return;
      closePopover();
    }

    document.addEventListener('pointerdown', handlePointerDown, { capture: true });
    return () => document.removeEventListener('pointerdown', handlePointerDown, { capture: true });
  });

  // Form reset
  $effect(() => {
    const input = triggerInput;
    if (!input) return;
    const resetInput = input;
    let currentForm: HTMLFormElement | null = null;
    let handledResetEvent: Event | null = null;

    function resetToDefault(event: Event): void {
      if (handledResetEvent === event) return;
      handledResetEvent = event;
      queueMicrotask(() => {
        if (handledResetEvent === event) handledResetEvent = null;
      });

      const resetValue = defaultValue as DatePickerValue;
      value = resetValue;
      (onchange as ((v: DatePickerValue) => void) | undefined)?.(resetValue);
      if (initialMode === 'range') {
        rangeDraft = { stage: 'idle' };
      }
    }

    function handleDocumentReset(event: Event): void {
      if (!(event.target instanceof HTMLFormElement)) return;
      if (resetInput.form !== event.target) return;
      resetToDefault(event);
    }

    function attachCurrentForm(): void {
      const nextForm = resetInput.form;
      if (nextForm === currentForm) return;
      currentForm?.removeEventListener('reset', resetToDefault);
      currentForm = nextForm;
      currentForm?.addEventListener('reset', resetToDefault);
    }

    attachCurrentForm();
    void tick().then(attachCurrentForm);
    document.addEventListener('reset', handleDocumentReset, { capture: true });

    return () => {
      currentForm?.removeEventListener('reset', resetToDefault);
      document.removeEventListener('reset', handleDocumentReset, { capture: true });
    };
  });

  // setCustomValidity
  $effect(() => {
    const input = triggerInput;
    if (!input) return;
    if (invalidMinMax) {
      input.setCustomValidity('No valid date range available.');
    } else if (required && isValueEmpty) {
      input.setCustomValidity('Please select a date.');
    } else {
      input.setCustomValidity('');
    }
  });

  // Serialized values for hidden inputs
  const serializedSingle = $derived.by(() => {
    if (initialMode !== 'single') return '';
    const val = currentValue as Date | null;
    return val ? serializeDate(val) : '';
  });

  const serializedRangeStart = $derived.by(() => {
    if (initialMode !== 'range') return '';
    const val = currentValue as [Date, Date] | null;
    return val ? serializeDate(val[0]) : '';
  });

  const serializedRangeEnd = $derived.by(() => {
    if (initialMode !== 'range') return '';
    const val = currentValue as [Date, Date] | null;
    return val ? serializeDate(val[1]) : '';
  });

  function dayAriaLabel(date: Date): string {
    // Fall back to ISO date string (YYYY-MM-DD) so screen readers always get a
    // full date context, not just a bare day number.
    if (!resolvedLocale) return serializeDate(date);
    return new Intl.DateTimeFormat(resolvedLocale, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  }
</script>

<div class={cn('cinder-date-picker', className)}>
  {#if label}
    <label for={id} class="cinder-date-picker__label" data-disabled={disabled || undefined}>
      {label}
    </label>
  {/if}

  <div class="cinder-date-picker__control">
    <input
      bind:this={triggerInput}
      {id}
      type="text"
      readonly
      role="combobox"
      class="cinder-date-picker__input"
      value={triggerText}
      placeholder={triggerPlaceholder}
      {disabled}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={popoverId}
      aria-invalid={ariaInvalid(invalid)}
      aria-describedby={describedBy}
      aria-required={required || undefined}
      onkeydown={handleTriggerKeydown}
      onclick={openPopover}
    />

    <span class="cinder-date-picker__icon-button" aria-hidden="true">
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
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="16" y1="2" x2="16" y2="6"></line>
        <line x1="8" y1="2" x2="8" y2="6"></line>
        <line x1="3" y1="10" x2="21" y2="10"></line>
      </svg>
    </span>
  </div>

  {#if name}
    {#if initialMode === 'single'}
      <input type="hidden" {name} value={serializedSingle} />
    {:else}
      <input type="hidden" name="{name}.start" value={serializedRangeStart} />
      <input type="hidden" name="{name}.end" value={serializedRangeEnd} />
    {/if}
  {/if}

  {#if open}
    <dialog
      bind:this={popoverEl}
      id={popoverId}
      role="dialog"
      class="cinder-date-picker__popover"
      aria-modal="false"
      aria-label={label ? `${label} — calendar` : 'Date picker calendar'}
      open
    >
      <div class="cinder-date-picker__popover-header">
        <button
          type="button"
          class="cinder-date-picker__nav-button"
          aria-label="Previous month"
          onclick={() => navigateMonth(-1)}
        >
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
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>

        <h2 id={titleId} class="cinder-date-picker__month-title">
          {monthTitle}
        </h2>

        <button
          type="button"
          class="cinder-date-picker__nav-button"
          aria-label="Next month"
          onclick={() => navigateMonth(1)}
        >
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
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </div>

      <table
        bind:this={gridEl}
        role="grid"
        class="cinder-date-picker__grid"
        aria-labelledby={titleId}
        onkeydown={handleGridKeydown}
      >
        <thead>
          <tr>
            {#each headers as header, i (i)}
              <th scope="col" abbr={header.full} class="cinder-date-picker__weekday-header">
                {header.label}
              </th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each matrix as week, wi (wi)}
            <tr>
              {#each week as day, di (di)}
                {@const disabled_day = isDateDisabled(day)}
                {@const selected = isDateSelected(day)}
                {@const inRange = isDateInRange(day)}
                {@const rangeStart = isRangeStart(day)}
                {@const rangeEnd = isRangeEnd(day)}
                {@const today = isToday(day)}
                {@const isCurrentMonth = day.getMonth() === anchor.getMonth()}
                {@const isFocused = isSameDay(day, focusedDate)}
                {@const dateKey = serializeDate(day)}
                <td role="presentation">
                  <button
                    type="button"
                    role="gridcell"
                    class="cinder-date-picker__day"
                    tabindex={isFocused ? 0 : -1}
                    aria-selected={selected}
                    aria-disabled={disabled_day || undefined}
                    aria-label={dayAriaLabel(day)}
                    aria-current={today ? 'date' : undefined}
                    data-date={dateKey}
                    data-other-month={!isCurrentMonth || undefined}
                    data-range-start={rangeStart || undefined}
                    data-range-end={rangeEnd || undefined}
                    data-in-range={inRange || undefined}
                    onclick={() => selectDate(day)}
                    onmouseenter={() => {
                      if (initialMode === 'range' && rangeDraft.stage === 'picking-end') {
                        rangeDraft = { ...rangeDraft, hover: day };
                      }
                    }}
                    onmouseleave={() => {
                      if (initialMode === 'range' && rangeDraft.stage === 'picking-end') {
                        rangeDraft = { ...rangeDraft, hover: null };
                      }
                    }}
                    onfocus={() => {
                      focusedDate = day;
                      if (initialMode === 'range' && rangeDraft.stage === 'picking-end') {
                        rangeDraft = { ...rangeDraft, hover: day };
                      }
                    }}
                  >
                    {#if dayContent}
                      {@render dayContent(day, {
                        isToday: today,
                        isSelected: selected,
                        isInRange: inRange,
                        isDisabled: disabled_day,
                      })}
                    {:else}
                      {day.getDate()}
                    {/if}
                  </button>
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>

      <button
        type="button"
        class="cinder-date-picker__close-button"
        aria-label="Close calendar"
        onclick={closePopover}
      >
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
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </dialog>
  {/if}

  <div id={liveRegionId} aria-live="polite" class="cinder-date-picker__live-region">
    {liveRegionText}
  </div>

  {#if description}
    <p id={descriptionId} class="cinder-date-picker__description">{description}</p>
  {/if}

  {#if error}
    <p id={errId} class="cinder-date-picker__error" aria-live="polite">{error}</p>
  {:else if invalid && !error}
    <p id="{id}-error" class="cinder-date-picker__error" role="alert">
      {#if invalidMinMax}
        No valid date range available.
      {:else if required && isValueEmpty}
        Please select a date.
      {/if}
    </p>
  {/if}
</div>
