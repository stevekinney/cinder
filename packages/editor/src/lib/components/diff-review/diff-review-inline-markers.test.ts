import { describe, expect, test } from 'bun:test';

import type {
  DiffReviewMarkdownTargetInput,
  DiffReviewState,
  DiffReviewTargetInput,
} from '../../diff-review-state/index.ts';
import { createDiffReviewState, reduceDiffReviewState } from '../../diff-review-state/index.ts';
import {
  buildDiffReviewCurrentLineMarkerKeys,
  hasDiffReviewCurrentFileMarker,
  hasDiffReviewCurrentLineMarker,
} from './diff-review-inline-markers.ts';

const markdownTargets: DiffReviewMarkdownTargetInput[] = [
  {
    targetId: 't1',
    kind: 'markdown',
    label: 'notes.md',
    original: 'line one\nline two\nline three',
    current: 'line one\nline TWO\nline three',
    normalizeInputs: false,
  },
];

function createdState(targets: DiffReviewTargetInput[]): DiffReviewState {
  const created = createDiffReviewState(targets);
  if (!created.ok) throw new Error('fixture setup failed');
  return created.value;
}

function withComment(
  state: DiffReviewState,
  overrides: Partial<Parameters<typeof reduceDiffReviewState>[1]> = {},
): DiffReviewState {
  const result = reduceDiffReviewState(state, {
    type: 'create-comment',
    targetId: 't1',
    anchor: {
      kind: 'range',
      fileOccurrence: 0,
      hunkOccurrence: 0,
      side: 'new',
      startLine: 2,
      endLine: 2,
      coordinateSpace: 'normalized-markdown',
      selectedText: 'line TWO',
      contextBefore: [],
      contextAfter: [],
    },
    body: 'A comment',
    ...overrides,
  } as Parameters<typeof reduceDiffReviewState>[1]);
  if (!result.ok) throw new Error('fixture setup failed');
  return result.value;
}

describe('DiffReview component inline markers', () => {
  test('a current range comment produces a marker key for its line', () => {
    const state = withComment(createdState(markdownTargets));
    const keys = buildDiffReviewCurrentLineMarkerKeys(state);
    expect(hasDiffReviewCurrentLineMarker(keys, 't1', 0, 'new', 2)).toBe(true);
  });

  test('an outdated comment on the same file contributes no marker key -- current and outdated side by side', () => {
    const current = withComment(createdState(markdownTargets));
    // Latch a second, distinct target's comment as outdated by changing its content,
    // then re-add a live current comment on t1's line 2 to prove co-existence.
    const outdatedTargets: DiffReviewTargetInput[] = [
      { ...markdownTargets[0]!, current: 'line one\nline TWO\nline THREE changed' },
    ];
    const afterContentChange = reduceDiffReviewState(current, {
      type: 'set-targets',
      targets: outdatedTargets,
    });
    if (!afterContentChange.ok) throw new Error('fixture setup failed');
    // The original comment on line 2 is now latched outdated by the content change.
    expect(afterContentChange.value.comments[0]?.outdated).toBe(true);

    const keys = buildDiffReviewCurrentLineMarkerKeys(afterContentChange.value);
    // The now-outdated comment must not produce a marker any more.
    expect(hasDiffReviewCurrentLineMarker(keys, 't1', 0, 'new', 2)).toBe(false);
  });

  test('a current file-level comment is reported by hasDiffReviewCurrentFileMarker', () => {
    const state = createdState(markdownTargets);
    const result = reduceDiffReviewState(state, {
      type: 'create-comment',
      targetId: 't1',
      anchor: { kind: 'file', fileOccurrence: 0 },
      body: 'File-level note',
    });
    if (!result.ok) throw new Error('fixture setup failed');
    expect(hasDiffReviewCurrentFileMarker(result.value, 't1', 0)).toBe(true);
  });

  test('an outdated file-level comment is not reported as a current file marker', () => {
    const state = createdState(markdownTargets);
    const created = reduceDiffReviewState(state, {
      type: 'create-comment',
      targetId: 't1',
      anchor: { kind: 'file', fileOccurrence: 0 },
      body: 'File-level note',
    });
    if (!created.ok) throw new Error('fixture setup failed');
    const changed = reduceDiffReviewState(created.value, {
      type: 'set-targets',
      targets: [{ ...markdownTargets[0]!, current: 'entirely different content' }],
    });
    if (!changed.ok) throw new Error('fixture setup failed');
    expect(hasDiffReviewCurrentFileMarker(changed.value, 't1', 0)).toBe(false);
  });

  test("a current and an outdated comment on the same file, present at once, produce exactly the current one's marker", () => {
    const current = withComment(createdState(markdownTargets));
    const contentChanged = reduceDiffReviewState(current, {
      type: 'set-targets',
      targets: [{ ...markdownTargets[0]!, current: 'line one\nline TWO\nline THREE' }],
    });
    if (!contentChanged.ok) throw new Error('fixture setup failed');
    expect(contentChanged.value.comments[0]?.outdated).toBe(true);

    // A fresh comment created AFTER the content change, on the newly
    // changed line 3, is current -- it coexists in the same state as the
    // now-outdated line-2 comment above.
    const withBoth = reduceDiffReviewState(contentChanged.value, {
      type: 'create-comment',
      targetId: 't1',
      anchor: {
        kind: 'range',
        fileOccurrence: 0,
        hunkOccurrence: 0,
        side: 'new',
        startLine: 3,
        endLine: 3,
        coordinateSpace: 'normalized-markdown',
        selectedText: 'line THREE',
        contextBefore: [],
        contextAfter: [],
      },
      body: 'A fresh comment',
    });
    if (!withBoth.ok) throw new Error('fixture setup failed');
    expect(withBoth.value.comments).toHaveLength(2);

    const keys = buildDiffReviewCurrentLineMarkerKeys(withBoth.value);
    expect(hasDiffReviewCurrentLineMarker(keys, 't1', 0, 'new', 2)).toBe(false);
    expect(hasDiffReviewCurrentLineMarker(keys, 't1', 0, 'new', 3)).toBe(true);
  });

  test('a removed target contributes no current line marker', () => {
    const state = withComment(createdState(markdownTargets));
    const removed = reduceDiffReviewState(state, { type: 'set-targets', targets: [] });
    if (!removed.ok) throw new Error('fixture setup failed');
    const keys = buildDiffReviewCurrentLineMarkerKeys(removed.value);
    expect(hasDiffReviewCurrentLineMarker(keys, 't1', 0, 'new', 2)).toBe(false);
  });
});
