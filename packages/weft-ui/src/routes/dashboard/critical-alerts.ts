/**
 * Critical-alerts band data (plan §9.1, this track's brief): pure builders
 * turning `weft.tasks.diagnostics`'s summary and the reviews-near-timeout
 * list into deep-linking chips (design `Weft UI.dc.html` dashboard
 * screen's "critical alerts band"). Kept framework-free so the chip logic
 * is unit-testable without a DOM (PROJECT-BRIEF "pure logic ... gets
 * colocated bun test unit tests").
 *
 * The design mock also shows a "Lease contested" chip sourced from
 * `GET /v1/health` — omitted here. Verified against `weft` v0.11.0 that
 * `/v1/health` returns `{ status: 'ok' }` only (no lease/ownership fields)
 * and that no catalog operation exposes lease/ownership state at all
 * (grepped `operation-catalog.snapshot.json` and every `src/server/
 * operations/*.ts` for `lease`/`ownership`/`holder`/`epoch`/`contested`:
 * no matches). Filed upstream rather than fabricating a chip with no real
 * signal: https://github.com/stevekinney/weft/issues/723. A "workers
 * draining" chip is likewise out of this band's scope — this track's brief
 * names exactly three sources (task diagnostics, reviews near timeout,
 * lease/health), and worker fleet counts are the Workers card-slot's own
 * data to surface.
 */
import type { PendingReviewEntry } from '@lostgradient/weft';

/** Mirrors `TaskDiagnosticsSummary` (`weft/src/server/operations/get-task-diagnostics.ts`) — named locally since it isn't a public `@lostgradient/weft` export. */
export interface TaskDiagnosticsSummary {
  readonly stuckQueued: number;
  readonly staleInflight: number;
  readonly retryStorms: number;
  readonly allWorkersAtCapacity: number;
  readonly deadLettered: number;
  readonly delayed: number;
  readonly unadoptedTerminal: number;
}

export type AlertChipTone = 'danger' | 'warning';

export interface AlertChip {
  readonly id: string;
  readonly icon: string;
  readonly tone: AlertChipTone;
  readonly label: string;
  /** Router-relative deep link. */
  readonly href: string;
}

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

interface DiagnosticKindMeta {
  readonly icon: string;
  readonly tone: AlertChipTone;
  readonly label: (count: number) => string;
}

const DIAGNOSTIC_KIND_META = {
  deadLettered: {
    icon: 'circle-alert',
    tone: 'danger',
    label: (n) => `${n} ${pluralize(n, 'dead-lettered task', 'dead-lettered tasks')}`,
  },
  stuckQueued: {
    icon: 'timer',
    tone: 'warning',
    label: (n) => `${n} ${pluralize(n, 'stuck-queued task', 'stuck-queued tasks')}`,
  },
  staleInflight: {
    icon: 'clock-alert',
    tone: 'warning',
    label: (n) => `${n} ${pluralize(n, 'stale in-flight task', 'stale in-flight tasks')}`,
  },
  retryStorms: {
    icon: 'refresh-cw',
    tone: 'warning',
    label: (n) => `${n} ${pluralize(n, 'retry storm', 'retry storms')}`,
  },
  allWorkersAtCapacity: {
    icon: 'gauge',
    tone: 'warning',
    label: (n) => `${n} ${pluralize(n, 'queue', 'queues')} at capacity`,
  },
  delayed: {
    icon: 'clock',
    tone: 'warning',
    label: (n) => `${n} delayed ${pluralize(n, 'task', 'tasks')}`,
  },
  unadoptedTerminal: {
    icon: 'unlink',
    tone: 'danger',
    label: (n) => `${n} unadopted terminal ${pluralize(n, 'result', 'results')}`,
  },
} as const satisfies Record<keyof TaskDiagnosticsSummary, DiagnosticKindMeta>;

/**
 * Display order for diagnostic chips — most severe (dead-lettered) first,
 * matching the design reference's ordering.
 */
const DIAGNOSTIC_KIND_ORDER: readonly (keyof TaskDiagnosticsSummary)[] = [
  'deadLettered',
  'stuckQueued',
  'staleInflight',
  'retryStorms',
  'allWorkersAtCapacity',
  'delayed',
  'unadoptedTerminal',
];

/**
 * Builds one chip per diagnostic kind with a non-zero count, in severity
 * order. Every chip deep-links to `/workers` with a `diagnostic=<kind>`
 * query hint (the Workers/queues diagnostics view's own filter grammar is
 * that track's to define; this is a self-documenting convention, not a
 * frozen contract).
 */
export function buildDiagnosticChips(summary: TaskDiagnosticsSummary): AlertChip[] {
  const chips: AlertChip[] = [];
  for (const kind of DIAGNOSTIC_KIND_ORDER) {
    const count = summary[kind];
    if (count <= 0) continue;
    const meta = DIAGNOSTIC_KIND_META[kind];
    chips.push({
      id: `diagnostic:${kind}`,
      icon: meta.icon,
      tone: meta.tone,
      label: meta.label(count),
      href: `/workers?diagnostic=${kind}`,
    });
  }
  return chips;
}

/**
 * `true` when a pending review has less than 20% of its timeout window
 * remaining (plan §9.5's own countdown-red threshold, reused here so the
 * dashboard's "near timeout" definition matches the Reviews surface's).
 * Reviews with no `timeout` configured never time out and are excluded.
 */
export function isReviewNearTimeout(review: PendingReviewEntry, now: number): boolean {
  if (review.timeout === undefined) return false;
  const remainingMs = review.createdAt + review.timeout - now;
  return remainingMs / review.timeout < 0.2;
}

/** Builds the "reviews near timeout" chip, or `null` when none qualify. */
export function buildReviewsNearTimeoutChip(
  reviews: readonly PendingReviewEntry[],
  now: number,
): AlertChip | null {
  const count = reviews.filter((review) => isReviewNearTimeout(review, now)).length;
  if (count === 0) return null;
  return {
    id: 'reviews-near-timeout',
    icon: 'clipboard-check',
    tone: 'warning',
    label: `${count} ${pluralize(count, 'review', 'reviews')} near timeout`,
    href: '/reviews',
  };
}
