/**
 * Writes `LiveSource` frames into the TanStack `QueryClient` (plan §4, §5.1,
 * T1.4): "Frames write into the TanStack cache (setQueryData on detail +
 * events); components render from the cache so a disconnect degrades to
 * last-known-state, never a blank."
 *
 * **Query-key contract.** Plan §4 lists `['workflows','detail',id]` and
 * `['workflows','events',id,cursor]` among the console's query keys. The
 * `cursor` element on the events key is Track A's (Phase 2/3) concern — a
 * paginated "load older history" query this module does not know the shape
 * of. What THIS module writes is the plain, uncursored
 * `['workflows','events',id]` key: the live-tail cache a workflow detail
 * page's live Events view reads from (seeded by an initial `getEvents()`
 * fetch, kept fresh incrementally by `WorkflowTailSource` frames through
 * `applyWorkflowTailFrame`). The two keys serve different purposes and
 * MUST NOT be conflated — flagged explicitly here (and in T1.4's final
 * report) so Track A's own query design lines up with what actually gets
 * written. The key-builder functions below are exported specifically so
 * Track A imports them rather than re-deriving the same array literal by
 * hand, which would silently drift if this module's shape ever changes.
 *
 * **Detail patching is a status-only contract.** `WorkflowSummary` (the
 * real detail/list-row shape, `@lostgradient/weft`) is Track A's to fetch
 * and cache; this module never invents a full one. It patches ONLY
 * `status`/`updatedAt` on whatever is already cached, and only when
 * something is already cached (`setQueryData`'s updater returning the
 * untouched `old` value for a cache-miss is a no-op per TanStack's own
 * `setQueryData` — verified in `@tanstack/query-core`'s source: it never
 * creates a new query entry from an updater's `undefined` result).
 *
 * **Fleet fan-out is invalidation-only, deliberately.** `FleetEventSource`
 * frames never append into the events cache — only `WorkflowTailSource`
 * does. A workflow detail page can have BOTH a tail and (indirectly) the
 * fleet feed observing the same event; writing it through two independent
 * paths risks visible duplicates the tail's own positional dedup can't see.
 * Fleet frames instead invalidate the list/detail/aggregate queries that
 * plan §5.2 names ("list-row liveness (invalidate/patch matching list
 * queries)"), reusing the exact same key shapes plan §4's mutation
 * invalidation already uses, so live-event invalidation and
 * client-initiated-mutation invalidation stay one convention.
 *
 * **Out of scope.** Session-scoped fleet kinds with no persisted list query
 * at this phase — `alert:*`, `constraint:violated`, `checkpoint:size-
 * warning`, `development:warning`, `cleanup:warning`, `storage:size-
 * reported` — are not mapped to any invalidation here. Plan Appendix B
 * frames the alerts/warnings surface as "session-scoped" fed directly by
 * `FleetEventSource.subscribe()`, not by a cache entry this module owns.
 */
import type { WorkflowEvent, WorkflowStatus } from '@lostgradient/weft';
import type { QueryClient, QueryKey } from '@tanstack/svelte-query';

import type { FleetEventFrame } from './fleet-event-source.svelte.ts';
import { workflowStatusForEventType } from './workflow-lifecycle-events.ts';

// ---------------------------------------------------------------------------
// Query keys (plan §4). Import these rather than re-deriving the arrays.
// ---------------------------------------------------------------------------

export function workflowDetailKey(workflowId: string): QueryKey {
  return ['workflows', 'detail', workflowId];
}

/** Matches `finalizerQueryKey(id)` (`../../routes/workflows/detail/workflow-observability.ts`) — kept as a literal here (not an import) for the same reason every other key in this module is. */
export function workflowFinalizerKey(workflowId: string): QueryKey {
  return ['workflows', 'finalizer', workflowId];
}

/** The live-tail events cache — see module doc for how this differs from Track A's cursor-paginated key. */
export function workflowEventsKey(workflowId: string): QueryKey {
  return ['workflows', 'events', workflowId];
}

