export type StepsOrientation = 'horizontal' | 'vertical';
export type StepItem = {
  /** Stable identifier used as the keyed-each key. Must be unique. */
  id: string;
  /** Visible label for the step. */
  label: string;
  /** Optional secondary text shown beneath the label. */
  description?: string;
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
  /** Additional class names merged with `.cinder-steps`. */
  class?: string;
};
