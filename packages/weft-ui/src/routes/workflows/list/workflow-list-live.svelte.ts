/**
 * Workflow list Live toggle (plan §9.2 T2.1, §5's UI treatment: "'+N
 * events' pause-to-read counter on fast streams … lists default Live
 * off"). Subscribes to the shell's ONE shared `FleetEventSource`
 * (`getFleetEventSource()`, `src/app/engine-status.svelte.ts` — added by
 * another track as the fix for the exact gap this surface would otherwise
 * hit: no route component could reach the shared connection before that
 * addition landed) rather than opening a second fleet SSE connection, per
 * plan §5's "≤3 concurrent sockets … never per-row/per-surface
 * connections" budget.
 *
 * Deliberately does NOT auto-refetch the list on every incoming frame —
 * that would reflow visible rows out from under someone mid-read. Frames
 * only increment a counter (gated on `source.caughtUp`, the same "don't
 * count replay backlog as new arrivals" rule `engine-status.svelte.ts` uses
 * for its own toast suppression) until the caller explicitly `refresh()`es,
 * which is what actually invalidates the cached list query
 * (`WORKFLOWS_LIST_KEY_PREFIX`, `src/lib/live-source/cache-integration.ts`)
 * so TanStack refetches it.
 */
import type { QueryClient } from '@tanstack/svelte-query';

import { WORKFLOWS_LIST_KEY_PREFIX } from '../../../lib/live-source/cache-integration.ts';
import type { FleetEventFrame } from '../../../lib/live-source/fleet-event-source.svelte.ts';
import type { LiveSourceStatus } from '../../../lib/live-source/types.ts';

/** The slice of `FleetEventSource` this controller needs — narrowed for testability (a fake source in tests doesn't need the whole SSE implementation). */
export interface WorkflowListLiveSource {
  readonly status: LiveSourceStatus;
  readonly caughtUp: boolean;
  subscribe(onFrame: (frame: FleetEventFrame) => void): () => void;
}

export class WorkflowListLiveController {
  enabled = $state(false);
  /** Frames observed since the last `refresh()` (or since enabling), gated on `source.caughtUp`. */
  newCount = $state(0);

  readonly #source: WorkflowListLiveSource;
  readonly #queryClient: QueryClient;
  #unsubscribe: (() => void) | null = null;

  constructor(source: WorkflowListLiveSource, queryClient: QueryClient) {
    this.#source = source;
    this.#queryClient = queryClient;
  }

  get status(): LiveSourceStatus {
    return this.#source.status;
  }

  /** Turns Live on: subscribes to the shared fleet feed and starts counting workflow-scoped arrivals. */
  enable(): void {
    if (this.enabled) return;
    this.enabled = true;
    this.#unsubscribe = this.#source.subscribe((frame) => this.#handleFrame(frame));
  }

  /** Turns Live off: unsubscribes and clears the pending counter (existing rows stay as last fetched — turning Live off is not a "revert to stale data" action). */
  disable(): void {
    if (!this.enabled) return;
    this.enabled = false;
    this.newCount = 0;
    this.#unsubscribe?.();
    this.#unsubscribe = null;
  }

  /** Invalidates the cached list query so TanStack refetches it, and clears the pending counter. The "+N new · Refresh" click target calls this. */
  refresh(): void {
    this.newCount = 0;
    void this.#queryClient.invalidateQueries({ queryKey: WORKFLOWS_LIST_KEY_PREFIX });
  }

  dispose(): void {
    this.disable();
  }

  #handleFrame(frame: FleetEventFrame): void {
    // Only workflow-scoped events affect the list; fleet events with no
    // `workflowId` (schedule/worker/system kinds) never appear in it.
    if (frame.workflowId === undefined) return;
    // A fresh connection replays up to 1,000 historical events before
    // `caughtUp` flips true (plan Appendix A) — those aren't "new since I
    // turned Live on," so they don't count.
    if (!this.#source.caughtUp) return;
    this.newCount += 1;
  }
}
