import type { HTMLAttributes } from 'svelte/elements';

export type MeterSize = 'sm' | 'md' | 'lg';
export type MeterState = 'low' | 'optimum' | 'high';

/**
 * Props for the Meter component.
 *
 * Meter communicates a bounded measurement (for example battery level,
 * storage consumption, or CPU utilization). Unlike progressbar, meter is not
 * a "work is completing" indicator and should use `role="meter"` semantics.
 *
 * ACCESSIBLE NAME (required): provide `ariaLabel` or `ariaLabelledby` so
 * assistive technologies can identify what the measurement represents.
 */
// `aria-label` and `aria-labelledby` are intentionally NOT omitted from the base
// `HTMLAttributes` here: the component consumes them (a rest-forwarded native value wins
// over the bespoke `ariaLabel`/`ariaLabelledby` props below, with the bespoke props as a
// fallback) rather than discarding them. See meter.svelte for the resolution.
export type MeterProps = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
  /** Current measurement value. Defaults to 0. */
  value?: number;
  /** Lower bound for the range. Defaults to 0. */
  min?: number;
  /** Upper bound for the range. Defaults to 100. */
  max?: number;
  /** Lower threshold boundary for segmented rendering. */
  low?: number;
  /** Upper threshold boundary for segmented rendering. */
  high?: number;
  /**
   * Optimal target value. Influences computed state semantics to match native
   * meter expectations.
   */
  optimum?: number;
  /** Size token for track height. Default `md`. */
  size?: MeterSize;
  /**
   * Human-readable text exposed via `aria-valuetext`.
   * When omitted, `aria-valuetext` is not rendered.
   * Example: `50% (6 hours remaining)`.
   */
  ariaValueText?: string;
  /**
   * Accessible name applied directly to the meter element when no visible
   * label element is present.
   */
  ariaLabel?: string;
  /**
   * Id of a visible element that serves as the accessible name for the meter.
   * Prefer this when a visible label exists.
   */
  ariaLabelledby?: string;
  /** Additional class names merged with `.cinder-meter`. */
  class?: string;
};
