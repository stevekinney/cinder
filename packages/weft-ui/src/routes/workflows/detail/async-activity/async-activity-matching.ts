/**
 * Best-effort linking of a live-observed pending async activity (plan T3.4)
 * to a specific timeline step, so the Timeline tab can badge the RIGHT step
 * "Awaiting external completion" instead of guessing.
 *
 * ## Why this is "best-effort, unambiguous-only" rather than exact
 *
 * Verified against weft v0.11.0: the `activity:async-pending` event
 * (`src/core/events/activity-events.ts`) carries `activityName` and
 * `attempt`, but no `step` — and `WorkflowTimelineEntry` carries no
 * `attempt` either (see `timeline-mapping.ts` module doc). There is no
 * field these two records share that uniquely identifies "this observation
 * IS this timeline entry." This module links them only when there is
 * exactly one RUNNING `activity`-type timeline entry with the observation's
 * `activityName` — safe because a step that has already resolved can't be
 * the one still awaiting completion, and an ambiguous multi-match (e.g. the
 * same activity run twice concurrently via `ctx.all`) is left unattached
 * rather than guessed at.
 */
import type { WorkflowTimelineEntry } from '@lostgradient/weft';

import { timelineStepId } from '../timeline/timeline-mapping.ts';
import type { PendingAsyncActivityObservation } from '../timeline/workflow-live-observations.svelte.ts';

export interface AttachedPendingActivity extends PendingAsyncActivityObservation {
  /** The `RunStep.id` this observation belongs to, or `null` when the match was ambiguous or absent. */
  readonly stepId: string | null;
}

function runningActivityStepsNamed(
  entries: readonly WorkflowTimelineEntry[],
  activityName: string,
): WorkflowTimelineEntry[] {
  return entries.filter(
    (entry) =>
      entry.operationType === 'activity' &&
      entry.operationLabel === activityName &&
      entry.status === 'running',
  );
}

function runningActivityStepsAt(
  entries: readonly WorkflowTimelineEntry[],
  step: number,
): WorkflowTimelineEntry[] {
  return entries.filter(
    (entry) =>
      entry.step === step && entry.operationType === 'activity' && entry.status === 'running',
  );
}

export function attachPendingActivitiesToSteps(
  pending: readonly PendingAsyncActivityObservation[],
  entries: readonly WorkflowTimelineEntry[],
): AttachedPendingActivity[] {
  return pending.map((observation) => {
    const stepMatches =
      observation.step === undefined ? [] : runningActivityStepsAt(entries, observation.step);
    const matches =
      stepMatches.length > 0
        ? stepMatches
        : runningActivityStepsNamed(entries, observation.activityName);
    const single = matches.length === 1 ? matches[0] : undefined;
    return { ...observation, stepId: single !== undefined ? timelineStepId(single.step) : null };
  });
}
