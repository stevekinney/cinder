/**
 * `WorkflowStatus` → status-badge presentation (plan §10.1, design
 * `Weft Patterns.dc.html` "Status badge system"). Pure mapping so the badge
 * tone/label/icon-name decision is unit-testable without mounting a
 * component; `workflow-status-badge.svelte` wraps this in a Cinder `Badge` +
 * `lucide-svelte` icon.
 *
 * **Scope note on `finalizing` / `cancelled — cleanup failed`.** The design
 * mock's status-badge section also shows these two sub-states (plan's
 * "status badges … incl. finalizing + cancelled-cleanup-failed"), but
 * `WorkflowSummary`/`WorkflowState` (`@lostgradient/weft` v0.11.0,
 * `core/types/state.ts` and `core/types/identity.ts`) expose no field that
 * distinguishes "cancelled, finalizer still running" or "cancelled,
 * finalizer failed" from plain `'cancelled'` — `WorkflowStatus` is a flat
 * 7-value union with nothing else on the summary shape to derive it from.
 * That data only exists on the per-run finalizer timeline (plan §9.2's
 * Timeline tab, Track A2/T3.2 — not this list). Modeling the two sub-states
 * here against a `WorkflowStatus` input they can never actually take would
 * be untestable dead code, so this module intentionally maps only the 7 real
 * `WorkflowStatus` values; the Timeline track owns the finalizer sub-states
 * against its own richer per-run data.
 */
import type { WorkflowStatus } from '@lostgradient/weft';

/** Cinder `Badge`/`StatusDot` tone (plan §10.1's 5-tone semantics). */
export type WorkflowStatusBadgeTone = 'success' | 'info' | 'warning' | 'danger' | 'neutral';

/** Lucide icon names (matches `design/Weft Patterns.dc.html`'s status badge icons verbatim). */
export type WorkflowStatusBadgeIcon =
  'play' | 'clock' | 'pause' | 'circle-x' | 'timer-off' | 'circle-check' | 'ban';

export interface WorkflowStatusBadgeSpec {
  readonly tone: WorkflowStatusBadgeTone;
  readonly icon: WorkflowStatusBadgeIcon;
  readonly label: string;
}

const WORKFLOW_STATUS_BADGE: Readonly<Record<WorkflowStatus, WorkflowStatusBadgeSpec>> = {
  running: { tone: 'success', icon: 'play', label: 'Running' },
  pending: { tone: 'info', icon: 'clock', label: 'Pending' },
  suspended: { tone: 'warning', icon: 'pause', label: 'Suspended' },
  failed: { tone: 'danger', icon: 'circle-x', label: 'Failed' },
  'timed-out': { tone: 'danger', icon: 'timer-off', label: 'Timed out' },
  completed: { tone: 'neutral', icon: 'circle-check', label: 'Completed' },
  cancelled: { tone: 'neutral', icon: 'ban', label: 'Cancelled' },
};

/** Badge tone/icon/label for a workflow's status (plan §10.1). Status is never color alone — callers must render `label` alongside `tone`. */
export function workflowStatusBadge(status: WorkflowStatus): WorkflowStatusBadgeSpec {
  return WORKFLOW_STATUS_BADGE[status];
}

/** Every status in a stable display order (matches the design's filter-chip order), for building the list's status filter facet. */
export const WORKFLOW_STATUS_ORDER: readonly WorkflowStatus[] = [
  'running',
  'pending',
  'suspended',
  'failed',
  'timed-out',
  'completed',
  'cancelled',
];
