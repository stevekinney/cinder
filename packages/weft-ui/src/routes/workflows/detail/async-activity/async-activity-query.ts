import type { PendingAsyncActivityInfo } from '@lostgradient/weft';
import type { QueryKey } from '@tanstack/svelte-query';

import type { PendingAsyncActivityObservation } from '../timeline/workflow-live-observations.svelte.ts';

export const PENDING_ASYNC_ACTIVITY_OPERATION = 'weft.workflows.activities.pending.list' as const;

/** Shared cache key for the durable pending-activity page for one workflow. */
export function pendingAsyncActivitiesQueryKey(workflowId: string): QueryKey {
  return ['workflows', 'pending-async-activities', workflowId];
}

/** Converts the durable operation's page into the observation shape used by the Timeline UI. */
export function pendingAsyncActivityObservations(
  items: readonly PendingAsyncActivityInfo[],
): PendingAsyncActivityObservation[] {
  return items.map((item) => ({
    token: item.token,
    operationId: item.operationId,
    activityName: item.activityName,
    step: item.step,
    attempt: item.attempt,
    observedAt: item.createdAt,
  }));
}
