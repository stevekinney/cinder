/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '@lostgradient/testing';
import type { Thread } from '../../comments/index.ts';
import type { DiffReviewAction, DiffReviewState } from '../../diff-review-state/index.ts';
import { createDiffReviewState, reduceDiffReviewState } from '../../diff-review-state/index.ts';
import { buildReviewEditorDiffReviewTarget } from './review-editor-diff-review.ts';

/**
 * COR-512 / DR-7 behavioural coverage, mounted through the real published `ReviewEditor` wrapper
 * (`bind:this`/exported methods reach `@lostgradient/editor` only through it -- see
 * `review-editor-regressions.test.ts`'s "the imperative surface reaches the published entry
 * point").
 *
 * These tests stay on the default `editor` tab throughout: `review-editor-impl.svelte`'s `diff`
 * tab mounts the real `DiffViewer`, and `diff-viewer.test.ts`'s file header documents that the
 * composed `DiffViewer` shell cannot be mounted under this happy-dom + Svelte 5 harness (its
 * mount-time flush rebuilds several keyed blocks in one pass, which happy-dom's fragment/anchor
 * model cannot survive). The tab-switch/anchor-focus half of this feature (activating a diff
 * comment opens the diff tab and focuses its side; a comment created there survives an
 * editor-tab round trip) is real-browser-only for the same environment reason `DiffViewer`'s own
 * annotation interactions are (`diff-viewer.annotation-hooks.test.ts`) and is covered by
 * `scripts/browser-fixtures/tests/review-editor-diff-comments.playwright.ts` instead. The merged
 * comment list's own navigation routing (current vs. outdated/removed) IS covered here, at the
 * `CommentSidebar` layer, in `comment-sidebar-diff-comments.test.ts` -- it renders no `DiffViewer`
 * of its own.
 */

setupHappyDom();

const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
const { default: ReviewEditor } = await import('./review-editor.svelte');

afterEach(() => {
  cleanup();
});

function flush(): Promise<void> {
  return new Promise((resolve) => queueMicrotask(resolve));
}

function apply(state: DiffReviewState, action: DiffReviewAction): DiffReviewState {
  const result = reduceDiffReviewState(state, action);
  if (!result.ok) throw new Error(`setup failed: ${result.error.code} ${result.error.message}`);
  return result.value;
}

function makeState(id: string, original: string, value: string): DiffReviewState {
  const target = buildReviewEditorDiffReviewTarget(id, original, value);
  const created = createDiffReviewState([target]);
  if (!created.ok) throw new Error('setup failed: invalid initial target');
  return created.value;
}

const OLD_SIDE_ANCHOR = {
  kind: 'range' as const,
  fileOccurrence: 0,
  hunkOccurrence: 0,
  side: 'old' as const,
  startLine: 1,
  endLine: 1,
  coordinateSpace: 'normalized-markdown' as const,
  selectedText: 'removed line',
  contextBefore: [],
  contextAfter: [],
};

const DOCUMENT_THREAD: Thread = {
  id: 'thread-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  anchor: {
    type: 'text',
    quote: 'existing prose',
    prefix: '',
    suffix: '',
    status: 'anchored',
    from: 0,
    to: 0,
  },
  comments: [
    {
      id: 'thread-comment-1',
      threadId: 'thread-1',
      authorId: 'reviewer',
      body: 'A document-anchored note.',
      createdAt: '2026-01-01T00:00:01.000Z',
    },
  ],
};

