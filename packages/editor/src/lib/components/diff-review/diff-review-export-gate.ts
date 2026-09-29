/**
 * Export gating for `DiffReview` (COR-509 / DR-6, "nonempty drafts block
 * every export, showing the count and a link to the [drafts] inventory").
 * Thin, UI-shaped wrapper over `diff-review-state`'s own pending-drafts
 * query so the gate reason and count come from one place.
 */

import type { DiffReviewState } from '../../diff-review-state/index.ts';
import { getDiffReviewPendingDrafts } from '../../diff-review-state/index.ts';

export interface DiffReviewExportGate {
  blocked: boolean;
  pendingCount: number;
}

export function getDiffReviewExportGate(state: DiffReviewState): DiffReviewExportGate {
  const pendingCount = getDiffReviewPendingDrafts(state).length;
  return { blocked: pendingCount > 0, pendingCount };
}
