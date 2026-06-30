import type { HTMLAttributes } from 'svelte/elements';

export type CalendarProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  'class' | 'children' | 'onchange'
> & {
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
  /** First weekday index, `0` Sunday to `6` Saturday. Defaults to `0`. */
  firstDayOfWeek?: number;
  /** Localized month label locale. Defaults to `en-US`. */
  locale?: string;
  /** Accessible label for the grid. Defaults to `Calendar`. */
  label?: string;
  /** Disable interaction. */
  disabled?: boolean;
  /** Additional classes for the root node. */
  class?: string;
  /** Called when the user commits a day selection. */
  onchange?: (value: string) => void;
  /** Return true to disable a specific day. */
  disabledDate?: (value: string) => boolean;
};