describe('ReviewEditor diff comments: absence is a no-op', () => {
  test('renders no diff-review error or diff rows without the prop', async () => {
    const { container } = render(ReviewEditor, {
      props: { id: 'doc-absent', original: 'a', value: 'a', currentUserId: 'reviewer' },
    });
    await flush();
    expect(container.querySelector('.review-editor-diff-review-error')).toBeNull();
    expect(container.querySelector('[data-anchor-kind="diff"]')).toBeNull();
  });

  test('exportAggregateReviewMarkdown/Json report invalid-record when not enabled', () => {
    const { component } = render(ReviewEditor, {
      props: { id: 'doc-absent-2', original: 'a', value: 'a' },
    });
    const markdown = component.exportAggregateReviewMarkdown();
    const json = component.exportAggregateReviewJson();
    expect(markdown).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'invalid-record' }),
    });
    expect(json).toEqual({ ok: false, error: expect.objectContaining({ code: 'invalid-record' }) });
  });

  test('never calls onDiffReviewStateChange when the prop is absent, even as content changes', async () => {
    let called = false;
    const { component } = render(ReviewEditor, {
      props: {
        id: 'doc-absent-3',
        original: 'a',
        value: 'a',
        onDiffReviewStateChange: () => {
          called = true;
        },
      },
    });
    await flush();
    component.setMarkdown('b');
    await flush();
    expect(called).toBe(false);
  });

  test('existing export methods keep their scope regardless of a diffReviewState prop', () => {
    const withoutDiff = render(ReviewEditor, {
      props: { id: 'doc-scope-a', original: 'a', value: 'b', threads: [DOCUMENT_THREAD] },
    });
    const withDiff = render(ReviewEditor, {
      props: {
        id: 'doc-scope-b',
        original: 'a',
        value: 'b',
        threads: [DOCUMENT_THREAD],
        diffReviewState: makeState('doc-scope-b', 'a', 'b'),
      },
    });
    // Same original/value/threads (only the id differs, which the summary/diff exporters never
    // read) -- enabling diff review must not change what these pre-existing methods return.
    expect(withDiff.component.exportMarkdownSummary()).toEqual(
      withoutDiff.component.exportMarkdownSummary(),
    );
    expect(withDiff.component.getFormData().comments).toBe(
      withoutDiff.component.getFormData().comments,
    );
  });
});

describe('ReviewEditor diff comments: enabling validates atomically', () => {
  test('a valid supplied state shows no integration error', async () => {
    const { container } = render(ReviewEditor, {
      props: {
        id: 'doc-valid',
        original: 'a',
        value: 'a',
        diffReviewState: makeState('doc-valid', 'a', 'a'),
      },
    });
    await flush();
    expect(container.querySelector('.review-editor-diff-review-error')).toBeNull();
  });

  test('an invalid supplied state shows an integration error, keeps the last valid state, and document editing still works', async () => {
    const id = 'doc-invalid';
    const valid = makeState(id, 'a', 'a');
    const { container, component, rerender } = render(ReviewEditor, {
      props: { id, original: 'a', value: 'a', diffReviewState: valid },
    });
    await flush();
    expect(container.querySelector('.review-editor-diff-review-error')).toBeNull();
    expect(component.exportAggregateReviewMarkdown().ok).toBe(true);

    const invalid = { ...valid, version: 2 } as unknown as DiffReviewState;
    await rerender({ diffReviewState: invalid });
    await flush();

    const error = container.querySelector('.review-editor-diff-review-error');
    expect(error).not.toBeNull();
    expect(error?.textContent).toContain('unsupported-version');

    // The last VALID state is still exportable -- an invalid update never blanks it out.
    expect(component.exportAggregateReviewMarkdown().ok).toBe(true);

    // Document editing is completely unaffected by the invalid diff-review prop.
    component.setMarkdown('a new document body');
    expect(component.getMarkdown()).toBe('a new document body');
  });
});

describe('ReviewEditor diff comments: enable/disable/resupply lifecycle', () => {
  test('removing the prop stops the integration without erasing state; resupplying restores it', async () => {
    const id = 'doc-lifecycle';
    const withComment = apply(makeState(id, 'a', 'a'), {
      type: 'create-comment',
      id: 'comment-1',
      targetId: id,
      anchor: OLD_SIDE_ANCHOR,
      body: 'Keep this in mind.',
    });

    const { container, component, rerender } = render(ReviewEditor, {
      props: { id, original: 'a', value: 'a', diffReviewState: withComment },
    });
    await flush();
    expect(component.exportAggregateReviewMarkdown().ok).toBe(true);

    await rerender({ diffReviewState: undefined });
    await flush();
    expect(container.querySelector('[data-anchor-kind="diff"]')).toBeNull();
    expect(component.exportAggregateReviewMarkdown()).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'invalid-record' }),
    });

    // The host still owns `withComment` untouched -- supplying it again restores the comment.
    await rerender({ diffReviewState: withComment });
    await flush();
    const restored = component.exportAggregateReviewMarkdown();
    expect(restored.ok).toBe(true);
    if (restored.ok) expect(restored.value).toContain('Keep this in mind.');
  });
});

