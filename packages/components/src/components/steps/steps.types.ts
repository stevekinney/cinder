export type StepsOrientation = 'horizontal' | 'vertical';
export type StepItemState = 'complete' | 'current' | 'upcoming' | 'skipped';
export type StepItem = {
  /** Stable identifier used as the keyed-each key. Must be unique. */
  id: string;
  /** Visible label for the step. */
  label: string;
  /** Optional secondary text shown beneath the label. */
  description?: string;
  /**
   * Optional state override for this step. When omitted, state is derived from
   * `currentStep`. Use `skipped` for a past step that was advanced past without
   * completing.
   */
  state?: 'skipped';
  /**
   * When set, the step body renders as a link (`<a>`) to this href. The marker
   * and connector stay decorative; only the body (label + description) is the
   * interactive target.
   */
  href?: string;
  /**
   * When set, the step body renders as a button invoking this callback. When
   * combined with `href`, the body renders as a link that also runs the
   * callback on click (the consumer decides whether to `preventDefault`).
   */
  onclick?: (event: MouseEvent) => void;
};
export type StepsProps = {
  /** Ordered list of step entries from first to last. */
  steps: StepItem[];
  /**
   * Zero-based index of the active step. Steps with index < currentStep are
   * "completed". Pass `steps.length` to mark every step as complete (terminal
   * "done" state).
   */
  currentStep: number;
  /** Layout direction. Defaults to 'horizontal'. */
  orientation?: StepsOrientation;
  /** Accessible name for the wrapping nav landmark. Defaults to 'Progress'. */
  label?: string;
  /**
   * Visually-hidden text prepended to completed steps so screen readers
   * announce state + label. Defaults to 'Completed'.
   */
  completedLabel?: string;
  /**
   * Visually-hidden text prepended to skipped steps so screen readers announce
   * state + label. Defaults to 'Skipped'.
   */
  skippedLabel?: string;
  /** Additional class names merged with `.cinder-steps`. */
  class?: string;
};