export const WORKFLOWS_LIST_KEY_PREFIX: QueryKey = ['workflows', 'list'];
export const WORKFLOWS_AGGREGATE_KEY_PREFIX: QueryKey = ['workflows', 'aggregate'];
export const SCHEDULES_LIST_KEY_PREFIX: QueryKey = ['schedules', 'list'];
export const REVIEWS_LIST_KEY_PREFIX: QueryKey = ['reviews', 'list'];
export const WORKERS_LIST_KEY: QueryKey = ['workers', 'list'];

/** Fleet event kinds with no `workflowId` that map to a specific list query to invalidate. Extend as new tracks add list surfaces. */
const NON_WORKFLOW_KIND_INVALIDATION: ReadonlyMap<string, QueryKey> = new Map([
  ['schedule:fired', SCHEDULES_LIST_KEY_PREFIX],
  ['schedule:missed-fire', SCHEDULES_LIST_KEY_PREFIX],
  ['human-review:requested', REVIEWS_LIST_KEY_PREFIX],
  ['human-review:completed', REVIEWS_LIST_KEY_PREFIX],
  ['worker:connected', WORKERS_LIST_KEY],
  ['worker:disconnected', WORKERS_LIST_KEY],
]);

// ---------------------------------------------------------------------------
// WorkflowTailSource → cache
// ---------------------------------------------------------------------------

interface WorkflowStatusCacheShape {
  readonly status: WorkflowStatus;
  readonly updatedAt: number;
}

function patchWorkflowDetailStatus(
  queryClient: QueryClient,
  workflowId: string,
  status: WorkflowStatus,
  updatedAtMs: number,
): void {
  queryClient.setQueryData<WorkflowStatusCacheShape>(workflowDetailKey(workflowId), (old) =>
    old === undefined ? old : { ...old, status, updatedAt: updatedAtMs },
  );
}

function appendWorkflowEvent(
  queryClient: QueryClient,
  workflowId: string,
  event: WorkflowEvent,
): void {
  queryClient.setQueryData<WorkflowEvent[]>(workflowEventsKey(workflowId), (old) =>
    old === undefined ? [event] : [...old, event],
  );
}

/** Applies one `WorkflowTailSource` frame: appends to the events cache, and patches the detail cache's status when the event represents a lifecycle transition. */
export function applyWorkflowTailFrame(
  queryClient: QueryClient,
  workflowId: string,
  event: WorkflowEvent,
): void {
  appendWorkflowEvent(queryClient, workflowId, event);
  const status = workflowStatusForEventType(event.type);
  if (status !== null) patchWorkflowDetailStatus(queryClient, workflowId, status, event.timestamp);
}

// ---------------------------------------------------------------------------
// FleetEventSource → cache
// ---------------------------------------------------------------------------

/** Applies one `FleetEventSource` frame: invalidates the list/detail/aggregate queries it affects. Never writes into the events append cache — see module doc. */
export function applyFleetEventFrame(queryClient: QueryClient, frame: FleetEventFrame): void {
  if (frame.workflowId !== undefined) {
    void queryClient.invalidateQueries({ queryKey: WORKFLOWS_LIST_KEY_PREFIX });
    void queryClient.invalidateQueries({ queryKey: WORKFLOWS_AGGREGATE_KEY_PREFIX });
    void queryClient.invalidateQueries({ queryKey: workflowDetailKey(frame.workflowId) });
    // The durable finalizer field (`weft.workflows.finalizer.get`, weft#732
    // item 4, shipped 0.15.0) only ever changes alongside a lifecycle event
    // naming this workflow — a `workflow:teardown` frame chief among them —
    // so any such frame is a reasonable trigger to refetch it, independent
    // of whether this session's fleet connection actually replayed the
    // specific `workflow:teardown` frame (the durable field is
    // authoritative either way; this is just "refresh sooner").
    void queryClient.invalidateQueries({ queryKey: workflowFinalizerKey(frame.workflowId) });
    return;
  }

  const listKey = NON_WORKFLOW_KIND_INVALIDATION.get(frame.kind);
  if (listKey !== undefined) void queryClient.invalidateQueries({ queryKey: listKey });
}
