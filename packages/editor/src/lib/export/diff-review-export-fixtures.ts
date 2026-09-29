/**
 * Shared input fixtures for the diff-review export tests (DR-5). Hand-built `DiffReviewState`
 * values, in the same spirit as `diff-review-state/fixtures.ts`, plus one fixture built through
 * the real `createDiffReviewState`/`reduceDiffReviewState` pipeline for the target-removal case,
 * where exercising the actual reducer is more convincing than hand-authoring its output.
 *
 * @module
 */

import {
  createDiffReviewState,
  reduceDiffReviewState,
  type DiffReviewComment,
  type DiffReviewState,
  type DiffReviewTargetRecord,
} from '../diff-review-state/index.js';
import type { DiffReviewExportDocumentThread } from './diff-review-export-types.js';
import { buildSourceLineMap, mapNormalizedLineNumber } from './source-line-map.js';

const T = '2026-01-01T00:00:00.000Z';

function target(
  overrides: Partial<DiffReviewTargetRecord> & { targetId: string },
): DiffReviewTargetRecord {
  return {
    kind: 'source',
    label: overrides.targetId,
    repositoryLabel: undefined,
    baseRevisionLabel: undefined,
    headRevisionLabel: undefined,
    snapshotId: `${overrides.targetId}-snapshot`,
    ...overrides,
  };
}

function fileComment(
  overrides: Partial<DiffReviewComment> & { id: string; targetId: string },
): DiffReviewComment {
  return {
    snapshotId: `${overrides.targetId}-snapshot`,
    anchor: { kind: 'file', fileOccurrence: 0 },
    capturedContext: {
      targetKind: 'source',
      targetLabel: overrides.targetId,
      repositoryLabel: undefined,
      baseRevisionLabel: undefined,
      headRevisionLabel: undefined,
      oldPath: `${overrides.targetId}.ts`,
      newPath: `${overrides.targetId}.ts`,
      fileOccurrence: 0,
      snapshotId: `${overrides.targetId}-snapshot`,
      rawMapping: { status: 'exact' },
    },
    body: 'A file comment.',
    createdAt: T,
    updatedAt: T,
    resolved: false,
    outdated: false,
    ...overrides,
  };
}

// ============================================================================
// Fixture A: two source targets sharing one display path ("repeated paths"),
// old/new ranges, a resolved comment, and an outdated comment.
// ============================================================================

export const twoSourceTargetsFixture: DiffReviewState = {
  version: 1,
  targets: [
    target({
      targetId: 'left',
      label: 'src/shared.ts',
      repositoryLabel: 'org/repo',
      baseRevisionLabel: 'main',
      headRevisionLabel: 'feature/left',
    }),
    target({
      targetId: 'right',
      label: 'src/shared.ts',
      repositoryLabel: 'org/repo',
      baseRevisionLabel: 'main',
      headRevisionLabel: 'feature/right',
    }),
  ],
  comments: [
    fileComment({
      id: 'comment-file',
      targetId: 'left',
      body: 'Please add a docstring here.',
      createdAt: T,
      updatedAt: T,
      capturedContext: {
        targetKind: 'source',
        targetLabel: 'src/shared.ts',
        repositoryLabel: 'org/repo',
        baseRevisionLabel: 'main',
        headRevisionLabel: 'feature/left',
        oldPath: 'src/shared.ts',
        newPath: 'src/shared.ts',
        fileOccurrence: 0,
        snapshotId: 'left-snapshot',
        rawMapping: { status: 'exact' },
      },
    }),
    {
      id: 'comment-resolved',
      targetId: 'left',
      snapshotId: 'left-snapshot',
      anchor: {
        kind: 'range',
        fileOccurrence: 0,
        hunkOccurrence: 0,
        side: 'new',
        startLine: 10,
        endLine: 12,
        coordinateSpace: 'raw-source',
        selectedText: 'function shared() {\n  return 1;\n}',
        contextBefore: ['// before-3', '// before-2', '// before-1'],
        contextAfter: ['// after-1', '// after-2', '// after-3'],
      },
      capturedContext: {
        targetKind: 'source',
        targetLabel: 'src/shared.ts',
        repositoryLabel: 'org/repo',
        baseRevisionLabel: 'main',
        headRevisionLabel: 'feature/left',
        oldPath: 'src/shared.ts',
        newPath: 'src/shared.ts',
        fileOccurrence: 0,
        snapshotId: 'left-snapshot',
        rawMapping: { status: 'exact' },
      },
      body: 'Nice cleanup.',
      createdAt: '2026-01-01T00:00:01.000Z',
      updatedAt: '2026-01-01T00:00:01.000Z',
      resolved: true,
      outdated: false,
    },
    {
      id: 'comment-outdated',
      targetId: 'right',
      snapshotId: 'right-snapshot-old',
      anchor: {
        kind: 'range',
        fileOccurrence: 0,
        hunkOccurrence: 0,
        side: 'old',
        startLine: 5,
        endLine: 5,
        coordinateSpace: 'raw-source',
        selectedText: 'return legacy();',
        contextBefore: [],
        contextAfter: [],
      },
      capturedContext: {
        targetKind: 'source',
        targetLabel: 'src/shared.ts',
        repositoryLabel: 'org/repo',
        baseRevisionLabel: 'main',
        headRevisionLabel: 'feature/right',
        oldPath: 'src/shared.ts',
        newPath: 'src/shared.ts',
        fileOccurrence: 0,
        snapshotId: 'right-snapshot-old',
        rawMapping: { status: 'exact' },
      },
      body: 'This branch is now dead code.',
      createdAt: '2026-01-01T00:00:02.000Z',
      updatedAt: '2026-01-01T00:00:02.000Z',
      resolved: false,
      outdated: true,
    },
  ],
  drafts: [],
  reviewNote: '',
  selectedTargetId: 'left',
  selectedFileOccurrence: 0,
  reviewedMarkers: [],
};

