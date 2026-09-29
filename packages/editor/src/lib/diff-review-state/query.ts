/**
 * Pure read-only queries over a `DiffReviewState`. These never mutate state and never allocate an
 * ID or read a clock — they're the shared basis a host UI (and later, DR-5's exporters) uses to
 * ask what the state currently means, e.g. whether export should be blocked on unsaved drafts.
 *
 * @module
 */

import type { DiffReviewDraft, DiffReviewResult, DiffReviewState } from './types.js';

/** A draft is "pending" (nonempty, blocking) exactly when `body.trim().length > 0`. */
export function getDiffReviewPendingDrafts(state: DiffReviewState): DiffReviewDraft[] {
  return state.drafts.filter((draft) => draft.body.trim().length > 0);
}

/**
 * Every export scope is blocked until each nonempty draft is saved or explicitly discarded
 * (DR-2 normative handoff, "Drafts, modes, and ReviewEditor"). This is that guard, expressed as
 * the shared `DiffReviewResult` shape so later export code returns exactly this error unchanged.
 */
export function ensureDiffReviewNoPendingDrafts(state: DiffReviewState): DiffReviewResult<void> {
  const pending = getDiffReviewPendingDrafts(state);
  if (pending.length === 0) return { ok: true, value: undefined };
  return {
    ok: false,
    error: {
      code: 'drafts-pending',
      path: '/drafts',
      message: `${pending.length} unsaved draft${pending.length === 1 ? '' : 's'} must be saved or discarded before export.`,
    },
  };
}

/** Whether a file is currently marked reviewed under the target's *current* content identity. */
export function isDiffReviewFileReviewed(
  state: DiffReviewState,
  targetId: string,
  fileOccurrence: number,
): boolean {
  const target = state.targets.find((t) => t.targetId === targetId);
  if (!target) return false;
  return state.reviewedMarkers.some(
    (marker) =>
      marker.targetId === targetId &&
      marker.fileOccurrence === fileOccurrence &&
      marker.snapshotId === target.snapshotId,
  );
}
