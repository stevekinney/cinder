/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '@lostgradient/testing';

import type { DiffReviewState, DiffReviewTargetInput } from '../../diff-review-state/index.ts';
import { createDiffReviewState, reduceDiffReviewState } from '../../diff-review-state/index.ts';
import type {
  DiffReviewRendererProps,
  DiffReviewRendererRef,
} from './diff-review-renderer.types.ts';

setupHappyDom();

const { cleanup, render, waitFor } = await import('@testing-library/svelte');
const { default: DiffReviewRenderer } = await import('./diff-review-renderer.svelte');

afterEach(() => cleanup());

const markdownTarget: DiffReviewTargetInput = {
  targetId: 't1',
  kind: 'markdown',
  label: 'notes.md',
  original: 'line one\nline two\nline three',
  current: 'line one\nline TWO\nline three',
  normalizeInputs: false,
};

const noChangeMarkdownTarget: DiffReviewTargetInput = {
  targetId: 't1',
  kind: 'markdown',
  label: 'unchanged.md',
  original: 'same content',
  current: 'same content',
  normalizeInputs: false,
};

const sourceTarget: DiffReviewTargetInput = {
  targetId: 't1',
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

function createdState(targets: DiffReviewTargetInput[]): DiffReviewState {
  const created = createDiffReviewState(targets);
  if (!created.ok) throw new Error('fixture setup failed');
  return created.value;
}

/**
 * `DiffReviewRenderer`'s own prop is named `target`, which collides with
 * `@testing-library/svelte`'s mount-option name of the same spelling -- its
 * `render(Component, options)` only treats `options` as props when NONE of
 * its keys match a mount-option name, so every call here must wrap props
 * under the explicit `props` key.
 */
function renderRenderer(props: DiffReviewRendererProps) {
  return render(DiffReviewRenderer, { props } as never);
}

function baseProps(
  target: DiffReviewTargetInput,
  state: DiffReviewState,
  overrides: Partial<DiffReviewRendererProps> = {},
): DiffReviewRendererProps {
  return {
    target,
    state,
    selectedFileOccurrence: 0,
    resetToken: 0,
    onSelectionChange: () => {},
    ...overrides,
  };
}

/**
 * `ref` is a `$bindable` prop, populated by the component's own `$effect`
 * after mount -- capturing it through `@testing-library/svelte` needs a
 * getter/setter *accessor property*, mirroring `SourceDiffViewer`'s own
 * `ref.focusFile`/`ref.focusAnchor` tests. It must be defined directly as an
 * object-literal accessor in the exact object passed to `render` -- object
 * spread (`{ ...refBindingProps }`) copies the getter's CURRENT VALUE as a
 * plain data property and silently drops the setter, breaking the binding.
 */
function renderWithRefBinding(
  props: DiffReviewRendererProps,
): () => DiffReviewRendererRef | undefined {
  let current: DiffReviewRendererRef | undefined;
  renderRenderer({
    ...props,
    get ref() {
      return current;
    },
    set ref(next: DiffReviewRendererRef | undefined) {
      current = next;
    },
  });
  return () => current;
}

describe('DiffReview component renderer: ref.focusAnchor / ref.focusFile', () => {
  test('focusAnchor on a Markdown target focuses the matching DiffViewer control', async () => {
    const getRef = renderWithRefBinding(baseProps(markdownTarget, createdState([markdownTarget])));

    await waitFor(() => expect(getRef()).toBeDefined());
    const result = getRef()!.focusAnchor({
      fileOccurrence: 0,
      hunkOccurrence: 0,
      side: 'new',
      startLine: 2,
    });
    expect(result.status).toBe('focused');
  });

  test('focusAnchor reports unavailable for a line no control exists for', async () => {
    const getRef = renderWithRefBinding(baseProps(markdownTarget, createdState([markdownTarget])));

    await waitFor(() => expect(getRef()).toBeDefined());
    const result = getRef()!.focusAnchor({
      fileOccurrence: 0,
      hunkOccurrence: 0,
      side: 'new',
      startLine: 999,
    });
    expect(result.status).toBe('unavailable');
  });

  test('focusFile on a Markdown target is always unavailable (no file-level focus target exists)', async () => {
    const getRef = renderWithRefBinding(baseProps(markdownTarget, createdState([markdownTarget])));

    await waitFor(() => expect(getRef()).toBeDefined());
    expect(getRef()!.focusFile(0).status).toBe('unavailable');
  });

  test('focusFile on a source target focuses the matching file header', async () => {
    const getRef = renderWithRefBinding(
      baseProps(sourceTarget, createdState([sourceTarget]), { selectedFileOccurrence: null }),
    );

    await waitFor(() => expect(getRef()).toBeDefined());
    expect(getRef()!.focusFile(1).status).toBe('focused');
  });

  test('focusAnchor on a source target focuses the matching line control', async () => {
    const getRef = renderWithRefBinding(
      baseProps(sourceTarget, createdState([sourceTarget]), { selectedFileOccurrence: null }),
    );

    await waitFor(() => expect(getRef()).toBeDefined());
    const result = getRef()!.focusAnchor({
      fileOccurrence: 1,
      hunkOccurrence: 0,
      side: 'new',
      startLine: 1,
    });
    expect(result.status).toBe('focused');
  });
});

describe('DiffReview component renderer: current-only inline markers', () => {
  test('a current range comment renders a marker at its Markdown line, an outdated one does not', () => {
    const state = createdState([markdownTarget]);
    const created = reduceDiffReviewState(state, {
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
      body: 'note',
    });
    if (!created.ok) throw new Error('fixture setup failed');

    const { container } = renderRenderer(baseProps(markdownTarget, created.value));
    expect(
      container.querySelector('[data-diff-review-inline-marker][data-side="new"][data-line="2"]'),
    ).not.toBeNull();

    // Now latch it outdated via a content change and confirm the marker disappears.
    const outdated = reduceDiffReviewState(created.value, {
      type: 'set-targets',
      targets: [{ ...markdownTarget, current: 'line one\nline TWO\nline THREE now' }],
    });
    if (!outdated.ok) throw new Error('fixture setup failed');
    cleanup();
    const { container: container2 } = renderRenderer(baseProps(markdownTarget, outdated.value));
    expect(
      container2.querySelector('[data-diff-review-inline-marker][data-side="new"][data-line="2"]'),
    ).toBeNull();
  });

  test('a current and an outdated comment on the same file render at once: exactly one marker, on the current line', () => {
    const created = reduceDiffReviewState(createdState([markdownTarget]), {
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
      body: 'outdated-to-be',
    });
    if (!created.ok) throw new Error('fixture setup failed');

    const changedTarget: DiffReviewTargetInput = {
      ...markdownTarget,
      current: 'line one\nline TWO\nline THREE',
    };
    const contentChanged = reduceDiffReviewState(created.value, {
      type: 'set-targets',
      targets: [changedTarget],
    });
    if (!contentChanged.ok) throw new Error('fixture setup failed');
    expect(contentChanged.value.comments[0]?.outdated).toBe(true);

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
      body: 'current',
    });
    if (!withBoth.ok) throw new Error('fixture setup failed');

    const { container } = renderRenderer(baseProps(changedTarget, withBoth.value));
    expect(
      container.querySelector('[data-diff-review-inline-marker][data-side="new"][data-line="2"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-diff-review-inline-marker][data-side="new"][data-line="3"]'),
    ).not.toBeNull();
  });

  test('a current file-level comment renders a marker next to a source file header', () => {
    const state = createdState([sourceTarget]);
    const created = reduceDiffReviewState(state, {
      type: 'create-comment',
      targetId: 't1',
      anchor: { kind: 'file', fileOccurrence: 0 },
      body: 'file note',
    });
    if (!created.ok) throw new Error('fixture setup failed');

    const { container } = renderRenderer(
      baseProps(sourceTarget, created.value, { selectedFileOccurrence: null }),
    );
    const markers = container.querySelectorAll('[data-diff-review-inline-marker][data-file="0"]');
    expect(markers.length).toBeGreaterThan(0);
    expect(
      container.querySelectorAll('[data-diff-review-inline-marker][data-file="1"]'),
    ).toHaveLength(0);
  });
});

