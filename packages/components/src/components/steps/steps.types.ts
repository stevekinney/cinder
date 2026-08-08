import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

export type StepsOrientation = 'horizontal' | 'vertical';
export type StepItemState = 'complete' | 'current' | 'upcoming' | 'skipped';
export type StepItem = {
  /** Stable identifier used as the keyed-each key. Must be unique. */
  id: string;
  /**
   * Visible label for the step. Accepts plain text or a snippet. Snippet
   * content is rendered inside a `<span>` that may itself sit inside the
   * step's generated `<a>`/`<button>` — emit phrasing content only (text,
   * inline formatting, icons), never block or interactive elements.
   */
  label: string | Snippet;
  /**
   * Optional secondary text shown beneath the label. Accepts plain text or a
   * snippet, with the same phrasing-only, non-interactive constraint as
   * `label` — the content can end up inside the step's own control.
   */
  description?: string | Snippet;
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
export type StepsProps = Omit<HTMLAttributes<HTMLElement>, 'class'> & {
  /** Ordered list of step entries from first to last. */
  steps: StepItem[];
  /**
   * Zero-based index of the active step. Steps with index < currentStep are
   * "completed". Pass `steps.length` to mark every step as complete (terminal
   * "done" state).
   */
  currentStep: number;
  /** Layout direction. Defaults to 'horizontal'. @default "horizontal" */
  orientation?: StepsOrientation;
  /** Accessible name for the wrapping nav landmark. Defaults to 'Progress'. @default "Progress" */
  label?: string;
  /**
   * Visually-hidden text prepended to completed steps so screen readers
   * announce state + label. Defaults to 'Completed'.
   * @default "Completed"
   */
  completedLabel?: string;
  /**
   * Visually-hidden text prepended to skipped steps so screen readers announce
   * state + label. Defaults to 'Skipped'.
   * @default "Skipped"
   */
  skippedLabel?: string;
  /** Additional class names merged with `.cinder-steps`. */
  class?: string;
};
