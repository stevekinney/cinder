<script lang="ts" module>
  /**
   * @cinder
   * @category form
   * @status alpha
   * @purpose Keyboard-navigable month grid for choosing a calendar date with full styling control and min/max constraints.
   * @tag form
   * @tag date
   * @tag calendar
   * @useWhen Rendering a custom date-grid picker inside an input popover.
   * @useWhen Requiring consistent cross-browser calendar behavior that native date controls cannot provide.
   * @avoidWhen A plain browser-managed date input is sufficient and custom keyboard semantics are not required.
   * @related date-picker, date-range-field
   */
  export type { CalendarProps } from './calendar.types.ts';
</script>

<script lang="ts">
  import { tick } from 'svelte';
  import type { CalendarProps } from './calendar.types.ts';
  import { classNames } from '../../utilities/class-names.ts';

  type CalendarCell = {
    iso: string;
    day: number;
    inMonth: boolean;
    disabled: boolean;
    focused: boolean;
    selected: boolean;
    ariaLabel: string;
  };

  const WEEKDAY_INDEXES = [0, 1, 2, 3, 4, 5, 6] as const;

  let {
    id,
    value = $bindable<string | undefined>(undefined),
    month,
    min,
    max,
    firstDayOfWeek = 0,
    locale = 'en-US',
    label = 'Calendar',
    disabled = false,
    class: className,
    onchange,
    disabledDate,
    ...rest
  }: CalendarProps = $props();

  const generatedId = $props.id();
  const rootId = $derived(id ?? generatedId);
  const titleId = $derived(`${rootId}-title`);
  const monthGridId = $derived(`${rootId}-grid`);

  function parseISODate(iso: string | undefined): Date | null {
    if (!iso) return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!match) return null;
    const year = Number(match[1]);
    const monthValue = Number(match[2]);
    const day = Number(match[3]);
    if (monthValue < 1 || monthValue > 12) return null;
    const date = new Date(year, monthValue - 1, day);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== monthValue - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }
    return date;
  }

  function toISODate(date: Date): string {
    const year = date.getFullYear();
    const monthValue = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${monthValue}-${day}`;
  }

  function startOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  function addMonths(date: Date, months: number): Date {
    return new Date(date.getFullYear(), date.getMonth() + months, 1);
  }

  function startOfWeek(date: Date, weekStart: number): Date {
    const offset = (date.getDay() - weekStart + 7) % 7;
    return addDays(date, -offset);
  }

  function isISOWithinBounds(iso: string): boolean {
    if (min && iso < min) return false;
    if (max && iso > max) return false;
    return true;
  }

  function isDateDisabled(iso: string): boolean {
    if (!isISOWithinBounds(iso)) return true;
    return disabledDate?.(iso) ?? false;
  }

  const todayIso = $derived(toISODate(new Date()));
  const selectedDate = $derived(parseISODate(value));
  const anchorIso = $derived.by(() => {
    // Validate value and month before using them; fall back to today so
    // focusedIso always resolves to a parseable date (avoids a grid with
    // no tabbable cell when an empty/invalid string is passed).
    if (value && parseISODate(value)) return value;
    if (month && parseISODate(month)) return month;
    return todayIso;
  });
  const anchorDate = $derived(parseISODate(anchorIso) ?? new Date());
  let visibleMonthDate = $state(startOfMonth(anchorDate));
  let focusedIso = $state(value ?? anchorIso);
  let lastSyncedAnchorIso = $state(anchorIso);
  const focusedDayId = $derived(`${monthGridId}-day-${focusedIso}`);

  $effect(() => {
    if (anchorIso === lastSyncedAnchorIso) return;
    visibleMonthDate = startOfMonth(anchorDate);
    if (value) focusedIso = value;
    else focusedIso = anchorIso;
    lastSyncedAnchorIso = anchorIso;
  });

  const monthLabel = $derived(
    new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(visibleMonthDate),
  );

  const weekdayLabels = $derived(
    WEEKDAY_INDEXES.map((index) => {
      const dayIndex = (index + firstDayOfWeek) % 7;
      const base = new Date(2024, 0, 7 + dayIndex);
      return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(base);
    }),
  );

  const cells = $derived.by(() => {
    const first = startOfMonth(visibleMonthDate);
    const gridStart = startOfWeek(first, firstDayOfWeek);
    const selectedIso = value;
    const focused = focusedIso;
    const dayLabelFmt = new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const next: CalendarCell[] = [];
    for (let index = 0; index < 42; index += 1) {
      const date = addDays(gridStart, index);
      const iso = toISODate(date);
      next.push({
        iso,
        day: date.getDate(),
        inMonth: date.getMonth() === visibleMonthDate.getMonth(),
        disabled: disabled || isDateDisabled(iso),
        focused: iso === focused,
        selected: iso === selectedIso,
        ariaLabel: dayLabelFmt.format(date),
      });
    }
    return next;
  });

  const rows = $derived.by(() => {
    const next: CalendarCell[][] = [];
    for (let index = 0; index < cells.length; index += 7) {
      next.push(cells.slice(index, index + 7));
    }
    return next;
  });

  async function focusDate(iso: string, moveDomFocus = false) {
    focusedIso = iso;
    const parsed = parseISODate(iso);
    if (parsed) {
      visibleMonthDate = startOfMonth(parsed);
    }
    if (!moveDomFocus) return;
    await tick();
    const target = document.getElementById(focusedDayId) as HTMLButtonElement | null;
    target?.focus();
  }

  function commitDate(iso: string) {
    if (disabled || isDateDisabled(iso)) return;
    value = iso;
    focusedIso = iso;
    onchange?.(iso);
  }

  async function moveFocusedByDays(delta: number) {
    const base = parseISODate(focusedIso) ?? visibleMonthDate;
    const next = addDays(base, delta);
    await focusDate(toISODate(next), true);
  }

  function clampDayToMonth(year: number, monthValue: number, day: number): Date {
    const lastDay = new Date(year, monthValue + 1, 0).getDate();
    return new Date(year, monthValue, Math.min(day, lastDay));
  }

  async function moveFocusedByMonths(delta: number, moveDomFocus = true) {
    const base = parseISODate(focusedIso) ?? visibleMonthDate;
    const monthStart = addMonths(startOfMonth(base), delta);
    const candidate = clampDayToMonth(monthStart.getFullYear(), monthStart.getMonth(), base.getDate());
    await focusDate(toISODate(candidate), moveDomFocus);
  }

  async function handleKeydown(event: KeyboardEvent) {
    if (disabled) return;

    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        await moveFocusedByDays(-1);
        break;
      case 'ArrowRight':
        event.preventDefault();
        await moveFocusedByDays(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        await moveFocusedByDays(-7);
        break;
      case 'ArrowDown':
        event.preventDefault();
        await moveFocusedByDays(7);
        break;
      case 'Home': {
        event.preventDefault();
        const focused = parseISODate(focusedIso) ?? visibleMonthDate;
        const weekStart = startOfWeek(focused, firstDayOfWeek);
        await focusDate(toISODate(weekStart), true);
        break;
      }
      case 'End': {
        event.preventDefault();
        const focused = parseISODate(focusedIso) ?? visibleMonthDate;
        const weekEnd = addDays(startOfWeek(focused, firstDayOfWeek), 6);
        await focusDate(toISODate(weekEnd), true);
        break;
      }
      case 'PageUp':
        event.preventDefault();
        await moveFocusedByMonths(-1);
        break;
      case 'PageDown':
        event.preventDefault();
        await moveFocusedByMonths(1);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        commitDate(focusedIso);
        break;
      default:
        break;
    }
  }

  function canGoPrevMonth(): boolean {
    if (!min) return true;
    const prev = addMonths(visibleMonthDate, -1);
    const monthEnd = new Date(prev.getFullYear(), prev.getMonth() + 1, 0);
    return toISODate(monthEnd) >= min;
  }

  function canGoNextMonth(): boolean {
    if (!max) return true;
    const next = addMonths(visibleMonthDate, 1);
    const monthStart = new Date(next.getFullYear(), next.getMonth(), 1);
    return toISODate(monthStart) <= max;
  }
</script>

<div {...rest} aria-label={label} class={classNames('cinder-calendar', className)}>
  <div class="cinder-calendar__header">
    <button
      type="button"
      class="cinder-calendar__nav"
      aria-label="Previous month"
      onclick={() => {
        void moveFocusedByMonths(-1, false);
      }}
      disabled={disabled || !canGoPrevMonth()}
    >
      ‹
    </button>
    <p id={titleId} class="cinder-calendar__title">{monthLabel}</p>
    <button
      type="button"
      class="cinder-calendar__nav"
      aria-label="Next month"
      onclick={() => {
        void moveFocusedByMonths(1, false);
      }}
      disabled={disabled || !canGoNextMonth()}
    >
      ›
    </button>
  </div>

  <div class="cinder-calendar__weekdays" aria-hidden="true">
    {#each weekdayLabels as weekday}
      <span class="cinder-calendar__weekday">{weekday}</span>
    {/each}
  </div>

  <div
    id={monthGridId}
    class="cinder-calendar__grid"
    role="grid"
    aria-labelledby={titleId}
    onkeydown={handleKeydown}
  >
    {#each rows as row}
      <div role="row" class="cinder-calendar__grid-row">
        {#each row as cell}
          <div
            role="gridcell"
            aria-selected={cell.selected || undefined}
            class="cinder-calendar__gridcell"
          >
            <button
              type="button"
              id={`${monthGridId}-day-${cell.iso}`}
              class="cinder-calendar__day"
              data-outside={cell.inMonth ? undefined : ''}
              data-selected={cell.selected ? '' : undefined}
              data-focused={cell.focused ? '' : undefined}
              aria-current={cell.iso === todayIso ? 'date' : undefined}
              aria-label={cell.ariaLabel}
              aria-disabled={cell.disabled ? 'true' : undefined}
              tabindex={cell.focused ? 0 : -1}
              onclick={() => {
                commitDate(cell.iso);
              }}
              onfocus={() => {
                focusedIso = cell.iso;
              }}
            >
              {cell.day}
            </button>
          </div>
        {/each}
      </div>
    {/each}
  </div>
</div>
