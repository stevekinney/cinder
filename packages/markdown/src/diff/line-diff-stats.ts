import type { LineDiff, LineDiffStats } from './line-diff.js';

/** Get aggregate counts from a line diff result. */
export function getDiffStats(lineDiffs: LineDiff[]): LineDiffStats {
  let added = 0;
  let removed = 0;
  let modified = 0;
  for (const diff of lineDiffs) {
    if (diff.type === 'added') added++;
    else if (diff.type === 'removed') removed++;
    else if (diff.type === 'modified') modified++;
  }
  return { added, removed, modified };
}
