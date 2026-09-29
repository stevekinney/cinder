/** Pure path filtering for the `DiffReview` file list (COR-509 / DR-6). */

import type { DiffReviewFileEntry } from './diff-review-file-entries.ts';

export function filterDiffReviewFileEntries(
  entries: DiffReviewFileEntry[],
  query: string,
): DiffReviewFileEntry[] {
  const trimmed = query.trim().toLowerCase();
  if (trimmed === '') return entries;
  return entries.filter((entry) => entry.path.toLowerCase().includes(trimmed));
}