describe('DiffReview component renderer: empty and failure states', () => {
  test('a target with zero changed lines shows the "No commentable patch lines" message', () => {
    const { container } = renderRenderer(
      baseProps(noChangeMarkdownTarget, createdState([noChangeMarkdownTarget])),
    );
    expect(container.textContent).toContain('No commentable patch lines.');
  });

  test('a target that throws while rendering shows a local, scoped error instead of crashing', () => {
    const brokenSourceTarget = {
      targetId: 't1',
      kind: 'source',
      label: 'Broken',
      // Intentionally malformed beyond the shape `validateDiffReviewTargetList`
      // checks (a non-string patch) to prove the boundary is a real defensive
      // net, not merely decorative, for exactly the case where a host bypasses
      // `set-targets` validation and supplies bad live content directly.
      patch: undefined,
    } as unknown as DiffReviewTargetInput;

    const { container } = renderRenderer(
      baseProps(brokenSourceTarget, createdState([sourceTarget]), { selectedFileOccurrence: null }),
    );

    expect(container.textContent).toContain("This diff couldn't be rendered.");
  });

  test('reports the failure via onRendererFailedChange, and recovers when switched to a working target', async () => {
    const brokenSourceTarget = {
      targetId: 'broken',
      kind: 'source',
      label: 'Broken',
      patch: undefined,
    } as unknown as DiffReviewTargetInput;
    const calls: boolean[] = [];
    const { container, rerender } = renderRenderer(
      baseProps(brokenSourceTarget, createdState([sourceTarget]), {
        selectedFileOccurrence: null,
        onRendererFailedChange: (failed) => calls.push(failed),
      }),
    );

    expect(container.textContent).toContain("This diff couldn't be rendered.");
    expect(calls.at(-1)).toBe(true);

    // A `<svelte:boundary>` never re-attempts its own failed children -- only
    // switching to a genuinely different target proves recovery, not a
    // second render of the same broken one. `rerender` takes props directly
    // (unlike `render`, it isn't subject to the `target`-name collision).
    await rerender(
      baseProps(sourceTarget, createdState([sourceTarget]), {
        selectedFileOccurrence: null,
        onRendererFailedChange: (failed) => calls.push(failed),
      }),
    );

    expect(container.textContent).not.toContain("This diff couldn't be rendered.");
    expect(container.querySelectorAll('[data-cinder-annotation-control]').length).toBeGreaterThan(
      0,
    );
    expect(calls.at(-1)).toBe(false);
  });
});
