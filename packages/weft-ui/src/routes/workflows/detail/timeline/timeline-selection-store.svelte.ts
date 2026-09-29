/**
 * Linked-selection store (plan design §E, BINDING — `Weft New Surfaces.dc.html`
 * §E; adopted from `temporal-explorer`'s linked-selection pattern, plan
 * §9.9(2)): `{ selectedStepId: string | null }`, shared by the Timeline tab
 * and the Events tab (Logs stays a permanent empty state — see
 * `logs-tab.svelte` — so there is nothing there to filter; the store still
 * "clears" correctly if a future data source lands).
 *
 * Module-scoped rather than passed down as a prop: `workflow-detail.svelte`
 * unmounts/remounts each `Tabs.Panel` on tab switch (Cinder's `tab-panel.svelte`
 * renders `{#if isActive}`), so Timeline and Events are never mounted
 * together — a prop can't carry selection between them, but two components
 * that read the same exported reactive object can. Only one workflow detail
 * page is ever mounted at a time (the route outlet's `{#key router.pathname}`
 * guarantees a fresh mount per navigation), so a single module-scoped
 * instance — reset on workflow id change — is sufficient; no per-app
 * context/provider indirection is needed for something this page-scoped.
 */
export interface TimelineSelectionState {
  selectedStepId: string | null;
}

const selection = $state<TimelineSelectionState>({ selectedStepId: null });
let ownerWorkflowId: string | null = null;

/**
 * Returns the shared selection state, resetting it first if `workflowId`
 * differs from whichever workflow last touched it (a real navigation to a
 * different run, not a same-workflow tab switch). Call this once per
 * component instance during setup — it is safe to call from both the
 * Timeline tab and the Events tab; whichever mounts first "claims" the
 * workflow id, and the other's call for the SAME id is a no-op.
 */
export function timelineSelectionFor(workflowId: string): TimelineSelectionState {
  if (ownerWorkflowId !== workflowId) {
    ownerWorkflowId = workflowId;
    selection.selectedStepId = null;
  }
  return selection;
}

/** Selects a step, or deselects it if it was already the selection (click again to clear). */
export function selectTimelineStep(stepId: string): void {
  selection.selectedStepId = selection.selectedStepId === stepId ? null : stepId;
}

export function clearTimelineSelection(): void {
  selection.selectedStepId = null;
}
