/**
 * Pure presentation-state derivation for worker/deployment rows (plan §9.9(1)
 * "runtime-state derivation pattern" — a priority-ordered pure function
 * instead of an if/else pile — adopted for the Workers track).
 *
 * ## Deliberately no "reconnecting (grace period)" state
 *
 * Plan §9.4 asks the UI to show "reconnecting (grace period)" for a worker
 * that drops and reconnects within `workerReconnectGracePeriodMs`
 * (`weft/src/server/serve-internals.ts`, clamped `[0, 5000]`, default ~2s)
 * rather than "flapping to disconnected". Traced against the wire
 * (`weft/src/server/runtime/authentication-bridge.ts`): during the grace
 * window the worker stays fully registered — same `WorkerSummary`, same
 * `health` — and `WorkerDisconnectedEvent` (`worker:disconnected`) fires
 * only AFTER the window expires and the requeue actually runs. There is no
 * wire-observable "this worker just entered its grace window" signal to
 * derive a distinct UI state from. Faking one off `heartbeatAgeMs` would be
 * wrong on its own terms (heartbeat cadence and the ~2s grace window are
 * unrelated timescales) and would misfire on real data — e.g. the design
 * mock's draining worker at a 1m12s heartbeat age, which must read
 * "Draining", never "reconnecting".
 *
 * What this module delivers instead is the requirement's actual intent:
 * never derive a client-side "disconnected" verdict for a worker present in
 * the current `weft.workers.list` snapshot — every function below only ever
 * classifies workers *that are in the list*, and callers must treat the
 * list itself (not a locally patched view) as truth. A per-worker
 * reconnecting/in-grace flag is a candidate follow-up on
 * https://github.com/stevekinney/weft/issues/729, not something to
 * approximate client-side.
 */
import type { WorkerDeploymentSummary, WorkerSummary } from './worker-catalog-types.ts';

export type WorkerHealthLabel = 'Healthy' | 'Draining' | 'Drained' | 'Stale';
export type PresentationVariant = 'success' | 'warning' | 'danger' | 'neutral';

export interface HealthPresentation {
  readonly label: WorkerHealthLabel;
  readonly variant: PresentationVariant;
}

export type HeartbeatSeverity = 'fresh' | 'elevated' | 'stale';

/**
 * Conservative fixed thresholds (plan §9.4: "heartbeat staleness … relative
 * color thresholds"). `WorkerSummary` reports no per-worker heartbeat
 * interval to derive an exact multiple from, so these are documented
 * defaults rather than a computed ratio — widen/narrow here if a future
 * catalog change adds one.
 */
export const HEARTBEAT_ELEVATED_AFTER_MS = 30_000;
export const HEARTBEAT_STALE_AFTER_MS = 120_000;

/** Three-tier heartbeat freshness, independent of drain state (used for the heartbeat column's color only — see `workerHealthPresentation` for the combined badge). */
export function heartbeatSeverity(heartbeatAgeMs: number): HeartbeatSeverity {
  if (heartbeatAgeMs >= HEARTBEAT_STALE_AFTER_MS) return 'stale';
  if (heartbeatAgeMs >= HEARTBEAT_ELEVATED_AFTER_MS) return 'elevated';
  return 'fresh';
}

const HEARTBEAT_SEVERITY_VARIANT: Readonly<Record<HeartbeatSeverity, PresentationVariant>> = {
  fresh: 'success',
  elevated: 'warning',
  stale: 'danger',
};

export function heartbeatSeverityVariant(severity: HeartbeatSeverity): PresentationVariant {
  return HEARTBEAT_SEVERITY_VARIANT[severity];
}

const HEARTBEAT_SEVERITY_CSS_VARIABLE: Readonly<Record<HeartbeatSeverity, string>> = {
  fresh: 'var(--cinder-color-success-fg)',
  elevated: 'var(--cinder-color-warning-fg)',
  stale: 'var(--cinder-color-danger-fg)',
};