// ============================================================================
// Fixture B: two Markdown targets — one normalized (rawMapping unavailable),
// one raw (normalization disabled, rawMapping exact) — plus a review note.
// ============================================================================

export const markdownTargetsFixture: DiffReviewState = {
  version: 1,
  targets: [
    target({ targetId: 'md-normalized', kind: 'markdown', label: 'README.md' }),
    target({ targetId: 'md-raw', kind: 'markdown', label: 'CHANGELOG.md' }),
  ],
  comments: [
    {
      id: 'comment-normalized',
      targetId: 'md-normalized',
      snapshotId: 'md-normalized-snapshot',
      anchor: {
        kind: 'range',
        fileOccurrence: 0,
        hunkOccurrence: 0,
        side: 'new',
        startLine: 3,
        endLine: 3,
        coordinateSpace: 'normalized-markdown',
        selectedText: 'Updated body.',
        contextBefore: [],
        contextAfter: [],
      },
      capturedContext: {
        targetKind: 'markdown',
        targetLabel: 'README.md',
        repositoryLabel: undefined,
        baseRevisionLabel: undefined,
        headRevisionLabel: undefined,
        oldPath: null,
        newPath: 'README.md',
        fileOccurrence: 0,
        snapshotId: 'md-normalized-snapshot',
        rawMapping: { status: 'unavailable', reason: 'normalization' },
      },
      body: 'Consider linking the migration guide.',
      createdAt: T,
      updatedAt: T,
      resolved: false,
      outdated: false,
    },
    {
      id: 'comment-raw',
      targetId: 'md-raw',
      snapshotId: 'md-raw-snapshot',
      anchor: {
        kind: 'range',
        fileOccurrence: 0,
        hunkOccurrence: 0,
        side: 'old',
        startLine: 8,
        endLine: 9,
        coordinateSpace: 'raw-source',
        selectedText: '## Unreleased\n- old entry',
        contextBefore: [],
        contextAfter: [],
      },
      capturedContext: {
        targetKind: 'markdown',
        targetLabel: 'CHANGELOG.md',
        repositoryLabel: undefined,
        baseRevisionLabel: undefined,
        headRevisionLabel: undefined,
        oldPath: 'CHANGELOG.md',
        newPath: null,
        fileOccurrence: 0,
        snapshotId: 'md-raw-snapshot',
        rawMapping: { status: 'exact' },
      },
      body: 'Keep this entry; it is still accurate.',
      createdAt: T,
      updatedAt: T,
      resolved: false,
      outdated: false,
    },
  ],
  drafts: [],
  reviewNote: 'Overall this looks good; a few docs nits below.',
  selectedTargetId: 'md-normalized',
  selectedFileOccurrence: 0,
  reviewedMarkers: [],
};

// ============================================================================
// Fixture D: a target present, commented on, then removed via the real
// reducer (`set-targets`), latching its comment outdated and retaining it by
// captured context only.
// ============================================================================

export function buildRemovedTargetFixture(): DiffReviewState {
  const created = createDiffReviewState([
    { kind: 'source', targetId: 'gone', label: 'src/deleted.ts', patch: 'diff --git a/x b/x' },
  ]);
  if (!created.ok) throw new Error('fixture setup failed: createDiffReviewState');

  const withComment = reduceDiffReviewState(
    created.value,
    {
      type: 'create-comment',
      id: 'comment-on-removed',
      targetId: 'gone',
      anchor: { kind: 'file', fileOccurrence: 0 },
      body: 'This whole file is being removed; please confirm nothing depends on it.',
    },
    { clock: () => T, idFactory: () => 'unused' },
  );
  if (!withComment.ok) throw new Error('fixture setup failed: create-comment');

  const removed = reduceDiffReviewState(withComment.value, { type: 'set-targets', targets: [] });
  if (!removed.ok) throw new Error('fixture setup failed: set-targets');

  return removed.value;
}

