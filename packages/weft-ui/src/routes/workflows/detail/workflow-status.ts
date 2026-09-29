/**
 * Workflow status → presentation mapping (plan T2.4, §10.1 status badge
 * system) + contextual-action availability for the detail header.
 *
 * ## "Finalizing" / "Cancelled — cleanup failed" — real, as of weft 0.15.0
 *
 * Plan §9.2 and Appendix B call for a `finalizing` (amber, post-cancellation
 * cleanup) and a `cancelled — cleanup failed` (red) sub-status on the header
 * badge. This was a genuine gap through weft v0.11.0 (filed as weft#732 item
 * 4: no durable field, `Engine.get()` didn't enrich the state, the
 * finalizer's `teardownOwed` bookkeeping was internal-only) — `@lostgradient/
 * weft@0.15.0` (PR #760) closed it with `weft.workflows.finalizer.get`
 * (REST `GET /api/v1/workflows/:id/finalizer`), returning durable
 * `WorkflowFinalizerStatus | null` (`pending`/`running`/`succeeded`/`failed`,
 * each carrying `attempts` and the relevant timestamp/error). Per weft's own
 * `documentation/guides/workflows.md` ("Durable cancellation teardown"), a
 * finalizer only ever runs after a workflow reaches `cancelled` or
 * `timed-out` — `completed`/`failed` never drive one. `workflow-detail.svelte`
 * fetches this alongside the workflow itself and passes it down as a plain
 * prop (not fetched inside this module — this module stays a pure mapping),
 * so `finalizerStatusPresentation` below is the one place both the header
 * badge and the Timeline tab's finalizer strip derive the same two sub-states
 * from the same real field, instead of each independently inferring it from
 * session-scoped live events the way the console used to.
 */
import type { WorkflowFinalizerStatus, WorkflowStatus } from '@lostgradient/weft';

import type { BadgeVariant } from '@lostgradient/cinder';

export type WorkflowStatusIcon =
  | 'clock'
  | 'play'
  | 'pause'
  | 'circle-check'
  | 'circle-x'
  | 'ban'
  | 'timer-off'
  | 'loader'
  | 'triangle-alert';

export interface WorkflowStatusPresentation {
  readonly label: string;
  readonly variant: BadgeVariant;
  readonly icon: WorkflowStatusIcon;
  /** Set only for the two finalizer sub-states — the header/strip wrap the badge in a `Tooltip` when present (design: "Finalizing & finalizer-failed carry explanatory tooltips"). */
  readonly tooltip?: string;
}

/** Status → badge tone/label/icon (plan §10.1: green running, blue/slate pending, amber suspended, red failed/timed-out, gray terminal). */
const STATUS_PRESENTATION: Readonly<Record<WorkflowStatus, WorkflowStatusPresentation>> = {
  pending: { label: 'Pending', variant: 'info', icon: 'clock' },
  running: { label: 'Running', variant: 'success', icon: 'play' },
  suspended: { label: 'Suspended', variant: 'warning', icon: 'pause' },
  completed: { label: 'Completed', variant: 'neutral', icon: 'circle-check' },
  failed: { label: 'Failed', variant: 'danger', icon: 'circle-x' },
  cancelled: { label: 'Cancelled', variant: 'neutral', icon: 'ban' },
  'timed-out': { label: 'Timed out', variant: 'danger', icon: 'timer-off' },
};

export function workflowStatusPresentation(status: WorkflowStatus): WorkflowStatusPresentation {
  return STATUS_PRESENTATION[status];
}

/** Only `cancelled`/`timed-out` can ever carry finalizer work — per weft's own docs, `completed`/`failed` never drive a finalizer. */
export function statusMayHaveFinalizer(
  status: WorkflowStatus,
): status is 'cancelled' | 'timed-out' {
  return status === 'cancelled' || status === 'timed-out';
}

const FINALIZER_BASE_LABEL: Readonly<Record<'cancelled' | 'timed-out', string>> = {
  cancelled: 'Cancelled',
  'timed-out': 'Timed out',
};

