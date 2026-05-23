/**
 * Precision of selectable values in `<Rating>`. `'whole'` allows the values
 * `1, 2, …, count`; `'half'` allows the half-step values `0.5, 1, 1.5, …, count`.
 */
export type RatingPrecision = 'whole' | 'half';

/**
 * Props for `<Rating>`. Renders a star rating that combines a radio-group
 * interactive mode with a non-interactive readonly display mode.
 */
export type RatingProps = {
  /** Stable id used as the radio-group id prefix and as the hidden input id. */
  id: string;
  /**
   * Bindable rating value. `0` represents an unrated state. External values
   * are clamped into `[0, count]` and snapped to the nearest precision step.
   */
  value?: number;
  /**
   * Number of rating slots. Normalized to an integer in `[1, 10]`; non-finite
   * or out-of-range values fall back to `5`.
   */
  count?: number;
  /** Precision of each step. Defaults to `'whole'`. */
  precision?: RatingPrecision;
  /** Visible group label rendered above the rating. */
  label?: string;
  /** Visually hide the rendered `label` while keeping it programmatically associated. */
  hideLabel?: boolean;
  /** Group accessible name when no visible `label` is supplied. */
  'aria-label'?: string;
  /** Space-separated list of ids that label the group when no `label` is supplied. */
  'aria-labelledby'?: string;
  /** Optional description text rendered below the rating. */
  description?: string;
  /** Optional error message; sets `aria-invalid="true"` on the rating group. */
  error?: string;
  /** Disable every rating control and the hidden input. */
  disabled?: boolean;
  /** Render a non-interactive display with an accessible text equivalent. */
  readonly?: boolean;
  /** Mark the group as required for assistive technology. */
  required?: boolean;
  /** Form-control name applied to the hidden `<input>` that submits with the form. */
  name?: string;
  /** Extra class names appended to the root group element. */
  class?: string;
  /**
   * Fires only for user-initiated committed value changes (click, arrow keys,
   * Space/Enter). Never fires for hover preview or external prop synchronization.
   */
  onchange?: (value: number) => void;
};
