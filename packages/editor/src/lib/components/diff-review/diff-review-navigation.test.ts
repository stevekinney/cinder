/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '@lostgradient/testing';

import type {
  DiffReviewMarkdownTargetInput,
  DiffReviewState,
  DiffReviewTargetInput,
} from '../../diff-review-state/index.ts';
import { createDiffReviewState, reduceDiffReviewState } from '../../diff-review-state/index.ts';
import type { DiffReviewProps } from './diff-review.types.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: DiffReview } = await import('./diff-review.svelte');

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

function baseState(): DiffReviewState {
  const created = createDiffReviewState(markdownTargets);
  if (!created.ok) throw new Error('fixture setup failed');
  return created.value;
}

function withRangeComment(state: DiffReviewState): DiffReviewState {
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
    body: 'A saved comment',
  });
  if (!result.ok) throw new Error('fixture setup failed');
  return result.value;
}

function withFileComment(state: DiffReviewState): DiffReviewState {
  const result = reduceDiffReviewState(state, {
    type: 'create-comment',
    targetId: 't1',
    anchor: { kind: 'file', fileOccurrence: 0 },
    body: 'A file-level comment',
  });
  if (!result.ok) throw new Error('fixture setup failed');
  return result.value;
}

function selectFileZero(state: DiffReviewState): DiffReviewState {
  const target = reduceDiffReviewState(state, { type: 'select-target', targetId: 't1' });
  if (!target.ok) throw new Error('fixture setup failed');
  const file = reduceDiffReviewState(target.value, { type: 'select-file', fileOccurrence: 0 });
  if (!file.ok) throw new Error('fixture setup failed');
  return file.value;
}

function renderReview(state: DiffReviewState, overrides: Partial<DiffReviewProps> = {}) {
  return render(DiffReview, {
    targets: markdownTargets,
    state,
    onStateChange: () => {},
    ...overrides,
  });
}