/**
 * `workflowStatusPresentation` plus the two real finalizer sub-states
 * (module doc). `finalizer` is `undefined` while the caller's own finalizer
 * query is still loading (falls back to the plain status badge — never
 * shows a sub-state speculatively) and `null` when the workflow recorded no
 * finalizer work at all (also the plain badge). Only `pending`/`running`
 * (→ Finalizing) and `failed` (→ "<status> — cleanup failed") change the
 * rendered badge; `succeeded` renders the plain terminal badge, matching the
 * design's "the two special states" framing — a finalizer that succeeded
 * isn't a special state, it's just a `cancelled`/`timed-out` run that
 * happened to also clean up after itself.
 */
export function finalizerStatusPresentation(
  status: WorkflowStatus,
  finalizer: WorkflowFinalizerStatus | null | undefined,
): WorkflowStatusPresentation {
  const base = workflowStatusPresentation(status);
  if (finalizer === null || finalizer === undefined || !statusMayHaveFinalizer(status)) return base;

  const baseLabel = FINALIZER_BASE_LABEL[status];

  if (finalizer.status === 'pending' || finalizer.status === 'running') {
    return {
      label: 'Finalizing',
      variant: 'warning',
      icon: 'loader',
      tooltip: `${baseLabel} and running its cleanup finalizer — completes when the finalizer finishes.`,
    };
  }

  if (finalizer.status === 'failed') {
    return {
      label: `${baseLabel} — cleanup failed`,
      variant: 'danger',
      icon: 'triangle-alert',
      tooltip: `Cleanup finalizer failed after ${finalizer.attempts} attempt${finalizer.attempts === 1 ? '' : 's'}: ${finalizer.error}`,
    };
  }

  return base;
}

const TERMINAL_STATUSES: ReadonlySet<WorkflowStatus> = new Set([
  'completed',
  'failed',
  'cancelled',
  'timed-out',
]);

export function isTerminalStatus(status: WorkflowStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

/**
 * Contextual header actions this track owns (plan T2.4). `client.get()`
 * catalog verification (weft v0.11.0
 * `src/server/operations/single-workflow-control-operation.ts`): cancel,
 * suspend, resume, and force-timeout all declare `access: { kind: 'public'
 * }` — no scope is required server-side, so these are never scope-gated in
 * the UI (a scope tooltip here would be fabricated). `suspend` is a no-op on
 * a non-running workflow per its own description, so it's only offered while
 * `running`; `resume` targets the interactive `suspended` case.
 */
export type WorkflowContextualAction = 'cancel' | 'suspend' | 'resume' | 'force-timeout';

const ACTIONS_BY_STATUS: Readonly<Record<WorkflowStatus, readonly WorkflowContextualAction[]>> = {
  pending: ['cancel', 'force-timeout'],
  running: ['cancel', 'suspend', 'force-timeout'],
  suspended: ['resume', 'cancel', 'force-timeout'],
  completed: [],
  failed: [],
  cancelled: [],
  'timed-out': [],
};

export function availableActions(status: WorkflowStatus): readonly WorkflowContextualAction[] {
  return ACTIONS_BY_STATUS[status];
}

/**
 * Confirmation tier per action (plan §10.6). `cancel`/`force-timeout` are
 * irreversible from the caller's perspective (their own operation
 * descriptions say so) — Tier 2 modal. `suspend`/`resume` are fully
 * reversible round-trips of each other — no modal, direct action.
 */
export type ActionConfirmTier = 'direct' | 'tier-2';

const ACTION_CONFIRM_TIER: Readonly<Record<WorkflowContextualAction, ActionConfirmTier>> = {
  cancel: 'tier-2',
  'force-timeout': 'tier-2',
  suspend: 'direct',
  resume: 'direct',
};

export function actionConfirmTier(action: WorkflowContextualAction): ActionConfirmTier {
  return ACTION_CONFIRM_TIER[action];
}

const ACTION_LABEL: Readonly<Record<WorkflowContextualAction, string>> = {
  cancel: 'Cancel',
  suspend: 'Suspend',
  resume: 'Resume',
  'force-timeout': 'Force timeout',
};

export function actionLabel(action: WorkflowContextualAction): string {
  return ACTION_LABEL[action];
}
