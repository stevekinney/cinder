/**
 * Client-side event-history export (plan §9.2 "Event history export", design
 * `Weft New Surfaces.dc.html` §G: "Events Download menu (Event history ·
 * JSON / Events + timeline · JSON)"). Pure over `GET …/events` (+ optionally
 * `GET …/timeline`) — no upstream work, no server round-trip beyond the
 * fetches the tab already performs.
 */
import type { WorkflowEvent, WorkflowTimelineEntry } from '@lostgradient/weft';

export interface EventHistoryExport {
  readonly workflowId: string;
  readonly exportedAt: string;
  readonly events: readonly WorkflowEvent[];
}

export interface EventsAndTimelineExport extends EventHistoryExport {
  readonly timeline: readonly WorkflowTimelineEntry[];
}

/** Builds the "Event history · JSON" export payload. */
export function buildEventHistoryExport(
  workflowId: string,
  events: readonly WorkflowEvent[],
  now: number = Date.now(),
): EventHistoryExport {
  return { workflowId, exportedAt: new Date(now).toISOString(), events };
}

/** Builds the "Events + timeline · JSON" export payload. */
export function buildEventsAndTimelineExport(
  workflowId: string,
  events: readonly WorkflowEvent[],
  timeline: readonly WorkflowTimelineEntry[],
  now: number = Date.now(),
): EventsAndTimelineExport {
  return { ...buildEventHistoryExport(workflowId, events, now), timeline };
}

/** Filename for a given export, e.g. `wf_4a9f8c31-events-2026-07-20T18-04-00.json`. Colons are filesystem-hostile on Windows, so they're stripped from the ISO timestamp. */
export function exportFilename(workflowId: string, kind: 'events' | 'events-and-timeline'): string {
  const stamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+$/, '');
  return `${workflowId}-${kind}-${stamp}.json`;
}

/**
 * Triggers a browser download of `data` as a formatted JSON file named
 * `filename`. DOM side effect, kept to one tiny function so the payload
 * builders above stay pure and unit-testable without a DOM.
 */
export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}