describe('DiffReview component shell: comment navigation', () => {
  test('"Go to" on a current comment focuses its annotation control in the diff', async () => {
    const state = selectFileZero(withRangeComment(baseState()));
    const { getByText, container } = renderReview(state);

    await getByText('Go to').click();

    const control = container.querySelector(
      '[data-cinder-annotation-control][data-cinder-side="new"][data-cinder-line="2"]',
    );
    expect(control).not.toBeNull();
    expect(document.activeElement).toBe(control);
    expect(container.querySelector('.diff-review-navigation-unavailable')).toBeNull();
  });

  test('"Go to" on a current comment whose anchor has no focus target in the current view is marked unavailable', async () => {
    // A Markdown target has no per-file focus target through DiffViewer's
    // public surface -- a current FILE-level comment's "Go to" always finds
    // nothing to focus, exercising the "unavailable" path without needing
    // to fabricate a missing line.
    const state = selectFileZero(withFileComment(baseState()));
    const { getByText, container } = renderReview(state);

    await getByText('Go to').click();

    expect(
      container.querySelector('.diff-review-navigation-unavailable[role="status"]'),
    ).not.toBeNull();
    expect(container.textContent).toContain("isn't available in the current view");
  });

  test('"Go to" on an outdated comment focuses its own captured detail, never the diff', async () => {
    const commented = withRangeComment(baseState());
    const outdated = reduceDiffReviewState(commented, {
      type: 'set-targets',
      targets: [{ ...markdownTargets[0]!, current: 'line one\nline TWO\nline THREE now' }],
    });
    if (!outdated.ok) throw new Error('fixture setup failed');
    const state = selectFileZero(outdated.value);
    const { getByText, container } = renderReview(state);

    await getByText('Go to').click();

    const capturedDetail = container.querySelector('.diff-review-comment-item-captured-detail');
    expect(capturedDetail).not.toBeNull();
    expect(document.activeElement).toBe(capturedDetail);
    // The diff pane's own annotation control must never receive focus for a
    // stale anchor.
    expect(
      container.querySelector(
        '[data-cinder-annotation-control][data-cinder-side="new"][data-cinder-line="2"]',
      ),
    ).not.toBe(document.activeElement);
  });

  test('"Go to" on a removed comment (its target dropped entirely) focuses captured detail and shows "Removed"', async () => {
    const commented = withRangeComment(baseState());
    const removed = reduceDiffReviewState(commented, { type: 'set-targets', targets: [] });
    if (!removed.ok) throw new Error('fixture setup failed');
    const { getByText, container } = renderReview(removed.value, { targets: [] });

    expect(container.textContent).toContain('Removed');
    await getByText('Go to').click();

    const capturedDetail = container.querySelector('.diff-review-comment-item-captured-detail');
    expect(document.activeElement).toBe(capturedDetail);
  });

  test('navigating to a comment on a different file selects that file, then focuses it', async () => {
    const twoFileSource: DiffReviewTargetInput = {
      targetId: 't2',
      kind: 'source',
      label: 'Patch',
      patch: `diff --git a/src/one.ts b/src/one.ts
--- a/src/one.ts
+++ b/src/one.ts
@@ -1,2 +1,2 @@
-const a = 1;
+const a = 2;
diff --git a/src/two.ts b/src/two.ts
--- a/src/two.ts
+++ b/src/two.ts
@@ -1,2 +1,2 @@
-const b = 1;
+const b = 2;
`,
    };
    const created = createDiffReviewState([twoFileSource]);
    if (!created.ok) throw new Error('fixture setup failed');
    const commented = reduceDiffReviewState(created.value, {
      type: 'create-comment',
      targetId: 't2',
      anchor: {
        kind: 'range',
        fileOccurrence: 1,
        hunkOccurrence: 0,
        side: 'new',
        startLine: 1,
        endLine: 1,
        coordinateSpace: 'raw-source',
        selectedText: 'const b = 2;',
        contextBefore: [],
        contextAfter: [],
      },
      body: 'On the second file',
    });
    if (!commented.ok) throw new Error('fixture setup failed');
    // Start on file 0, not the comment's file 1.
    const startedState = (() => {
      const target = reduceDiffReviewState(commented.value, {
        type: 'select-target',
        targetId: 't2',
      });
      if (!target.ok) throw new Error('fixture setup failed');
      const file = reduceDiffReviewState(target.value, { type: 'select-file', fileOccurrence: 0 });
      if (!file.ok) throw new Error('fixture setup failed');
      return file.value;
    })();

    let latest = startedState;
    const { getByText, container, rerender } = render(DiffReview, {
      targets: [twoFileSource],
      state: startedState,
      onStateChange: (next: DiffReviewState) => {
        latest = next;
      },
    });

    await getByText('Go to').click();
    expect(latest.selectedFileOccurrence).toBe(1);
    await rerender({ targets: [twoFileSource], state: latest, onStateChange: () => {} });

    const control = container.querySelector(
      '[data-cinder-annotation-control][data-cinder-file-occurrence="1"][data-cinder-side="new"][data-cinder-line="1"]',
    );
    expect(control).not.toBeNull();
    expect(document.activeElement).toBe(control);
  });

  test('navigating to a comment on a DIFFERENT TARGET KIND (Markdown -> source) mounts the new viewer and focuses it', async () => {
    // The riskier case the file-occurrence test above doesn't cover: this
    // swaps which *component* is mounted (DiffViewer -> SourceDiffViewer),
    // not just which file a stable SourceDiffViewer instance shows.
    const sourceTarget: DiffReviewTargetInput = {
      targetId: 'patch',
      kind: 'source',
      label: 'Patch',
      patch: `diff --git a/src/one.ts b/src/one.ts
--- a/src/one.ts
+++ b/src/one.ts
@@ -1,2 +1,2 @@
-const a = 1;
+const a = 2;
`,
    };
    const mixedTargets: DiffReviewTargetInput[] = [markdownTargets[0]!, sourceTarget];
    const created = createDiffReviewState(mixedTargets);
    if (!created.ok) throw new Error('fixture setup failed');
    const commented = reduceDiffReviewState(created.value, {
      type: 'create-comment',
      targetId: 'patch',
      anchor: {
        kind: 'range',
        fileOccurrence: 0,
        hunkOccurrence: 0,
        side: 'new',
        startLine: 1,
        endLine: 1,
        coordinateSpace: 'raw-source',
        selectedText: 'const a = 2;',
        contextBefore: [],
        contextAfter: [],
      },
      body: 'On the source target',
    });
    if (!commented.ok) throw new Error('fixture setup failed');
    // Start on the Markdown target, not the comment's source target.
    const startedState = selectFileZero(commented.value);
    expect(startedState.selectedTargetId).toBe('t1');

    let latest = startedState;
    const { getByText, container, rerender } = render(DiffReview, {
      targets: mixedTargets,
      state: startedState,
      onStateChange: (next: DiffReviewState) => {
        latest = next;
      },
    });

    await getByText('Go to').click();
    expect(latest.selectedTargetId).toBe('patch');
    await rerender({ targets: mixedTargets, state: latest, onStateChange: () => {} });

    const control = container.querySelector(
      '[data-cinder-annotation-control][data-cinder-file-occurrence="0"][data-cinder-side="new"][data-cinder-line="1"]',
    );
    expect(control).not.toBeNull();
    expect(document.activeElement).toBe(control);
    expect(container.querySelector('.diff-review-navigation-unavailable')).toBeNull();
  });
});