describe('ReviewEditor diff comments: content-change latch', () => {
  test('a committed value change immediately latches diff comments on that target outdated, without affecting prose threads', async () => {
    const id = 'doc-latch';
    const withComment = apply(makeState(id, 'original text', 'original text'), {
      type: 'create-comment',
      id: 'comment-1',
      targetId: id,
      anchor: OLD_SIDE_ANCHOR,
      body: 'Please double-check this.',
    });

    let latest: DiffReviewState | undefined;
    const { component } = render(ReviewEditor, {
      props: {
        id,
        original: 'original text',
        value: 'original text',
        threads: [DOCUMENT_THREAD],
        diffReviewState: withComment,
        onDiffReviewStateChange: (next) => {
          latest = next;
        },
      },
    });
    await flush();
    expect(withComment.comments[0]?.outdated).toBe(false);

    component.setMarkdown('changed text');
    await flush();

    expect(latest).toBeDefined();
    expect(latest?.comments[0]?.outdated).toBe(true);
    // The comment is retained, not dropped, by the latch.
    expect(latest?.comments).toHaveLength(1);
  });

  test('a committed original (baseline) change also immediately latches diff comments on that target outdated', async () => {
    const id = 'doc-latch-original';
    const withComment = apply(makeState(id, 'original text', 'current text'), {
      type: 'create-comment',
      id: 'comment-1',
      targetId: id,
      anchor: OLD_SIDE_ANCHOR,
      body: 'Please double-check this.',
    });

    let latest: DiffReviewState | undefined;
    const { rerender } = render(ReviewEditor, {
      props: {
        id,
        original: 'original text',
        value: 'current text',
        diffReviewState: withComment,
        onDiffReviewStateChange: (next) => {
          latest = next;
        },
      },
    });
    await flush();
    expect(withComment.comments[0]?.outdated).toBe(false);

    // Only the BASELINE changes here -- `value` is untouched. The target's content identity is
    // still derived from both, so this alone must latch every comment on it outdated.
    await rerender({ original: 'a completely different baseline' });
    await flush();

    expect(latest).toBeDefined();
    expect(latest?.comments[0]?.outdated).toBe(true);
    expect(latest?.comments).toHaveLength(1);
  });
});

describe("ReviewEditor diff comments: mode='readonly' drives the same mutation restrictions", () => {
  test('a readonly ReviewEditor renders no diff-comment mutation controls, and export remains available', async () => {
    const id = 'doc-readonly';
    const withComment = apply(makeState(id, 'removed line\nkept line', 'kept line'), {
      type: 'create-comment',
      id: 'comment-1',
      targetId: id,
      anchor: OLD_SIDE_ANCHOR,
      body: 'Please double-check this.',
    });

    const { container, component } = render(ReviewEditor, {
      props: {
        id,
        original: 'removed line\nkept line',
        value: 'kept line',
        mode: 'readonly',
        diffReviewState: withComment,
      },
    });
    await flush();

    const toggle = container.querySelector<HTMLButtonElement>(`#${id}-sidebar-toggle`);
    if (!toggle) throw new Error('Expected the comments sidebar toggle.');
    await fireEvent.click(toggle);

    const diffRow = container.querySelector('[data-anchor-kind="diff"]');
    expect(diffRow).not.toBeNull();
    expect(container.querySelector('.diff-comment-row-actions')).toBeNull();

    // Read-only drives the same MUTATION restrictions -- navigation, viewing, and export remain
    // available (contract, "readonly defaults false ... navigation, filters, viewing comments,
    // and valid exports remain available").
    expect(component.exportAggregateReviewMarkdown().ok).toBe(true);
  });
});

