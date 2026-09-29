/**
 * Valid/invalid identity and state fixtures for the diff-review contract (DR-2 deliverable:
 * "shared typed input/state/error declarations, and valid/invalid identity/state fixtures").
 * DR-5's export fixtures and DR-6's prototype build on these rather than redefining their own.
 *
 * @module
 */

import type {
  DiffReviewMarkdownTargetInput,
  DiffReviewSerializedState,
  DiffReviewSourceTargetInput,
  DiffReviewTargetInput,
} from './types.js';

// ============================================================================
// Valid target identity fixtures
// ============================================================================

export const validSourceTargetFixture: DiffReviewSourceTargetInput = {
  kind: 'source',
  targetId: 'target-source-1',
  label: 'src/cache.ts',
  repositoryLabel: 'org/repo',
  baseRevisionLabel: 'main',
  headRevisionLabel: 'feature/cache-fix',
  patch:
    'diff --git a/src/cache.ts b/src/cache.ts\n' +
    '--- a/src/cache.ts\n' +
    '+++ b/src/cache.ts\n' +
    '@@ -40,3 +40,3 @@\n' +
    ' function lookup(key: string) {\n' +
    '-  return cache.get(key);\n' +
    '+  cache.set(key, result);\n' +
    '+  return result;\n' +
    ' }\n',
};

export const validMarkdownTargetFixture: DiffReviewMarkdownTargetInput = {
  kind: 'markdown',
  targetId: 'target-markdown-1',
  label: 'README comparison',
  original: '# Title\n\nOriginal body.\n',
  current: '# Title\n\nUpdated body.\n',
  normalizeInputs: true,
};

/** Two targets sharing the same display path, distinguished only by `targetId`. */
export const repeatedPathTargetFixtures: DiffReviewTargetInput[] = [
  { kind: 'source', targetId: 'left', label: 'src/shared.ts', patch: 'diff-left' },
  { kind: 'source', targetId: 'right', label: 'src/shared.ts', patch: 'diff-right' },
];

// ============================================================================
// Invalid target fixtures
// ============================================================================

/**
 * Unrecognized `kind` discriminant — expected error: `invalid-target` at `/targets/0/kind`.
 * Deliberately untyped: it is not a valid `DiffReviewTargetInput`. Cast at the point of use
 * (`invalidTargetKindFixture as unknown as DiffReviewTargetInput`), same as any other
 * hand-built invalid fixture in this module's tests.
 */
export const invalidTargetKindFixture = {
  kind: 'binary',
  targetId: 'bad-kind',
  label: 'x',
};

/** Non-string `patch` — expected error: `invalid-target` at `/targets/0/patch`. */
export const invalidTargetPatchFixture = {
  kind: 'source',
  targetId: 'bad-patch',
  label: 'x',
  patch: 12345,
};

/** Duplicate `targetId` across two targets — expected error: `duplicate-id` at `/targets/1/targetId`. */
export const duplicateTargetIdFixtures: DiffReviewTargetInput[] = [
  { kind: 'source', targetId: 'same-id', label: 'a', patch: 'a' },
  { kind: 'source', targetId: 'same-id', label: 'b', patch: 'b' },
];

// ============================================================================
// Valid state fixture (round-trips through serialize/restore)
// ============================================================================

export const validSerializedStateFixture: DiffReviewSerializedState = {
  version: 1,
  targets: [
    {
      targetId: 'target-source-1',
      kind: 'source',
      label: 'src/cache.ts',
      repositoryLabel: 'org/repo',
      baseRevisionLabel: 'main',
      headRevisionLabel: 'feature/cache-fix',
      snapshotId: 'a'.repeat(64),
    },
  ],
  comments: [
    {
      id: 'comment-1',
      targetId: 'target-source-1',
      snapshotId: 'a'.repeat(64),
      anchor: {
        kind: 'range',
        fileOccurrence: 0,
        hunkOccurrence: 0,
        side: 'new',
        startLine: 42,
        endLine: 43,
        coordinateSpace: 'raw-source',
        selectedText: 'cache.set(key, result);\nreturn result;',
        contextBefore: [],
        contextAfter: [],
      },
      capturedContext: {
        targetKind: 'source',
        targetLabel: 'src/cache.ts',
        repositoryLabel: 'org/repo',
        baseRevisionLabel: 'main',
        headRevisionLabel: 'feature/cache-fix',
        oldPath: 'src/cache.ts',
        newPath: 'src/cache.ts',
        fileOccurrence: 0,
        snapshotId: 'a'.repeat(64),
        rawMapping: { status: 'exact' },
      },
      body: 'Only cache successful results.',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      resolved: false,
      outdated: false,
    },
  ],
  drafts: [],
  reviewNote: '',
  selectedTargetId: 'target-source-1',
  selectedFileOccurrence: 0,
  reviewedMarkers: [],
};

// ============================================================================
// Invalid state fixtures (one per finite error code restore can return)
// ============================================================================

/** Deliberately untyped: cast at the point of use, as with the invalid target fixtures above. */
export const unsupportedVersionStateFixture = {
  ...validSerializedStateFixture,
  version: 2,
};

export const unknownTopLevelKeyStateFixture = {
  ...validSerializedStateFixture,
  unexpectedField: true,
};

export const duplicateCommentIdStateFixture: DiffReviewSerializedState = {
  ...validSerializedStateFixture,
  comments: [
    validSerializedStateFixture.comments[0]!,
    { ...validSerializedStateFixture.comments[0]! },
  ],
};

export const invalidTimestampStateFixture: DiffReviewSerializedState = {
  ...validSerializedStateFixture,
  comments: [{ ...validSerializedStateFixture.comments[0]!, createdAt: 'not-a-timestamp' }],
};
