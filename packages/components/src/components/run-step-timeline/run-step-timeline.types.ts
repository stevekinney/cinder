import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

/**
 * Generic execution state of a single run step.
 *
 * These names are intentionally domain-agnostic. Consumers map their
 * own domain state (e.g. Weft, CI, queue) onto this union; the
 * component does not encode product-specific status vocabulary.
 *
 * - `pending`   — not yet started; waiting in the queue.
 * - `running`   — currently executing within its lane.
 * - `succeeded` — completed successfully.
 * - `failed`    — completed with a terminal error.
 * - `cancelled` — was stopped before it could complete.
 * - `skipped`   — bypassed intentionally (e.g. conditional branch).
 * - `retrying`  — a prior attempt failed; a new attempt is in progress.
 * - `waiting_approval` — paused on required approval; can continue afterward.
 */
export type RunStepStatus =
  | 'pending'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'skipped'
  | 'retrying'
  | 'waiting_approval';

/**
 * A single expandable detail section attached to a step.
 * Rendered inside a Collapsible panel.
 */
export type RunStepDetail = {
  /** Stable identity for this detail panel. */
  id: string;
  /** Trigger label rendered on the Collapsible header. */
  label: string;
  /** Pre-formatted content shown inside the panel. */
  content: string;
};

/**
 * Navigable reference attached to a step.
 * Rendered with cinder's Link component.
 */
export type RunStepLink = {
  /** Destination URL for the step link. */
  href: string;
  /** Visible text for the step link. */
  label: string;
};

/**
 * One step in a RunStepTimeline.
 */
export type RunStep = {
  /** Stable identity; used as the keyed list identity. */
  id: string;
  /** Display label for this step. */
  label: string;
  /** Generic execution state. */
  status: RunStepStatus;
  /**
   * ISO datetime string for when this step started.
   * Absent for pending steps.
   */
  startTime?: string | undefined;
  /**
   * ISO datetime string for when this step ended.
   * Absent for pending and running steps.
   */
  endTime?: string | undefined;
  /**
   * Human-readable duration string, e.g. "1m 23s".
   * Absent for pending steps.
   */
  duration?: string | undefined;
  /**
   * Number of attempts made so far, including any retries.
   * Displayed when greater than 1.
   */
  attemptCount?: number | undefined;
  /**
   * Number of actions associated with this step.
   * Displayed when greater than 0.
   */
  actionsCount?: number | undefined;
  /**
   * Optional determinate progress value between 0 and `progressMax`.
   * When supplied, a Progress bar is rendered for the step.
   */
  progress?: number | undefined;
  /**
   * Maximum value for the progress bar. Defaults to 100.
   */
  progressMax?: number | undefined;
  /**
   * Expandable detail panels (logs, payloads, errors) shown inline.
   */
  details?: RunStepDetail[] | undefined;
  /**
   * Optional link to logs, traces, or a step detail route.
   */
  link?: RunStepLink | undefined;
  /**
   * Nested child-workflow steps rendered as indented lanes.
   */
  children?: RunStep[] | undefined;
};

/**
 * Schema generator surface for one top-level step.
 * Public `RunStep` stays recursive; this finite shape keeps JSON Schema generation bounded.
 * @schemaObject
 */
export type RunStepTimelineSchemaStep = {
  /** Stable identity; used as the keyed list identity. */
  id: string;
  /** Display label for this step. */
  label: string;
  /** Generic execution state. */
  status: RunStepStatus;
  /**
   * ISO datetime string for when this step started.
   * Absent for pending steps.
   */
  startTime?: string | undefined;
  /**
   * ISO datetime string for when this step ended.
   * Absent for pending and running steps.
   */
  endTime?: string | undefined;
  /**
   * Human-readable duration string, e.g. "1m 23s".
   * Absent for pending steps.
   */
  duration?: string | undefined;
  /**
   * Number of attempts made so far, including any retries.
   * Displayed when greater than 1.
   */
  attemptCount?: number | undefined;
  /**
   * Number of actions associated with this step.
   * Displayed when greater than 0.
   */
  actionsCount?: number | undefined;
  /**
   * Optional determinate progress value between 0 and `progressMax`.
   * When supplied, a Progress bar is rendered for the step.
   */
  progress?: number | undefined;
  /**
   * Maximum value for the progress bar. Defaults to 100.
   */
  progressMax?: number | undefined;
  /**
   * Expandable detail panels (logs, payloads, errors) shown inline.
   */
  details?: RunStepDetail[] | undefined;
  /**
   * Optional link to logs, traces, or a step detail route.
   */
  link?: RunStepLink | undefined;
  /**
   * Schema-bounded nested child-workflow steps.
   */
  children?: RunStepTimelineSchemaChildStep[] | undefined;
};

/**
 * Schema generator surface for one nested child step rendered at depth 1.
 * @schemaObject
 */
