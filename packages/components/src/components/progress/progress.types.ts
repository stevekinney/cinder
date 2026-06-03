export type ProgressVariant = 'bar' | 'ring';
export type ProgressSize = 'sm' | 'md' | 'lg';
/**
 * Props for the Progress component.
 *
 * Determinate progress passes a `value` between 0 and `max` (default 100).
 * Indeterminate progress omits `value` (or passes `undefined`); the
 * component renders a looping animation under normal motion preferences
 * and a static surface under `prefers-reduced-motion: reduce`.
 *
 * ACCESSIBLE NAME (required): every progressbar must have an accessible name
 * per ARIA 1.2 §6.9. Provide exactly one of `ariaLabel` or `ariaLabelledby`.
 * `label` does NOT satisfy this — it only feeds `aria-valuetext` (the announced
 * status string), not the element's accessible name.
 */
export type ProgressProps = {
  /** Current progress value. Omit for indeterminate. */
  value?: number;
  /** Maximum value. Defaults to 100. */
  max?: number;
  /** Visual variant. Default `bar`. */
  variant?: ProgressVariant;
  /** Size token. Default `md`. */
  size?: ProgressSize;
  /**
   * Human-readable status, exposed as `aria-valuetext`. NOT the accessible
   * name — supply `ariaLabel` or `ariaLabelledby` for that.
   */
  label?: string;
  /**
   * Accessible name applied directly to the progressbar element when no
   * visible label element is present in the page. Required unless
   * `ariaLabelledby` is supplied.
   */
  ariaLabel?: string;
  /**
   * Id of a visible element that serves as the accessible name for the
   * progressbar. Prefer this over `ariaLabel` when a visible label exists.
   * Required unless `ariaLabel` is supplied.
   */
  ariaLabelledby?: string;
  /** Additional class names merged with `.cinder-progress`. */
  class?: string;
};
