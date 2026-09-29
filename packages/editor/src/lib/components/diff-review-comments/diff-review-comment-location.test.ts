import { describe, expect, test } from 'bun:test';

import type { DiffReviewComment } from '../../diff-review-state/index.ts';
import { formatDiffReviewCommentLocation } from './diff-review-comment-location.ts';

function baseComment(): DiffReviewComment {
  return {
    id: 'c1',
    targetId: 't1',
    snapshotId: 's1',
    anchor: { kind: 'file', fileOccurrence: 2 },
    capturedContext: {
      targetKind: 'source',
      targetLabel: 'Patch',
      repositoryLabel: undefined,
      baseRevisionLabel: undefined,
      headRevisionLabel: undefined,
      oldPath: 'src/two.ts',
      newPath: 'src/two.ts',
      fileOccurrence: 2,
      snapshotId: 's1',
      rawMapping: { status: 'exact' },
    },
    body: 'hi',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    resolved: false,
    outdated: false,
  };
}

describe('DiffReview component comment location label', () => {
  test('a file anchor is labeled with the captured path only', () => {
    expect(formatDiffReviewCommentLocation(baseComment())).toBe('src/two.ts');
  });

  test('a single-line range anchor names the side and line', () => {
    const comment = baseComment();
    comment.anchor = {
      kind: 'range',
      fileOccurrence: 2,
      hunkOccurrence: 0,
      side: 'new',
      startLine: 5,
      endLine: 5,
      coordinateSpace: 'raw-source',
      selectedText: 'x',
      contextBefore: [],
      contextAfter: [],
    };
    expect(formatDiffReviewCommentLocation(comment)).toBe('src/two.ts · new line 5');
  });

  test('a multi-line range anchor names the inclusive range', () => {
    const comment = baseComment();
    comment.anchor = {
      kind: 'range',
      fileOccurrence: 2,
      hunkOccurrence: 0,
      side: 'old',
      startLine: 5,
      endLine: 9,
      coordinateSpace: 'raw-source',
      selectedText: 'x',
      contextBefore: [],
      contextAfter: [],
    };
    expect(formatDiffReviewCommentLocation(comment)).toBe('src/two.ts · old lines 5-9');
  });

  test('a Markdown target with no path falls back to the captured target label', () => {
    const comment = baseComment();
    comment.capturedContext = {
      ...comment.capturedContext,
      targetKind: 'markdown',
      oldPath: null,
      newPath: null,
    };
    expect(formatDiffReviewCommentLocation(comment)).toBe('Patch');
  });

  test('accepts a DiffReviewDraft (same anchor/capturedContext shape, no id/body/resolved)', () => {
    // The composer reuses this formatter to name the file/side/range above
    // its textarea, before the draft is ever saved as a comment.
    const { id, body, createdAt, updatedAt, resolved, outdated, ...draftShaped } = baseComment();
    void id;
    void body;
    void createdAt;
    void updatedAt;
    void resolved;
    void outdated;
    expect(formatDiffReviewCommentLocation(draftShaped)).toBe('src/two.ts');
  });
});