// ============================================================================
// Fixture E: empty review.
// ============================================================================

export const emptyReviewFixture: DiffReviewState = {
  version: 1,
  targets: [],
  comments: [],
  drafts: [],
  reviewNote: '',
  selectedTargetId: null,
  selectedFileOccurrence: null,
  reviewedMarkers: [],
};

// ============================================================================
// Fixture F: malicious-looking fenced text and HTML in the quoted source, the
// feedback body, and the review note.
// ============================================================================

export const maliciousContentFixture: DiffReviewState = {
  version: 1,
  targets: [target({ targetId: 'html-target', label: 'src/render.ts' })],
  comments: [
    {
      id: 'comment-malicious',
      targetId: 'html-target',
      snapshotId: 'html-target-snapshot',
      anchor: {
        kind: 'range',
        fileOccurrence: 0,
        hunkOccurrence: 0,
        side: 'new',
        startLine: 1,
        endLine: 2,
        coordinateSpace: 'raw-source',
        selectedText: '```js\nconst x = "````closing four";\n```\n<script>alert(1)</script>',
        contextBefore: [],
        contextAfter: [],
      },
      capturedContext: {
        targetKind: 'source',
        targetLabel: 'src/render.ts',
        repositoryLabel: undefined,
        baseRevisionLabel: undefined,
        headRevisionLabel: undefined,
        oldPath: 'src/render.ts',
        newPath: 'src/render.ts',
        fileOccurrence: 0,
        snapshotId: 'html-target-snapshot',
        rawMapping: { status: 'exact' },
      },
      body: 'Escaping looks wrong here: `````` and <img src=x onerror=alert(1)> should never render.',
      createdAt: T,
      updatedAt: T,
      resolved: false,
      outdated: false,
    },
  ],
  drafts: [],
  reviewNote: 'Note contains ``` a fence ``` and <b>bold-looking</b> text.',
  selectedTargetId: 'html-target',
  selectedFileOccurrence: 0,
  reviewedMarkers: [],
};

// ============================================================================
// Fixture G: an empty quoted line and a body with a trailing newline.
// ============================================================================

export const emptyAndTrailingNewlineFixture: DiffReviewState = {
  version: 1,
  targets: [target({ targetId: 'blank-lines', label: 'src/blank.ts' })],
  comments: [
    {
      id: 'comment-empty-quote',
      targetId: 'blank-lines',
      snapshotId: 'blank-lines-snapshot',
      anchor: {
        kind: 'range',
        fileOccurrence: 0,
        hunkOccurrence: 0,
        side: 'new',
        startLine: 4,
        endLine: 4,
        coordinateSpace: 'raw-source',
        selectedText: '',
        contextBefore: ['function f() {'],
        contextAfter: ['  return 1;'],
      },
      capturedContext: {
        targetKind: 'source',
        targetLabel: 'src/blank.ts',
        repositoryLabel: undefined,
        baseRevisionLabel: undefined,
        headRevisionLabel: undefined,
        oldPath: 'src/blank.ts',
        newPath: 'src/blank.ts',
        fileOccurrence: 0,
        snapshotId: 'blank-lines-snapshot',
        rawMapping: { status: 'exact' },
      },
      body: 'Blank line looks intentional.',
      createdAt: T,
      updatedAt: T,
      resolved: false,
      outdated: false,
    },
    {
      id: 'comment-trailing-newline',
      targetId: 'blank-lines',
      snapshotId: 'blank-lines-snapshot',
      anchor: { kind: 'file', fileOccurrence: 0 },
      capturedContext: {
        targetKind: 'source',
        targetLabel: 'src/blank.ts',
        repositoryLabel: undefined,
        baseRevisionLabel: undefined,
        headRevisionLabel: undefined,
        oldPath: 'src/blank.ts',
        newPath: 'src/blank.ts',
        fileOccurrence: 0,
        snapshotId: 'blank-lines-snapshot',
        rawMapping: { status: 'exact' },
      },
      body: 'Fix this please.\n',
      createdAt: '2026-01-01T00:00:01.000Z',
      updatedAt: '2026-01-01T00:00:01.000Z',
      resolved: false,
      outdated: false,
    },
  ],
  drafts: [],
  reviewNote: '',
  selectedTargetId: 'blank-lines',
  selectedFileOccurrence: 0,
  reviewedMarkers: [],
};