describe('ReviewEditor diff comments: aggregate export', () => {
  test('combines every document thread/reply and every saved diff comment exactly once, preserving coordinate-space labels', () => {
    const id = 'doc-aggregate';
    const withComment = apply(makeState(id, 'removed line\nkept line', 'kept line'), {
      type: 'create-comment',
      id: 'diff-comment-1',
      targetId: id,
      anchor: OLD_SIDE_ANCHOR,
      body: 'This deletion looks intentional.',
    });

    const { component } = render(ReviewEditor, {
      props: {
        id,
        original: 'removed line\nkept line',
        value: 'kept line',
        threads: [DOCUMENT_THREAD],
        diffReviewState: withComment,
      },
    });

    const markdown = component.exportAggregateReviewMarkdown();
    expect(markdown.ok).toBe(true);
    if (!markdown.ok) return;
    expect(markdown.value).toContain('This deletion looks intentional.');
    expect(markdown.value).toContain('old');
    expect(markdown.value).toContain('A document-anchored note.');

    const json = component.exportAggregateReviewJson();
    expect(json.ok).toBe(true);
    if (!json.ok) return;
    const parsed = JSON.parse(json.value) as { records: unknown[] };
    expect(parsed.records).toHaveLength(2);

    // Calling export again (a "copy" and a "download" of the same review) never duplicates
    // records -- exporting is pure and reads no mutable UI state.
    const secondJson = component.exportAggregateReviewJson();
    expect(secondJson).toEqual(json);
  });

  test('an unresolved-only scope excludes a resolved diff comment but keeps every document thread', () => {
    const id = 'doc-aggregate-scope';
    const resolved = apply(
      apply(makeState(id, 'removed line\nkept line', 'kept line'), {
        type: 'create-comment',
        id: 'diff-comment-1',
        targetId: id,
        anchor: OLD_SIDE_ANCHOR,
        body: 'Resolved already.',
      }),
      { type: 'resolve-comment', id: 'diff-comment-1' },
    );

    const { component } = render(ReviewEditor, {
      props: {
        id,
        original: 'removed line\nkept line',
        value: 'kept line',
        threads: [DOCUMENT_THREAD],
        diffReviewState: resolved,
      },
    });

    const markdown = component.exportAggregateReviewMarkdown({ scope: 'unresolved' });
    expect(markdown.ok).toBe(true);
    if (!markdown.ok) return;
    expect(markdown.value).not.toContain('Resolved already.');
    expect(markdown.value).toContain('A document-anchored note.');
  });

  test('the aggregate export distinguishes the two anchor domains: normalized-markdown for the diff record, document-text for the thread, and distinct domain-tagged IDs', () => {
    const id = 'doc-aggregate-labels';
    const withComment = apply(makeState(id, 'removed line\nkept line', 'kept line'), {
      type: 'create-comment',
      id: 'diff-comment-1',
      targetId: id,
      anchor: OLD_SIDE_ANCHOR,
      body: 'This deletion looks intentional.',
    });

    const { component } = render(ReviewEditor, {
      props: {
        id,
        original: 'removed line\nkept line',
        value: 'kept line',
        threads: [DOCUMENT_THREAD],
        diffReviewState: withComment,
      },
    });

    const json = component.exportAggregateReviewJson();
    expect(json.ok).toBe(true);
    if (!json.ok) return;
    const parsed = JSON.parse(json.value) as {
      records: Array<{
        recordKind: string;
        exportId: string;
        anchor: { kind: string; coordinateSpace?: string };
      }>;
    };
    expect(parsed.records).toHaveLength(2);
    const diffRecord = parsed.records.find((record) => record.recordKind === 'diff');
    const documentRecord = parsed.records.find((record) => record.recordKind === 'document');
    expect(diffRecord?.anchor.coordinateSpace).toBe('normalized-markdown');
    expect(documentRecord?.anchor.kind).toBe('document-text');
    // Export IDs are domain-tagged tuples serialized as JSON strings (contract, "Identity,
    // schema, and validation") -- the two record kinds must never collide, and this asserts both
    // are actually tagged, not merely "different by accident of comment ID text."
    expect(diffRecord?.exportId).toBe(JSON.stringify(['diff', 'diff-comment-1']));
    expect(documentRecord?.exportId).toBe(JSON.stringify(['document', id, 'thread-1']));
  });
});

