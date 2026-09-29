import { describe, expect, test } from 'bun:test';

import type { DiffReviewComment } from '../../diff-review-state/index.ts';
import { filterDiffReviewComments } from './diff-review-comments-filter.ts';

function comment(overrides: Partial<DiffReviewComment>): DiffReviewComment {
  return {
    id: 'c1',
    targetId: 't1',
    snapshotId: 's1',
    anchor: { kind: 'file', fileOccurrence: 0 },
    capturedContext: {
      targetKind: 'markdown',
      targetLabel: 'Target',
      repositoryLabel: undefined,
      baseRevisionLabel: undefined,
      headRevisionLabel: undefined,
      oldPath: null,
      newPath: null,
      fileOccurrence: 0,
      snapshotId: 's1',
      rawMapping: { status: 'exact' },
    },
    body: 'hello',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    resolved: false,
    outdated: false,
    ...overrides,
  };
}

describe('DiffReview component comments filter', () => {
  test('"all" returns every comment, resolved or not, in the original order', () => {
    const comments = [comment({ id: 'a', resolved: false }), comment({ id: 'b', resolved: true })];
    expect(filterDiffReviewComments(comments, 'all')).toEqual(comments);
  });

  test('"unresolved" excludes resolved comments but keeps outdated unresolved ones', () => {
    const unresolvedOutdated = comment({ id: 'a', resolved: false, outdated: true });
    const resolved = comment({ id: 'b', resolved: true });
    const unresolved = comment({ id: 'c', resolved: false });
    expect(
      filterDiffReviewComments([unresolvedOutdated, resolved, unresolved], 'unresolved'),
    ).toEqual([unresolvedOutdated, unresolved]);
  });

  test('an empty list returns an empty list for either filter', () => {
    expect(filterDiffReviewComments([], 'all')).toEqual([]);
    expect(filterDiffReviewComments([], 'unresolved')).toEqual([]);
  });
});