// ============================================================================
// Fixture I: existing document-anchored threads (DR-7's future projection
// shape) — a deleted initial message with surviving replies (document-level
// anchor), a fully deleted thread (document-text anchor), and an ordinary
// multi-message thread (document-text anchor, exercising both variants the
// contract requires: "an explicit `document-text` or document-level anchor
// variant").
// ============================================================================

export const documentThreadsFixture: DiffReviewExportDocumentThread[] = [
  {
    targetId: 'doc-1',
    threadId: 'thread-deleted-initial',
    createdAt: '2026-01-01T00:00:00.000Z',
    anchor: { kind: 'document' },
    messages: [
      {
        id: 'message-1',
        body: 'This message was later deleted.',
        createdAt: '2026-01-01T00:00:00.000Z',
        deletedAt: '2026-01-01T00:05:00.000Z',
      },
      {
        id: 'message-2',
        body: 'But this reply survives.',
        createdAt: '2026-01-01T00:01:00.000Z',
      },
    ],
  },
  {
    targetId: 'doc-1',
    threadId: 'thread-fully-deleted',
    createdAt: '2026-01-01T00:02:00.000Z',
    anchor: { kind: 'document-text', quote: 'a since-deleted quote', prefix: null, suffix: null },
    messages: [
      {
        id: 'message-3',
        body: 'Deleted.',
        createdAt: '2026-01-01T00:02:00.000Z',
        deletedAt: '2026-01-01T00:03:00.000Z',
      },
    ],
  },
  {
    targetId: 'doc-2',
    threadId: 'thread-ordinary',
    createdAt: '2026-01-01T00:03:00.000Z',
    anchor: {
      kind: 'document-text',
      quote: 'the exact document text this thread is anchored to',
      prefix: 'context before the quote',
      suffix: 'context after the quote',
    },
    messages: [
      {
        id: 'message-5',
        body: 'Second message by createdAt.',
        createdAt: '2026-01-01T00:04:00.000Z',
      },
      {
        id: 'message-4',
        body: 'First message by createdAt.',
        createdAt: '2026-01-01T00:03:30.000Z',
      },
    ],
  },
];

// ============================================================================
// Fixture: an input where the real, production `source-line-map.ts` genuinely
// interpolates a source line — proof that the omission of a raw coordinate for
// normalized-markdown anchors is deliberate, not merely untested (see
// `diff-review-export-interpolation.test.ts` for the interpolation proof
// itself; this fixture also backs a checked-in golden, confirming the export
// never surfaces the interpolated guess).
// ============================================================================

/**
 * Real production input/output (mirrors `source-line-map.test.ts`'s own "stays monotonic"
 * case): normalized lines "p", "q", "r" replace source line "X" wholesale, so none of them is
 * the product of any source AST node — whatever source line the map attributes to "q" is
 * necessarily a guess, never an exact correspondence.
 */
export function buildInterpolatingSourceLineMapFixture(): DiffReviewState {
  const source = ['A', 'X', 'B'].join('\n') + '\n';
  const normalized = ['A', 'p', 'q', 'r', 'B'].join('\n') + '\n';
  if (source.includes('q')) throw new Error('fixture setup failed: "q" must not exist in source');

  const map = buildSourceLineMap(source, normalized);
  const interpolatedLine = mapNormalizedLineNumber(map, 3); // "q" is normalized line 3 (1-based)
  if (interpolatedLine < 1 || interpolatedLine > 3) {
    throw new Error('fixture setup failed: expected the map to interpolate within [1, 3]');
  }

  const comment: DiffReviewComment = {
    id: 'comment-interpolated',
    targetId: 'interpolated-target',
    snapshotId: 'interpolated-snapshot',
    anchor: {
      kind: 'range',
      fileOccurrence: 0,
      hunkOccurrence: 0,
      side: 'new',
      startLine: 3,
      endLine: 3,
      coordinateSpace: 'normalized-markdown',
      selectedText: 'q',
      contextBefore: ['p'],
      contextAfter: ['r'],
    },
    capturedContext: {
      targetKind: 'markdown',
      targetLabel: 'interpolated.md',
      repositoryLabel: undefined,
      baseRevisionLabel: undefined,
      headRevisionLabel: undefined,
      oldPath: null,
      newPath: 'interpolated.md',
      fileOccurrence: 0,
      snapshotId: 'interpolated-snapshot',
      rawMapping: { status: 'unavailable', reason: 'normalization' },
    },
    body: 'Double-check this line after normalization.',
    createdAt: T,
    updatedAt: T,
    resolved: false,
    outdated: false,
  };

  return {
    version: 1,
    targets: [
      target({ targetId: 'interpolated-target', kind: 'markdown', label: 'interpolated.md' }),
    ],
    comments: [comment],
    drafts: [],
    reviewNote: '',
    selectedTargetId: 'interpolated-target',
    selectedFileOccurrence: 0,
    reviewedMarkers: [],
  };
}
