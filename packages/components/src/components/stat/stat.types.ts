import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
/** Direction of a stat change indicator. */
export type StatChangeDirection = 'up' | 'down' | 'neutral';
/** Data for the optional change indicator rendered below the stat value. */
export type StatChange = {
  /** The change magnitude as a display string, e.g. "4.75%", "+$120", "12". */
  value: string;
  /** Direction of change — drives icon + color. */
  direction: StatChangeDirection;
  /** Optional visible description, e.g. "from last month". Rendered aria-hidden. */
  description?: string;
  /**
   * Optional fully-worded accessible label for the change indicator.
   * When omitted, a phrase is synthesized from `direction` + `value` (+ optional `description`).
   * When provided, used verbatim — the caller owns the full wording.
   */
  label?: string;
};
export type StatProps = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
  /** Short label describing the metric, e.g. "Monthly Revenue". */
  label: string;
  /** The statistic. Strings rendered verbatim; numbers formatted via formatNumber. */
  value: string | number;
  /** Optional change indicator with direction and accessible wording. */
  change?: StatChange;
  /** Optional leading icon snippet (decorative — wrapper is aria-hidden). */
  icon?: Snippet;
  /** Intl.NumberFormat options applied only when `value` is a number. */
  valueFormatOptions?: Intl.NumberFormatOptions;
  /** Locale forwarded to formatNumber (defaults to en-US). */
  valueLocale?: string;
  /** Additional class names merged with `.cinder-stat`. */
  class?: string;
};
