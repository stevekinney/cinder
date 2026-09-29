/**
 * Workflow-observability data access for the two operations weft#732 (items
 * 3 and 4) shipped in `@lostgradient/weft@0.15.0` (PR #760):
 *
 * - `weft.workflows.finalizer.get` — durable post-terminal finalizer
 *   progress/outcome (`WorkflowFinalizerStatus | null`). Consumed by the
 *   header badge (`workflow-status.ts`'s `finalizerStatusPresentation`) and
 *   the Timeline tab's finalizer strip (`timeline/finalizer-strip.svelte`) —
 *   both derive their special-status rendering from the SAME fetch, owned
 *   here in `workflow-detail.svelte`, rather than two independent
 *   heuristics disagreeing about the same workflow.
 * - `weft.workflows.scheduleprovenance.get` — the durable schedule id and
 *   optional occurrence timestamp that launched this run
 *   (`WorkflowScheduleProvenance | null`). Consumed by the Lineage panel's
 *   provenance row.
 *
 * ## Why the results are runtime-validated, not just typed
 *
 * Both operations declare `outputSchema: z.object({...}).nullable()`
 * server-side, but the GENERATED client catalog
 * (`weft/src/cli/generated/operation-client.generated.ts`, the actual
 * source of `HttpClient.operations[name]`'s return type) does not resolve a
 * `.nullable()` zod wrapper to a named TS type — both operations are really
 * typed `Promise<unknown>`. This module validates the real shapes
 * structurally at the boundary rather than casting blindly, matching
 * `./checkpoints/checkpoints-data.ts`'s and `../list/bulk-operations-client.ts`'s
 * identical pattern for the identical reason.
 *
 * Query keys are local to this module (matching `workflow-timeline-data.ts`'s
 * and `checkpoints-data.ts`'s precedent) rather than added to the frozen
 * `src/lib/query.ts`.
 */
import type { WorkflowFinalizerStatus, WorkflowScheduleProvenance } from '@lostgradient/weft';
import type { QueryKey } from '@tanstack/svelte-query';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const FINALIZER_STATUSES: ReadonlySet<string> = new Set([
  'pending',
  'running',
  'succeeded',
  'failed',
]);

function isWorkflowFinalizerStatus(value: unknown): value is WorkflowFinalizerStatus {
  return (
    isRecord(value) &&
    typeof value['status'] === 'string' &&
    FINALIZER_STATUSES.has(value['status']) &&
    typeof value['attempts'] === 'number'
  );
}

function parseFinalizerStatus(value: unknown): WorkflowFinalizerStatus | null {
  if (value === null) return null;
  if (!isWorkflowFinalizerStatus(value)) {
    throw new TypeError('weft.workflows.finalizer.get returned an unexpected shape');
  }
  return value;
}

function isWorkflowScheduleProvenance(value: unknown): value is WorkflowScheduleProvenance {
  return isRecord(value) && typeof value['scheduleId'] === 'string';
}

function parseScheduleProvenance(value: unknown): WorkflowScheduleProvenance | null {
  if (value === null) return null;
  if (!isWorkflowScheduleProvenance(value)) {
    throw new TypeError('weft.workflows.scheduleprovenance.get returned an unexpected shape');
  }
  return value;
}

/** Narrow surface `getFinalizerStatus` needs off `client.operations` — `weft.workflows.finalizer.get` has no ergonomic `WeftClient` method. Matches the REAL generated client type (`output: unknown`) — see module doc. Deliberately separate from `WorkflowScheduleProvenanceClient` below: each caller (header/Timeline tab vs. the Lineage panel) only ever needs one of the two operations, so a test double for one never has to also stub the other. */
export interface WorkflowFinalizerClient {
  readonly operations: {
    readonly 'weft.workflows.finalizer.get': (input: { workflowId: string }) => Promise<unknown>;
  };
}

/** Narrow surface `getScheduleProvenance` needs off `client.operations` — see `WorkflowFinalizerClient`'s doc for why this is a separate interface. */
export interface WorkflowScheduleProvenanceClient {
  readonly operations: {
    readonly 'weft.workflows.scheduleprovenance.get': (input: {
      workflowId: string;
    }) => Promise<unknown>;
  };
}

export function finalizerQueryKey(workflowId: string): QueryKey {
  return ['workflows', 'finalizer', workflowId];
}

export function scheduleProvenanceQueryKey(workflowId: string): QueryKey {
  return ['workflows', 'schedule-provenance', workflowId];
}

export async function getFinalizerStatus(
  client: WorkflowFinalizerClient,
  workflowId: string,
): Promise<WorkflowFinalizerStatus | null> {
  return parseFinalizerStatus(
    await client.operations['weft.workflows.finalizer.get']({ workflowId }),
  );
}

export async function getScheduleProvenance(
  client: WorkflowScheduleProvenanceClient,
  workflowId: string,
): Promise<WorkflowScheduleProvenance | null> {
  return parseScheduleProvenance(
    await client.operations['weft.workflows.scheduleprovenance.get']({ workflowId }),
  );
}
