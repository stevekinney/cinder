/**
 * Workflow status → display tone/order for the dashboard's own "Workflows
 * by status" card (plan §9.1; §10.1 status badge system: "green
 * running/healthy; blue/slate pending/info; amber suspended/draining/
 * finalizing/needs-changes; red failed/timed-out/rejected/contested/
 * dead-letter; gray terminal/paused/drained").
 *
 * Scoped to this route rather than `src/lib/**` (frozen for the parallel
 * phase, PROJECT-BRIEF) — a small, dashboard-local mapping over the 7 real
 * `WorkflowStatus` values (`@lostgradient/weft`, verified against
 * `weft/src/core/types/identity.ts`), not a shared design-system module.
 */
import type { WorkflowStatus } from '@lostgradient/weft';

import type { StatusDotStatus } from '@lostgradient/cinder';

export interface StatusToneInfo {
  readonly label: string;
  readonly tone: StatusDotStatus;
}

/**
 * Every `WorkflowStatus` mapped to its label + tone. `satisfies
 * Record<WorkflowStatus, StatusToneInfo>` forces a compile error if
 * `@lostgradient/weft` adds a new status this map doesn't account for (same
 * pattern as `faults.ts`'s `FAULT_CODE_TREATMENT_KIND`).
 */
const STATUS_TONE = {
  running: { label: 'Running', tone: 'success' },
  pending: { label: 'Pending', tone: 'pending' },
  suspended: { label: 'Suspended', tone: 'warning' },
  completed: { label: 'Completed', tone: 'neutral' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  failed: { label: 'Failed', tone: 'danger' },
  'timed-out': { label: 'Timed out', tone: 'danger' },
} as const satisfies Record<WorkflowStatus, StatusToneInfo>;

/** Display order for the status grid — active states first, terminal states last. */
export const STATUS_DISPLAY_ORDER: readonly WorkflowStatus[] = [
  'running',
  'pending',
  'suspended',
  'completed',
  'cancelled',
  'failed',
  'timed-out',
];

export function statusToneInfo(status: WorkflowStatus): StatusToneInfo {
  return STATUS_TONE[status];
}
