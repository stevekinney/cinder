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
export type MeterProps = {
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
