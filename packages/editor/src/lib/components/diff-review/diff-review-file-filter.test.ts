import { describe, expect, test } from 'bun:test';

import type { DiffReviewFileEntry } from './diff-review-file-entries.ts';
import { filterDiffReviewFileEntries } from './diff-review-file-filter.ts';

function entry(path: string): DiffReviewFileEntry {
  return {
    targetId: 't1',
    targetLabel: 'Target',
    targetKind: 'source',
    fileOccurrence: 0,
    path,
    changedLineCount: 1,
    commentCount: 0,
    draftCount: 0,
    reviewed: false,
  };
}

describe('DiffReview component file filter', () => {
  test('an empty or whitespace-only query returns every entry unchanged', () => {
    const entries = [entry('src/one.ts'), entry('src/two.ts')];
    expect(filterDiffReviewFileEntries(entries, '')).toEqual(entries);
    expect(filterDiffReviewFileEntries(entries, '   ')).toEqual(entries);
  });

  test('matches case-insensitively on a substring of the path', () => {
    const entries = [entry('src/One.ts'), entry('src/two.ts')];
    expect(filterDiffReviewFileEntries(entries, 'ONE')).toEqual([entries[0]!]);
  });

  test('a query matching nothing returns an empty list', () => {
    const entries = [entry('src/one.ts')];
    expect(filterDiffReviewFileEntries(entries, 'nope')).toEqual([]);
  });
});
