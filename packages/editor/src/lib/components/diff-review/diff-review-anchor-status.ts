/**
 * Classifies a comment or draft's relationship to the *live* target list
 * (COR-509 / DR-6, "comment navigation" and "outdated comments have no
 * misleading current inline marker").
 *
 * `DiffReviewComment`/`DiffReviewDraft.outdated` is a latch the state
 * reducer already sets whenever a target's content or normalization
 * changes (`applySetTargets`) — it never distinguishes "the target's
 * content changed" from "the target is gone entirely". Both navigation
 * (never focus a current row for either case) and inline markers (render
 * only for genuinely current comments) need that finer distinction, so this
 * module adds exactly one further check: is the record's target still
 * present in `state.targets` at all?
 *
 * @module
 */

import type { DiffReviewState } from '../../diff-review-state/index.ts';

/**
 * - `current`: the target is still live and the record predates no content
 *   change since it was captured.
 * - `outdated`: the target is still live, but its content or normalization
 *   changed since the record was captured.
 * - `removed`: the target is no longer present in `state.targets` at all.
 *   (The reducer always also latches `outdated: true` in this case, so
 *   `removed` is a strict refinement of `outdated`, not a separate flag.)
 */
export type DiffReviewAnchorStatus = 'current' | 'outdated' | 'removed';

/** The subset of a comment/draft's fields this classification needs. */
export interface DiffReviewAnchoredRecord {
  targetId: string;
  outdated: boolean;
}

export function classifyDiffReviewAnchorStatus(
  state: DiffReviewState,
  record: DiffReviewAnchoredRecord,
): DiffReviewAnchorStatus {
  const targetIsLive = state.targets.some((target) => target.targetId === record.targetId);
  if (!targetIsLive) return 'removed';
  return record.outdated ? 'outdated' : 'current';
}
