/**
 * Pure derivations over `GET …/timeline` (`client.getTimeline(id)`) for the
 * Signals tab (plan T2.6).
 *
 * ## Why the timeline, not `getEvents()`
 *
 * Verified empirically against a live dev-harness workflow (start a
 * `signal-stepped` fixture run, send it a signal, diff `GET
 * …/events` before/after): the durable per-workflow event log
 * (`engine.getEvents()`, weft v0.11.0 `src/core/engine/checkpoint-reads.ts`)
 * records only `workflow:checkpoint` markers (`{ step }`) — no
 * `signal:received`/`update:received` entries ever appear there, regardless
 * of what `EVENTS_READ_EVENT_TYPES` documents for the live fleet/tail
 * channels. `GET …/timeline` (`engine.getTimeline()`), by contrast, records
 * one rich entry per durable operation — `operationType: 'wait-signal'`
 * with `operationLabel` as the signal name — confirmed against the same
 * live workflow. This module reads that instead. (The Timeline *tab*'s own
 * UI, T3.1, is a different track; this module only calls the same
 * read-only `client.getTimeline()` the Timeline tab will also call — no
 * coupling to its component.)
 *
 * ## Children moved off the timeline entirely (weft#732 item 1, shipped 0.15.0)
 *
 * This module used to also export `childWorkflowsFromTimeline`, deriving
 * Children-tab/Lineage-panel rows from `operationType: 'child-workflow'`
 * timeline entries — `WorkflowTimelineEntry.outputSummary` could never
 * reliably recover a real child workflow id (an AWAITED child's
 * `outputSummary` is its own arbitrary business result, indistinguishable
 * from a DETACHED child's `{"id":"..."}` result), so every row rendered
 * with `workflowId: null` and no working link. `WorkflowState.
 * parentWorkflowId` + `ListFilter.parentWorkflowId` are now public
 * (weft#732 item 1), so `children-tab.svelte` and `lineage-panel.svelte`
 * query `client.list({ parentWorkflowId })` directly instead — real ids,
 * real links, no timeline coupling. See those two components' module docs
 * for the live verification.
 */
import type { WorkflowTimelineEntry, WorkflowTimelineStatus } from '@lostgradient/weft';
import type { QueryKey } from '@tanstack/svelte-query';

/** Shared `getTimeline(id)` query key — used by the Signals tab (history), the Timeline tab, and the Events tab's linked selection, so all readers share the same TanStack Query cache entry instead of drifting into separately-keyed duplicate fetches. */
export function workflowTimelineQueryKey(workflowId: string): QueryKey {
  return ['workflows', 'timeline', workflowId];
}

export interface SignalTimelineRow {
  readonly step: number;
  readonly name: string;
  readonly status: WorkflowTimelineStatus;
  readonly timestamp: number;
}

/** Signals delivered to a `ctx.waitForSignal()` wait point, oldest first. Signals sent while the workflow was not yet waiting for them are not visible here — see module doc. */
export function signalHistoryFromTimeline(
  entries: readonly WorkflowTimelineEntry[],
): SignalTimelineRow[] {
  return entries
    .filter((entry) => entry.operationType === 'wait-signal')
    .map((entry) => ({
      step: entry.step,
      name: entry.operationLabel,
      status: entry.status,
      timestamp: entry.timestamp,
    }));
}
