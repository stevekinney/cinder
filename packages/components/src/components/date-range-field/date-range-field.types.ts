import type { HTMLAttributes } from 'svelte/elements';

/**
 * A date-only range value expressed as ISO-8601 date strings (YYYY-MM-DD).
 * Both `start` and `end` are optional so the consumer can represent partial input.
 */
export type DateRangeValue = {
  /** Start of the range as an ISO-8601 date string (YYYY-MM-DD), or undefined when not set. */
  start: string | undefined;
  /** End of the range as an ISO-8601 date string (YYYY-MM-DD), or undefined when not set. */
  end: string | undefined;
};

/**
 * A preset time-window option that the consumer can offer to the user.
 */
export type DateRangeDatePreset = {
  /** Unique identifier for the preset. */
  id: string;
  /** Visible label rendered in the preset button. */
  label: string;
  /** Returns the date range this preset represents, evaluated at call time. */
  resolve: () => DateRangeValue;
};

/**
 * Props for the DateRangeField component.
 *
 * v1 scope (date-only):
 * - Accepts and emits ISO-8601 date strings (YYYY-MM-DD) for start and end.
 * - Does not support date-time (hours/minutes/seconds/timezone). That adds
 *   timezone + time-picker complexity that doubles the surface area; it is
 *   tracked as a follow-up.
 * - Sets the native inputs' min/max so the browser picker hints valid bounds
 *   (end's min = start, start's max = end), but does NOT block out-of-order
 *   entry. Validation feedback is the consumer's responsibility via `error`.
 * - Supports optional consumer-supplied presets (e.g. last 7 days).
 * - Does not own routing, query-string sync, or data fetching.
 */
export type DateRangeFieldProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  'class' | 'children' | 'onchange'
> & {
  /**
   * Unique identifier used to generate accessible IDs for labels and error
   * regions. Optional — a stable id is generated via `$props.id()` when omitted.
   */
  id?: string;
  /** Current date range value. Bindable. Both fields start undefined when unset. */
  value?: DateRangeValue;
  /** Visible legend rendered above the start/end inputs. */
  label?: string;
  /** Accessible label for the start date input. Defaults to "Start date". */
  startLabel?: string;
  /** Accessible label for the end date input. Defaults to "End date". */
  endLabel?: string;
  /**
   * Consumer-defined preset options shown above the date inputs.
   * Each preset has a label and a resolve() function that returns a DateRangeValue.
   * Defaults to today, yesterday-today, last-7d built-ins when omitted.
   */
  presets?: DateRangeDatePreset[];
  /** When true, hides the preset buttons and shows only the date inputs. */
  hidePresets?: boolean;
  /** Helper text displayed below the field; wired via aria-describedby. */
  description?: string;
  /**
   * Validation error message. When provided, marks both inputs as aria-invalid="true"
   * and renders the message in a live region.
   */
  error?: string;
  /** Disables the entire field including presets and date inputs. */
  disabled?: boolean;
  /** Additional CSS classes applied to the root element. */
  class?: string;
  /** Called when the user changes the date range (preset or manual input). */
  onchange?: (value: DateRangeValue) => void;
};
