/**
 * Pure filtering for the `DiffReviewComments` panel (COR-509 / DR-6).
 *
 * The panel shows every saved comment by default (including resolved and
 * outdated ones, matching the ratified contract's "default to all retained
 * saved comments" rule); `'unresolved'` is an explicit, visibly-named
 * narrowing the person opts into.
 *
 * @module
 */

import type { DiffReviewComment } from '../../diff-review-state/index.ts';

export type DiffReviewCommentsFilter = 'all' | 'unresolved';

export function filterDiffReviewComments(
  comments: DiffReviewComment[],
  filter: DiffReviewCommentsFilter,
): DiffReviewComment[] {
  if (filter === 'all') return comments;
  return comments.filter((comment) => !comment.resolved);
}
