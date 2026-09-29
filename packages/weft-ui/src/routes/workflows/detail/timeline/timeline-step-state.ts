/**
 * `WorkflowTimelineStatus` → Cinder `RunStepStatus` mapping (plan T3.1, the
 * "priority-ordered pure-function state-mapping module … per §9.9.1"
 * requirement, adopted from `temporal-explorer`'s runtime-state-derivation
 * pattern and rewritten for Weft's vocabulary).
 *
 * ## Why this isn't a flag-priority table like the source pattern
 *
 * §9.9.1's source (`temporal-explorer`'s `runtime-state.ts`) resolves a
 * priority order over a SET of simultaneously-true observations (a step
 * could be both "timed out" and "retried" at once in that tool's model) —
 * `failed > timedOut > cancelled > pending > retried`. Verified against
 * weft v0.11.0 (`src/core/types/state.ts` `WorkflowTimelineStatus`,
 * `src/core/engine/checkpoint-io.ts` `appendTimelineBatchOperations`): a
 * `WorkflowTimelineEntry` carries exactly ONE already-resolved
 * `WorkflowTimelineStatus` (`'running' | 'completed' | 'failed' |
 * 'cancelled' | 'timed-out'`) — the engine has already done the priority
 * resolution server-side before this ever reaches the client (per this
 * repo's CLAUDE.md: "T3.1 should trust the server timeline rather than
 * re-deriving attempts client-side"). There is no flag set to prioritize
 * over here.
 *
 * The pattern this module actually adopts is the STRUCTURAL one: a small
 * closed enum, an explicit ordered rule list (kept ordered and exhaustive
 * even though today's inputs never collide, so a future Weft status value
 * fails loudly at the TypeScript level via the `satisfies` check below
 * rather than silently falling through), and one named fallback branch for
 * anything unmapped — not an if/else pile.
 *
 * ## Why `RunStepStatus` never receives `pending`, `retrying`, `skipped`, or
 * `waiting_approval` from this mapping
 *
 * Those four Cinder states describe distinctions Weft's timeline API does
 * not expose per-entry: retries collapse into the one entry's final status
 * (no `attemptCount` — see `timeline-mapping.ts`), there is no "not started
 * yet" entry (an entry only exists once its operation has begun), and
 * `waiting_approval`/`skipped` have no Weft timeline analogue. Only
 * `running`/`succeeded`/`failed`/`cancelled`/`timed-out` are ever produced
 * (`pending` is never produced either, for the same "no not-started entry"
 * reason).
 */
import type { WorkflowTimelineStatus } from '@lostgradient/weft';

import type { RunStepStatus } from '@lostgradient/cinder';

const TIMELINE_STATUS_TO_STEP_STATUS = {
  running: 'running',
  completed: 'succeeded',
  failed: 'failed',
  cancelled: 'cancelled',
  // Cinder's `RunStepStatus` has carried a dedicated `'timed-out'` state
  // (danger tone, terminal) since Cinder 0.17.0 — filed upstream as
  // https://github.com/stevekinney/cinder/issues/848 against this track's
  // earlier degraded `'timed-out' → 'failed'` mapping, fixed by
  // https://github.com/stevekinney/cinder/pull/853. Map it straight through
  // rather than collapsing it into `'failed'`.
  'timed-out': 'timed-out',
} as const satisfies Record<WorkflowTimelineStatus, RunStepStatus>;

/** Maps a single timeline entry's already-resolved status onto Cinder's `RunStepStatus` vocabulary. */
export function timelineStepStatus(status: WorkflowTimelineStatus): RunStepStatus {
  return TIMELINE_STATUS_TO_STEP_STATUS[status];
}

/** True for a status that represents a terminal step outcome (not still running). */
export function isTimelineStatusTerminal(status: WorkflowTimelineStatus): boolean {
  return status !== 'running';
}