/** Cinder status-tone CSS variable for a heartbeat severity tier — used to color the heartbeat column's text directly (plan §9.4: "heartbeat staleness … relative color thresholds"), not via `Badge`/`StatusDot` (a full badge per heartbeat cell would be too heavy for a dense table). */
export function heartbeatSeverityCssVariable(severity: HeartbeatSeverity): string {
  return HEARTBEAT_SEVERITY_CSS_VARIABLE[severity];
}

/**
 * Priority-ordered worker health presentation: draining > drained > stale
 * heartbeat > healthy. Matches `design/Weft UI.dc.html`'s workers
 * screens, where a draining worker keeps its "Draining" badge regardless of
 * heartbeat age (draining stops new-task assignment; it does not itself
 * stop heartbeats) and only an `active` worker's heartbeat can promote it to
 * "Stale".
 */
export function workerHealthPresentation(worker: WorkerSummary): HealthPresentation {
  if (worker.health === 'draining') return { label: 'Draining', variant: 'warning' };
  if (worker.health === 'drained') return { label: 'Drained', variant: 'neutral' };
  if (heartbeatSeverity(worker.heartbeatAgeMs) === 'stale') {
    return { label: 'Stale', variant: 'danger' };
  }
  return { label: 'Healthy', variant: 'success' };
}

/** Same priority order for a deployment rollup (no heartbeat to promote — `WorkerDeploymentSummary` reports no age field). */
export function deploymentHealthPresentation(
  deployment: WorkerDeploymentSummary,
): HealthPresentation {
  if (deployment.health === 'draining') return { label: 'Draining', variant: 'warning' };
  if (deployment.health === 'drained') return { label: 'Drained', variant: 'neutral' };
  return { label: 'Healthy', variant: 'success' };
}

export interface FleetTotals {
  readonly totalWorkers: number;
  readonly activeWorkers: number;
  readonly drainingWorkers: number;
  readonly inFlight: number;
  readonly capacity: number;
  readonly utilizationPercent: number;
}

/** Aggregate stat-card numbers for the Fleet overview (plan §9.4 T5.1). */
export function summarizeFleet(workers: readonly WorkerSummary[]): FleetTotals {
  let activeWorkers = 0;
  let drainingWorkers = 0;
  let inFlight = 0;
  let capacity = 0;

  for (const worker of workers) {
    if (worker.health === 'active') activeWorkers += 1;
    if (worker.health === 'draining') drainingWorkers += 1;
    inFlight += worker.inFlight;
    capacity += worker.concurrency;
  }

  const utilizationPercent = capacity === 0 ? 0 : Math.round((inFlight / capacity) * 100);

  return {
    totalWorkers: workers.length,
    activeWorkers,
    drainingWorkers,
    inFlight,
    capacity,
    utilizationPercent,
  };
}

/** Backlog color per the design mock's `queuedColor`: danger above 50 queued, warning above 0, neutral at 0. */
export function queueBacklogVariant(queued: number): PresentationVariant {
  if (queued > 50) return 'danger';
  if (queued > 0) return 'warning';
  return 'neutral';
}

/** `PresentationVariant` → Cinder `StatusDot`'s `status` vocabulary (`'online' | 'warning' | 'danger' | 'neutral'` — the four this module ever produces). */
export function presentationStatusDotStatus(
  variant: PresentationVariant,
): 'online' | 'warning' | 'danger' | 'neutral' {
  return variant === 'success' ? 'online' : variant;
}

/** Narrows generated-client nullable metadata fields to display strings. */
export function asDisplayString(value: unknown, fallback = '—'): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

/** Deployment identity display, e.g. `#4821 · node 20`. */
export function formatDeploymentIdentity(deployment: WorkerDeploymentSummary): string {
  return [asDisplayString(deployment.buildId), asDisplayString(deployment.runtimeVersion)].join(
    ' · ',
  );
}

/** Grouping/display name for a deployment rollup — `deploymentName` is `unknown` per the generated-client gap above; workers with no deployment metadata roll up under this label. */
export function formatDeploymentName(deployment: WorkerDeploymentSummary): string {
  return asDisplayString(deployment.deploymentName, '(no deployment)');
}
