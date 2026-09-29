/**
 * Live-feed-only observation for one signal `getTimeline()`/`GET
 * /api/v1/workflows/:id` never carries (plan T3.4's async-activity
 * completion drawer): the durable async-activity completion token.
 *
 * ## Why this exists — and its one real limitation
 *
 * Verified against weft v0.11.0 and a live dev-harness curl of `GET
 * /api/v1/events/sse?workflowId=<id>` on the `ship-package-async` fixture:
 * `activity:async-pending` (carrying `token`, `operationId`,
 * `activityName`, `attempt`) is in `EVENTS_READ_EVENT_TYPES`, so the fleet
 * feed (`GET …/events/sse`, NOT the durable per-workflow event log —
 * `getEvents()` only ever records `workflow:checkpoint` markers, see
 * `events-tab.svelte`) replays it on a FRESH connection (confirmed live: a
 * brand-new SSE connection to the fixture replayed its
 * `activity:async-pending` frame, `payload.token` intact, before the
 * `replayComplete` ping). Neither `WorkflowState` nor
 * `WorkflowTimelineEntry` carries this token at all — this is the ONLY way
 * the console can discover it.
 *
 * That replay is per-CONNECTION, not per-subscriber: `FleetEventSource`
 * (`lib/live-source/fleet-event-source.svelte.ts`) shares ONE connection
 * app-wide (plan §5's ≤3-socket budget) and does not re-deliver
 * already-dispatched frames to a subscriber that joins after the shared
 * connection's replay phase has already passed.
 *
 * **Confirmed empirically (live browser, fresh tab, dev harness) that this
 * NEVER actually recovers replay in this app today.** This class is
 * instantiated from `workflow-detail.svelte`'s mount specifically to join
 * as early as this track's files can reach — but `src/app/shell/shell.svelte`
 * constructs `EngineStatusController` (`src/app/engine-status.svelte.ts`),
 * whose constructor calls `this.fleetSource.subscribe(...)` SYNCHRONOUSLY,
 * and the shell mounts before any route (including workflow detail) ever
 * does. That shell subscription is therefore always the first subscriber on
 * every page load, always wins the shared connection's one-time replay, and
 * every later subscriber — this one included, no matter how early within
 * route-level code it runs — only ever sees frames emitted AFTER that. This
 * is a genuine Foundation-layer property (`FleetEventSource` has no "buffer
 * replay for late joiners" mode), out of this track's owned paths to fix.
 * The code below is kept — it is correct, fully unit-tested, and does the
 * right thing on `activity:async-pending` frames that DO arrive live (an
 * operator watching the Timeline tab in real time while a token is minted)
 * — but do not expect it to populate on a typical page load. weft ships
 * `weft.workflows.activities.pending.list` (bounded, paginated, durable
 * pending-async-activity discovery) as of `@lostgradient/weft@0.15.0` —
 * available but not yet adopted here; wiring the Timeline tab's
 * async-activity affordances onto it instead of this live-only heuristic is
 * a real follow-up, out of scope for this pass (see this session's report).
 *
 * The finalizer teardown half of this class (`finalizingLive`/
 * `finalizerTeardown`) is GONE, not just renamed: weft#732 item 4 shipped
 * `weft.workflows.finalizer.get`, a durable field with none of this
 * replay-ordering problem, so `workflow-detail.svelte` now fetches finalizer
 * status directly as a plain query instead of inferring it from a live event
 * this class might miss — see `finalizer-strip.svelte`'s module doc.
 *
 * Never reconstructs a token by re-deriving weft's internal
 * `async-act:v1:<workflowId>:<step>:<attempt>` format
 * (`deriveAsyncActivityToken`, unexported from `@lostgradient/weft`) — that
 * would be fragile coupling to a private implementation detail (confirmed
 * live: its internal step numbering is 0-indexed, off by one from the
 * timeline's 1-indexed `step`), exactly the kind of magic-string special
 * case this repo's CLAUDE.md forbids.
 */
import type { QueryClient } from '@tanstack/svelte-query';

import type { FleetEventFrame } from '../../../../lib/live-source/fleet-event-source.svelte.ts';
import { pendingAsyncActivitiesQueryKey } from '../async-activity/async-activity-query.ts';
import { workflowTimelineQueryKey } from '../workflow-timeline-data.ts';

export interface PendingAsyncActivityObservation {
  readonly token: string;
  readonly operationId: string;
  readonly activityName: string;
  readonly step?: number;
  readonly attempt: number;
  readonly observedAt: number;
}

interface AsyncPendingPayload {
  readonly token: string;
  readonly operationId: string;
  readonly activityName: string;
  readonly attempt: number;
}

function isAsyncPendingPayload(payload: unknown): payload is AsyncPendingPayload {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return false;
  const record: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) record[key] = value;
  return (
    typeof record['token'] === 'string' &&
    typeof record['operationId'] === 'string' &&
    typeof record['activityName'] === 'string' &&
    typeof record['attempt'] === 'number'
  );
}

export interface FleetSubscribable {
  subscribe(
    onFrame: (frame: FleetEventFrame) => void,
    filter?: { readonly kind?: string; readonly workflowId?: string },
  ): () => void;
  readonly caughtUp: boolean;
}

/**
 * Subscribes to the shared fleet feed for one workflow's lifetime (owned by
 * whoever constructs it — `workflow-detail.svelte` does, at mount, so this
 * starts as close to page-load as this track's files can reach without
 * itself opening a second fleet connection). Call `dispose()` on unmount.
 */
export class WorkflowLiveObservations {
  pendingAsyncActivities = $state<PendingAsyncActivityObservation[]>([]);

  readonly #unsubscribe: () => void;

  constructor(
    fleet: FleetSubscribable,
    queryClient: Pick<QueryClient, 'invalidateQueries'>,
    workflowId: string,
  ) {
    this.#unsubscribe = fleet.subscribe(
      (frame) => this.#handleFrame(frame, queryClient, workflowId),
      { workflowId },
    );
  }

  #handleFrame(
    frame: FleetEventFrame,
    queryClient: Pick<QueryClient, 'invalidateQueries'>,
    workflowId: string,
  ): void {
    if (frame.kind === 'activity:async-pending' && isAsyncPendingPayload(frame.payload)) {
      const payload = frame.payload;
      if (this.pendingAsyncActivities.some((observed) => observed.token === payload.token)) return;
      this.pendingAsyncActivities = [
        ...this.pendingAsyncActivities,
        {
          token: payload.token,
          operationId: payload.operationId,
          activityName: payload.activityName,
          attempt: payload.attempt,
          observedAt: frame.emittedAtMs,
        },
      ];
    }

    // Any frame for this workflow may have moved a timeline entry's status
    // (e.g. an externally-completed async activity resuming the run to its
    // next step) — refetch so a stale "still running" badge self-heals
    // without this module needing its own removal signal (see module doc:
    // there is no `activity:completed`/`activity:failed` event for the
    // async-completion path at all).
    void queryClient.invalidateQueries({ queryKey: workflowTimelineQueryKey(workflowId) });
    void queryClient.invalidateQueries({ queryKey: pendingAsyncActivitiesQueryKey(workflowId) });
  }

  /** Optimistically drops a token from the observed-pending list right after this console's own drawer resolves it — see module doc for why the fleet feed itself never signals removal. */
  forgetToken(token: string): void {
    this.pendingAsyncActivities = this.pendingAsyncActivities.filter(
      (observed) => observed.token !== token,
    );
  }

  dispose(): void {
    this.#unsubscribe();
  }
}
