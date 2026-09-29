/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '@lostgradient/testing';
import type { Thread } from '../../comments/index.ts';
import type { DiffReviewAction, DiffReviewState } from '../../diff-review-state/index.ts';
import { createDiffReviewState, reduceDiffReviewState } from '../../diff-review-state/index.ts';

setupHappyDom();

const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
const { default: CommentSidebar } = await import('./comment-sidebar.svelte');

afterEach(() => {
  cleanup();
});

const RANGE_ANCHOR = {
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

function baseState(): DiffReviewState {
  const created = createDiffReviewState([
    {
      targetId: 'doc-1',
      kind: 'markdown',
      label: 'Document diff',
      original: 'removed line\nkept line',
      current: 'kept line',
      normalizeInputs: true,
    },
  ]);
  if (!created.ok) throw new Error('setup failed: invalid initial target');
  return created.value;
}

/** Dispatches `action`, throwing on the (unexpected, in these fixtures) failure branch so tests
 * fail loudly instead of silently operating on stale state. */
function apply(state: DiffReviewState, action: DiffReviewAction): DiffReviewState {
  const result = reduceDiffReviewState(state, action);
  if (!result.ok) throw new Error(`setup failed: ${result.error.code} ${result.error.message}`);
  return result.value;
}

function stateWithCurrentComment(): DiffReviewState {
  return apply(baseState(), {
    type: 'create-comment',
    id: 'comment-current',
    targetId: 'doc-1',
    anchor: RANGE_ANCHOR,
    body: 'This deletion looks intentional.',
  });
}

function stateWithOutdatedComment(): DiffReviewState {
  const withComment = stateWithCurrentComment();
  // Re-supplying the same target with different content latches every comment on it outdated
  // without removing the target itself (DR-2, "reviewed markers"/"outdated" contract).
  return apply(withComment, {
    type: 'set-targets',
    targets: [
      {
        targetId: 'doc-1',
        kind: 'markdown',
        label: 'Document diff',
        original: 'removed line\nkept line',
        current: 'kept line\nmore',
        normalizeInputs: true,
      },
    ],
  });
}

function stateWithRemovedComment(): DiffReviewState {
  const withComment = stateWithCurrentComment();
  return apply(withComment, { type: 'set-targets', targets: [] });
}

function stateWithResolvedComment(): DiffReviewState {
  return apply(stateWithCurrentComment(), { type: 'resolve-comment', id: 'comment-current' });
}

const THREAD: Thread = {
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

describe('ReviewEditor diff comments: comment sidebar merged list — absence is a no-op', () => {
  test('renders no diff rows and no kind badges when diffReviewState is undefined', () => {
    const { container } = render(CommentSidebar, {
      props: { id: 'sidebar-1', threads: [THREAD] },
    });
    expect(container.querySelector('[data-anchor-kind="diff"]')).toBeNull();
    expect(container.querySelector('.diff-comment-kind-badge')).toBeNull();
  });
});

describe('ReviewEditor diff comments: comment sidebar merged list — one list, distinguished by kind', () => {
  test('renders both a document thread row and a diff comment row in the same list', () => {
    const { container } = render(CommentSidebar, {
      props: { id: 'sidebar-2', threads: [THREAD], diffReviewState: stateWithCurrentComment() },
    });
    const list = container.querySelector('.thread-list');
    expect(list).not.toBeNull();
    expect(list?.querySelector('.thread-quote')).not.toBeNull();
    expect(list?.querySelector('[data-anchor-kind="diff"]')).not.toBeNull();
    expect(list?.querySelector('.diff-comment-kind-badge')?.textContent).toBe('Diff · old');
  });

  test('the header count includes both document threads and diff comments', () => {
    const { container } = render(CommentSidebar, {
      props: { id: 'sidebar-3', threads: [THREAD], diffReviewState: stateWithCurrentComment() },
    });
    expect(container.querySelector('.thread-count')?.textContent).toBe('2');
  });
});

describe('ReviewEditor diff comments: comment sidebar merged list — navigation by anchor status', () => {
  test('a CURRENT diff comment calls onDiffCommentNavigate', async () => {
    let navigated: string | undefined;
    const { container } = render(CommentSidebar, {
      props: {
        id: 'sidebar-4',
        threads: [],
        diffReviewState: stateWithCurrentComment(),
        onDiffCommentNavigate: (comment) => {
          navigated = comment.id;
        },
      },
    });
    const goto = container.querySelector<HTMLButtonElement>('[data-diff-comment="true"]');
    if (!goto) throw new Error('Expected a diff comment row.');
    await fireEvent.click(goto);
    expect(navigated).toBe('comment-current');
  });

  test('an OUTDATED diff comment never calls onDiffCommentNavigate, and focuses its captured detail', async () => {
    let navigated = false;
    const { container } = render(CommentSidebar, {
      props: {
        id: 'sidebar-5',
        threads: [],
        diffReviewState: stateWithOutdatedComment(),
        onDiffCommentNavigate: () => {
          navigated = true;
        },
      },
    });
    const row = container.querySelector('[data-anchor-kind="diff"]');
    expect(row?.getAttribute('data-diff-status')).toBe('outdated');
    const goto = row?.querySelector<HTMLButtonElement>('[data-diff-comment="true"]');
    if (!goto) throw new Error('Expected a diff comment row.');
    await fireEvent.click(goto);
    expect(navigated).toBe(false);
    const detail = row?.querySelector('.diff-comment-captured-detail') ?? null;
    expect(detail).not.toBeNull();
    expect(document.activeElement).toBe(detail);
  });

  test('a REMOVED diff comment never calls onDiffCommentNavigate, and shows "Removed"', async () => {
    let navigated = false;
    const { container } = render(CommentSidebar, {
      props: {
        id: 'sidebar-6',
        threads: [],
        diffReviewState: stateWithRemovedComment(),
        onDiffCommentNavigate: () => {
          navigated = true;
        },
      },
    });
    const row = container.querySelector('[data-anchor-kind="diff"]');
    expect(row?.getAttribute('data-diff-status')).toBe('removed');
    expect(row?.textContent).toContain('Removed');
    const goto = row?.querySelector<HTMLButtonElement>('[data-diff-comment="true"]');
    if (!goto) throw new Error('Expected a diff comment row.');
    await fireEvent.click(goto);
    expect(navigated).toBe(false);
  });
});

describe('ReviewEditor diff comments: comment sidebar merged list — mutation actions', () => {
  test('Resolve dispatches a resolve-comment action', async () => {
    let dispatched: DiffReviewAction | undefined;
    const { container } = render(CommentSidebar, {
      props: {
        id: 'sidebar-7',
        threads: [],
        diffReviewState: stateWithCurrentComment(),
        onDiffCommentAction: (action) => {
          dispatched = action;
        },
      },
    });
    const resolve = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Resolve',
    );
    if (!resolve) throw new Error('Expected a Resolve button.');
    await fireEvent.click(resolve);
    expect(dispatched).toEqual({ type: 'resolve-comment', id: 'comment-current' });
  });

  test('a resolved diff comment shows the Resolved badge and a Reopen action that dispatches reopen-comment', async () => {
    let dispatched: DiffReviewAction | undefined;
    const { container } = render(CommentSidebar, {
      props: {
        id: 'sidebar-resolved',
        threads: [],
        diffReviewState: stateWithResolvedComment(),
        onDiffCommentAction: (action) => {
          dispatched = action;
        },
      },
    });
    const row = container.querySelector('[data-anchor-kind="diff"]');
    expect(row?.querySelector('.diff-comment-status-resolved')?.textContent).toBe('Resolved');
    const reopen = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Reopen',
    );
    if (!reopen) throw new Error('Expected a Reopen button.');
    await fireEvent.click(reopen);
    expect(dispatched).toEqual({ type: 'reopen-comment', id: 'comment-current' });
  });

  test('a readonly sidebar renders no mutation controls for diff comments', () => {
    const { container } = render(CommentSidebar, {
      props: {
        id: 'sidebar-8',
        threads: [],
        readonly: true,
        diffReviewState: stateWithCurrentComment(),
      },
    });
    expect(container.querySelector('.diff-comment-row-actions')).toBeNull();
  });
});