export type RunStepTimelineSchemaChildStep = {
  /** Stable identity; used as the keyed list identity. */
  id: string;
  /** Display label for this step. */
  label: string;
  /** Generic execution state. */
  status: RunStepStatus;
  /** ISO datetime string for when this step started. */
  startTime?: string | undefined;
  /** ISO datetime string for when this step ended. */
  endTime?: string | undefined;
  /** Human-readable duration string, e.g. "1m 23s". */
  duration?: string | undefined;
  /** Number of attempts made so far, including any retries. */
  attemptCount?: number | undefined;
  /** Number of actions associated with this step. */
  actionsCount?: number | undefined;
  /** Optional determinate progress value between 0 and `progressMax`. */
  progress?: number | undefined;
  /** Maximum value for the progress bar. Defaults to 100. */
  progressMax?: number | undefined;
  /** Expandable detail panels (logs, payloads, errors) shown inline. */
  details?: RunStepDetail[] | undefined;
  /** Optional link to logs, traces, or a step detail route. */
  link?: RunStepLink | undefined;
  /**
   * Nested child-workflow steps rendered at depth 2.
   */
  children?: RunStepTimelineSchemaGrandchildStep[] | undefined;
};

/**
 * Schema generator surface for one nested child step rendered at depth 2.
 * @schemaObject
 */
export type RunStepTimelineSchemaGrandchildStep = {
  /** Stable identity; used as the keyed list identity. */
  id: string;
  /** Display label for this step. */
  label: string;
  /** Generic execution state. */
  status: RunStepStatus;
  /** ISO datetime string for when this step started. */
  startTime?: string | undefined;
  /** ISO datetime string for when this step ended. */
  endTime?: string | undefined;
  /** Human-readable duration string, e.g. "1m 23s". */
  duration?: string | undefined;
  /** Number of attempts made so far, including any retries. */
  attemptCount?: number | undefined;
  /** Number of actions associated with this step. */
  actionsCount?: number | undefined;
  /** Optional determinate progress value between 0 and `progressMax`. */
  progress?: number | undefined;
  /** Maximum value for the progress bar. Defaults to 100. */
  progressMax?: number | undefined;
  /** Expandable detail panels (logs, payloads, errors) shown inline. */
  details?: RunStepDetail[] | undefined;
  /** Optional link to logs, traces, or a step detail route. */
  link?: RunStepLink | undefined;
  /**
   * Nested child-workflow steps rendered at depth 3.
   */
  children?: RunStepTimelineSchemaGreatGrandchildStep[] | undefined;
};

/**
 * Schema generator surface for one nested child step rendered at depth 3.
 * @schemaObject
 */
export type RunStepTimelineSchemaGreatGrandchildStep = {
  /** Stable identity; used as the keyed list identity. */
  id: string;
  /** Display label for this step. */
  label: string;
  /** Generic execution state. */
  status: RunStepStatus;
  /** ISO datetime string for when this step started. */
  startTime?: string | undefined;
  /** ISO datetime string for when this step ended. */
  endTime?: string | undefined;
  /** Human-readable duration string, e.g. "1m 23s". */
  duration?: string | undefined;
  /** Number of attempts made so far, including any retries. */
  attemptCount?: number | undefined;
  /** Number of actions associated with this step. */
  actionsCount?: number | undefined;
  /** Optional determinate progress value between 0 and `progressMax`. */
  progress?: number | undefined;
  /** Maximum value for the progress bar. Defaults to 100. */
  progressMax?: number | undefined;
  /** Expandable detail panels (logs, payloads, errors) shown inline. */
  details?: RunStepDetail[] | undefined;
  /** Optional link to logs, traces, or a step detail route. */
  link?: RunStepLink | undefined;
};

/**
 * Props for the RunStepTimeline component.
 *
 * Renders an ordered list of execution steps with per-step status,
 * durations, retry counts, optional progress indicators, and expandable
 * detail panels for logs, payloads, and errors.
 */
export type RunStepTimelineProps = Omit<HTMLAttributes<HTMLOListElement>, 'class' | 'children'> & {
  /**
   * Ordered list of steps to render.
   * @schemaObject
   */
  steps: RunStep[];
  /**
   * Accessible label for the timeline list.
   * Used as `aria-label` when `aria-labelledby` is absent.
   */
  label?: string | undefined;
  /**
   * Optional per-step body content rendered after the step metadata.
   */
  children?: Snippet<[RunStep]> | undefined;
  /** Additional CSS classes applied to the root element. */
  class?: string | undefined;
};

/** Schema generator surface for RunStepTimeline — excludes snippet props. */
export interface RunStepTimelineSchemaProps {
  /**
   * Ordered list of steps to render.
   * @schemaObject
   */
  steps: RunStepTimelineSchemaStep[];
  /** Accessible label for the timeline list. */
  label?: string | undefined;
  /** Additional CSS classes applied to the root element. */
  class?: string | undefined;
}
