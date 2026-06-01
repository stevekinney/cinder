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
 * Every progressbar must have an accessible name. Provide one via:
 * - `ariaLabel` — a direct string label when no visible label element exists.
 * - `ariaLabelledby` — the `id` of a visible label element in the page.
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
  /** Human-readable status, exposed as `aria-valuetext`. */
  label?: string;
  /**
   * Accessible name applied directly to the progressbar element when no
   * visible label element is present in the page.
   */
  ariaLabel?: string;
  /**
   * Id of a visible element that serves as the accessible name for the
   * progressbar. Prefer this over `ariaLabel` when a visible label exists.
   */
  ariaLabelledby?: string;
  /** Additional class names merged with `.cinder-progress`. */
  class?: string;
};