describe('ReviewEditor diff comments: comment sidebar merged list — delete requires explicit confirmation', () => {
  /**
   * Contract (Experience): "Deleting a new diff comment removes it from state and subsequent
   * exports after an explicit confirmation." `diff-review-comment-item.svelte` (the standalone
   * `DiffReviewComments` leaf) already gates its own delete behind a `ConfirmDialog`; this row is
   * a SEPARATE implementation (COR-512 / DR-7's own merged list), so it must independently honor
   * the same rule rather than dispatching `delete-comment` on a bare click.
   */
  test('clicking Delete does not immediately dispatch delete-comment', async () => {
    let dispatched: DiffReviewAction | undefined;
    const { container } = render(CommentSidebar, {
      props: {
        id: 'sidebar-delete-1',
        threads: [],
        diffReviewState: stateWithCurrentComment(),
        onDiffCommentAction: (action) => {
          dispatched = action;
        },
      },
    });
    const deleteButton = container.querySelector<HTMLButtonElement>(
      '[aria-label^="Delete diff comment"]',
    );
    if (!deleteButton) throw new Error('Expected a delete button.');
    await fireEvent.click(deleteButton);
    expect(dispatched).toBeUndefined();
  });

  test('confirming the delete prompt dispatches delete-comment exactly once', async () => {
    let dispatched: DiffReviewAction | undefined;
    const { container } = render(CommentSidebar, {
      props: {
        id: 'sidebar-delete-2',
        threads: [],
        diffReviewState: stateWithCurrentComment(),
        onDiffCommentAction: (action) => {
          dispatched = action;
        },
      },
    });
    const deleteButton = container.querySelector<HTMLButtonElement>(
      '[aria-label^="Delete diff comment"]',
    );
    if (!deleteButton) throw new Error('Expected a delete button.');
    await fireEvent.click(deleteButton);

    const confirm = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Delete',
    );
    if (!confirm) throw new Error('Expected a confirmation Delete action.');
    await fireEvent.click(confirm);

    expect(dispatched).toEqual({ type: 'delete-comment', id: 'comment-current' });
  });

  test('cancelling the delete prompt never dispatches delete-comment', async () => {
    let dispatched: DiffReviewAction | undefined;
    const { container } = render(CommentSidebar, {
      props: {
        id: 'sidebar-delete-3',
        threads: [],
        diffReviewState: stateWithCurrentComment(),
        onDiffCommentAction: (action) => {
          dispatched = action;
        },
      },
    });
    const deleteButton = container.querySelector<HTMLButtonElement>(
      '[aria-label^="Delete diff comment"]',
    );
    if (!deleteButton) throw new Error('Expected a delete button.');
    await fireEvent.click(deleteButton);

    const cancel = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Cancel',
    );
    if (!cancel) throw new Error('Expected a Cancel action.');
    await fireEvent.click(cancel);

    expect(dispatched).toBeUndefined();
  });
});
