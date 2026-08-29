import type { HTMLAttributes } from 'svelte/elements';

export type CalendarProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  'class' | 'children' | 'onchange'
> & {
  /** Selection model. Defaults to `single`. */
  selectionMode?: 'single' | 'range';
  /** Start endpoint for range selection. */
  rangeStart?: string | undefined;
  /** End endpoint for range selection. */
  rangeEnd?: string | undefined;
  /** Called when a range endpoint is selected. */
  onRangeChange?: (range: { start: string | undefined; end: string | undefined }) => void;
  /** Preview endpoint while hovering a range. */
  rangeHover?: string | undefined;
  /** Optional root id. */
  id?: string;
  /** Selected ISO date (`YYYY-MM-DD`). Bindable. */
  value?: string | undefined;
  /** Visible month anchor (`YYYY-MM-DD`), defaults to selected date or today. */
  month?: string | undefined;
  /** Earliest selectable day (`YYYY-MM-DD`). */
  min?: string | undefined;
  /** Latest selectable day (`YYYY-MM-DD`). */
  max?: string | undefined;
  /** First weekday index, `0` Sunday to `6` Saturday. Defaults to `0`. @default 0 */
  firstDayOfWeek?: number;
  /** Localized month label locale. Defaults to `en-US`. @default "en-US" */
  locale?: string;
  /** Accessible label for the grid. Defaults to `Calendar`. @default "Calendar" */
  label?: string;
  /** Disable interaction. @default false */
  disabled?: boolean;
  /** Additional classes for the root node. */
  class?: string;
  /** Called when the user commits a day selection. */
  onValueChange?: (value: string) => void;
  /** Return true to disable a specific day. */
  disabledDate?: (value: string) => boolean;
};
