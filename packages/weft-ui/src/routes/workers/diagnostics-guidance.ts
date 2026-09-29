/**
 * Static operator guidance copy for the five `weft.tasks.diagnostics` kinds
 * (plan §9.4 T5.4: "with the static guidance copy from the plan retained
 * verbatim"). Copied exactly from `design/Weft UI.dc.html`'s
 * `diagnostics` array (lines 2027-2031) — do not paraphrase; the design
 * README states copy is final.
 */
import type { TaskDiagnosticKind } from './worker-catalog-types.ts';
import type { PresentationVariant } from './worker-presentation.ts';

export interface DiagnosticGuidance {
  /** Lucide icon name, matching the design mock's `data-lucide` value. */
  readonly icon: string;
  readonly variant: Extract<PresentationVariant, 'warning' | 'danger'>;
  /** Human-readable label for the kind, e.g. "Stuck queued". */
  readonly title: string;
  readonly guidance: string;
}

export const DIAGNOSTIC_GUIDANCE: Readonly<Record<TaskDiagnosticKind, DiagnosticGuidance>> = {
  'stuck-queued': {
    icon: 'timer',
    variant: 'warning',
    title: 'Stuck queued',
    guidance:
      'Tasks are queued but no worker has picked them up. Check that workers polling this queue are healthy and not at capacity; scale up the deployment if utilization is sustained near 100%.',
  },
  'dead-lettered': {
    icon: 'circle-alert',
    variant: 'danger',
    title: 'Dead lettered',
    guidance:
      'Tasks exhausted their retry policy and were moved to the dead-letter queue. Inspect the failing activity, fix the root cause, then redrive or clear the dead letter from Queue detail.',
  },
  'stale-inflight': {
    icon: 'wifi-off',
    variant: 'warning',
    title: 'Stale in-flight',
    guidance:
      'In-flight tasks have stopped heart-beating. The worker may have crashed or hung. The task will be re-queued after the heartbeat timeout; investigate the worker if this recurs.',
  },
  'retry-storm': {
    icon: 'rotate-cw',
    variant: 'warning',
    title: 'Retry storm',
    guidance:
      'A high rate of retries is saturating the queue. Likely a downstream dependency is failing. Consider pausing the source schedule or applying a circuit breaker until the dependency recovers.',
  },
  'all-workers-at-capacity': {
    icon: 'gauge',
    variant: 'danger',
    title: 'All workers at capacity',
    guidance:
      'Every worker on this queue is at maximum concurrency. New work will wait. Scale out the deployment or raise per-worker concurrency if the hosts have headroom.',
  },
  delayed: {
    icon: 'clock',
    variant: 'warning',
    title: 'Delayed',
    guidance:
      'These tasks are durably queued for future availability. Inspect the ledger to confirm the delay and retry policy are expected before intervening.',
  },
  'unadopted-terminal': {
    icon: 'unlink',
    variant: 'danger',
    title: 'Unadopted terminal',
    guidance:
      'A durable terminal result has not been adopted by its workflow after the configured threshold. Inspect workflow recovery readiness and the retained result before retrying work.',
  },
};

export const DIAGNOSTIC_KINDS: readonly TaskDiagnosticKind[] = [
  'stuck-queued',
  'dead-lettered',
  'stale-inflight',
  'retry-storm',
  'all-workers-at-capacity',
  'delayed',
  'unadopted-terminal',
];