describe('ReviewEditor diff comments: unsaved drafts inventory', () => {
  /**
   * Contract ("Drafts, modes, and ReviewEditor"): "Cancel preserves an existing draft; only the
   * explicitly confirmed discard action deletes nonempty text," and every nonempty draft "must
   * be saved or explicitly discarded" before ANY export scope is available. A draft is created
   * entirely inside `review-editor-impl.svelte`'s own script state (`activeDiffDraftId` +
   * dispatched `create-draft`/`update-draft` actions) -- the composer textarea that types into it
   * is plain HTML, not part of the composed `DiffViewer` this harness cannot mount -- but the
   * only way to REACH that state from a `diffReviewState` prop the host supplies is to inject a
   * state that already contains a pending (nonempty-body) draft, exactly as a host reading back
   * `onDiffReviewStateChange` after a real Cancel would. See
   * `scripts/browser-fixtures/tests/review-editor-diff-comments.playwright.ts` for the real
   * select-type-Cancel round trip through the actual composer in a real browser.
   */
  function stateWithPendingDraft(id: string): DiffReviewState {
    const created = apply(makeState(id, 'removed line\nkept line', 'kept line'), {
      type: 'create-draft',
      draftId: 'draft-1',
      targetId: id,
      anchor: OLD_SIDE_ANCHOR,
      oldPath: null,
      newPath: null,
    });
    return apply(created, {
      type: 'update-draft',
      draftId: 'draft-1',
      body: 'Half-written thought, cancelled before saving.',
    });
  }

  test('a pending draft blocks aggregate export with drafts-pending, not an empty document', () => {
    const id = 'doc-draft-blocks-export';
    const { component } = render(ReviewEditor, {
      props: { id, original: 'removed line\nkept line', value: 'kept line' },
    });
    // Enabling with a state that already contains the pending draft is equivalent, for the
    // exporter's purposes, to the draft having been created live and then cancelled: the gate
    // reads state, not history.
    const withDraft = stateWithPendingDraft(id);
    const rerendered = render(ReviewEditor, {
      props: {
        id,
        original: 'removed line\nkept line',
        value: 'kept line',
        diffReviewState: withDraft,
      },
    });
    const markdown = rerendered.component.exportAggregateReviewMarkdown();
    expect(markdown).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'drafts-pending' }),
    });
    // The disabled-integration branch is a DIFFERENT error and must not be confused with this
    // one -- the earlier `component` (no diffReviewState at all) still reports `invalid-record`.
    expect(component.exportAggregateReviewMarkdown()).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'invalid-record' }),
    });
  });

  test('renders the pending draft in an "Unsaved drafts" inventory, and Discard removes it and unblocks export', async () => {
    const id = 'doc-draft-inventory';
    let latest: DiffReviewState | undefined;
    const { container, component } = render(ReviewEditor, {
      props: {
        id,
        original: 'removed line\nkept line',
        value: 'kept line',
        diffReviewState: stateWithPendingDraft(id),
        onDiffReviewStateChange: (next) => {
          latest = next;
        },
      },
    });
    await flush();

    const inventory = container.querySelector('.diff-review-drafts-inventory');
    expect(inventory).not.toBeNull();
    expect(inventory?.textContent).toContain('Half-written thought, cancelled before saving.');
    expect(component.exportAggregateReviewMarkdown()).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'drafts-pending' }),
    });

    const discard = Array.from(inventory?.querySelectorAll('button') ?? []).find(
      (button) => button.textContent?.trim() === 'Discard',
    );
    if (!discard) throw new Error('Expected a Discard button in the drafts inventory.');
    discard.click();
    await flush();

    expect(latest?.drafts).toHaveLength(0);
    expect(container.querySelector('.diff-review-drafts-inventory')).toBeNull();
    const markdown = component.exportAggregateReviewMarkdown();
    expect(markdown.ok).toBe(true);
  });

  test('readonly renders the inventory read-only: no Save/Discard controls', async () => {
    const id = 'doc-draft-inventory-readonly';
    const { container } = render(ReviewEditor, {
      props: {
        id,
        original: 'removed line\nkept line',
        value: 'kept line',
        mode: 'readonly',
        diffReviewState: stateWithPendingDraft(id),
      },
    });
    await flush();
    const inventory = container.querySelector('.diff-review-drafts-inventory');
    expect(inventory).not.toBeNull();
    expect(
      Array.from(inventory?.querySelectorAll('button') ?? []).some(
        (button) => button.textContent?.trim() === 'Discard',
      ),
    ).toBe(false);
  });
});
