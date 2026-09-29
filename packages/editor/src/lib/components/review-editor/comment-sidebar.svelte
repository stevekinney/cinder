<script lang="ts" module>
  import type { Thread } from '../../comments/index.ts';
  import type {
    DiffReviewAction,
    DiffReviewComment,
    DiffReviewState,
  } from '../../diff-review-state/index.ts';

  type ThreadSelectionOptions = {
    openPopover?: boolean;
  };

  export type CommentSidebarProps = {
    /** Unique ID for accessibility */
    id: string;
    /** Comment threads to display */
    threads: Thread[];
    /** Currently active/selected thread */
    activeThreadId?: string | null;
    /** Whether the sidebar is read-only */
    readonly?: boolean;
    /** Callback when a thread is selected */
    onthreadselect?: (threadId: string, options?: ThreadSelectionOptions) => void;
    /** Callback when all threads should be cleared */
    onclearall?: () => void;
    /** Callback when one thread should be removed */
    onThreadDelete?: (threadId: string) => void;
    /** Callback when user submits a document-level comment */
    onadddocumentcomment?: (body: string) => void;
    /**
     * ReviewEditor's opt-in diff-review session (COR-512 / DR-7). Absent by default -- when
     * undefined, this renders exactly as before: no diff rows, same DOM. When supplied, every
     * saved diff comment renders as one more row in this SAME list, alongside the document
     * threads above, each carrying `data-anchor-kind="diff"` and its own side/file badge so the
     * two anchor domains stay visually and structurally distinguished within the one list.
     */
    diffReviewState?: DiffReviewState | undefined;
    /** Activated by a CURRENT diff comment's "Go to diff" action; never for outdated/removed
     * (see `diff-review-comment-item.svelte`'s identical rule) -- those focus their own captured
     * detail in place instead. */
    onDiffCommentNavigate?: (comment: DiffReviewComment) => void;
    /** Dispatches a diff-review mutation (delete/resolve/reopen) from this list. Delete is only
     * ever called after this component's own explicit inline confirmation -- never on the bare
     * click of the row's Delete button (contract, Experience: "Deleting a new diff comment
     * removes it from state and subsequent exports after an explicit confirmation"). */
    onDiffCommentAction?: (action: DiffReviewAction) => void;
    /** Additional CSS class */
    class?: string;
  };
</script>

<script lang="ts">
  import { tick } from 'svelte';
  import { classNames } from '../../utilities/class-names.ts';
  import { truncate } from '../../utilities/truncate.ts';
  import {
    FileText,
    MessageSquare,
    MoreHorizontal,
    Plus,
    Trash2,
    X,
    Button,
    InlineConfirm,
    Dropdown,
    DropdownTrigger,
    DropdownMenu,
    DropdownItem,
  } from '@lostgradient/cinder';

  import { getVisibleComments, isDocumentAnchor } from '../../comments/index.ts';
  import { classifyDiffReviewAnchorStatus } from '../diff-review/diff-review-anchor-status.ts';
  import { formatDiffReviewCommentLocation } from '../diff-review-comments/diff-review-comment-location.ts';
  import CommentComposer from './comment-composer.svelte';

  let {
    id,
    threads,
    activeThreadId = null,
    readonly = false,
    onthreadselect,
    onclearall,
    onThreadDelete,
    onadddocumentcomment,
    diffReviewState,
    onDiffCommentNavigate,
    onDiffCommentAction,
    class: className,
  }: CommentSidebarProps = $props();

  let showConfirmClear = $state(false);
  const actionsTriggerId = $derived(`${id}-actions-trigger`);
  const documentCommentTriggerId = $derived(`${id}-add-comment`);

  /** Whether the user is composing a new document-level comment */
  let composingDocumentComment = $state(false);

  /** Handle starting document comment composition */
  function handleStartDocumentComment(): void {
    composingDocumentComment = true;
  }

  /** Handle canceling document comment composition */
  function handleCancelDocumentComment(): void {
    composingDocumentComment = false;
  }

  /** Handle submitting a document comment */
  function handleSubmitDocumentComment(body: string): void {
    onadddocumentcomment?.(body);
    composingDocumentComment = false;
  }

  /** Get threads with visible comments, separated into document and text threads */
  const { documentThreads, textThreads } = $derived.by(() => {
    const visible = threads.filter((thread) => getVisibleComments(thread).length > 0);

    const docThreads = visible.filter((thread) => isDocumentAnchor(thread.anchor));
    const txtThreads = visible
      .filter((thread) => !isDocumentAnchor(thread.anchor))
      .slice()
      .sort((a, b) => {
        const posA = a.anchor.from ?? a.anchor.originalPosition?.offset ?? 0;
        const posB = b.anchor.from ?? b.anchor.originalPosition?.offset ?? 0;
        return posA - posB;
      });

    return { documentThreads: docThreads, textThreads: txtThreads };
  });

  /** All visible threads (for count and clear all) */
  const visibleThreads = $derived([...documentThreads, ...textThreads]);

  /** Every saved diff comment (COR-512 / DR-7), rendered as a third group in this same list.
   * `undefined` when the host has not enabled diff review -- see the prop doc. */
  const diffComments = $derived(diffReviewState?.comments ?? []);
  const totalCommentCount = $derived(visibleThreads.length + diffComments.length);

  function diffCommentKindLabel(comment: DiffReviewComment): string {
    return comment.anchor.kind === 'file' ? 'Diff · file' : `Diff · ${comment.anchor.side}`;
  }

  /** Mirrors `DiffReviewCommentItem`'s own `goTo` rule: only a CURRENT comment navigates the
   * diff viewer. An outdated/removed comment instead moves DOM focus to its own captured-detail
   * text, rendered in place below -- never suggesting a current anchor for a stale one. */
  function handleDiffCommentGoTo(comment: DiffReviewComment, capturedDetailId: string): void {
    if (!diffReviewState) return;
    const status = classifyDiffReviewAnchorStatus(diffReviewState, comment);
    if (status === 'current') {
      onDiffCommentNavigate?.(comment);
      return;
    }
    document.getElementById(capturedDetailId)?.focus();
  }

  /**
   * Explicit confirmation before deleting a diff comment (contract, Experience: "Deleting a new
   * diff comment removes it from state and subsequent exports after an explicit confirmation").
   * This merged list is a separate implementation from `diff-review-comment-item.svelte` (which
   * already gates its own delete behind a `ConfirmDialog`), so it independently needs this same
   * guard rather than dispatching on a bare click. Tracks at most one row at a time, mirroring
   * this file's own single-flight `showConfirmClear` pattern for "Clear all".
   */
  let confirmingDeleteDiffCommentId = $state<string | null>(null);

  function requestDiffCommentDelete(commentId: string): void {
    confirmingDeleteDiffCommentId = commentId;
  }

  function confirmDiffCommentDelete(commentId: string): void {
    confirmingDeleteDiffCommentId = null;
    onDiffCommentAction?.({ type: 'delete-comment', id: commentId });
  }

  function cancelDiffCommentDelete(): void {
    confirmingDeleteDiffCommentId = null;
  }

  /** Get the first visible comment's body for preview */
  function getPreview(thread: Thread): string {
    const comments = getVisibleComments(thread);
    const firstComment = comments[0];
    if (!firstComment) return '';
    return truncate(firstComment.body, 80);
  }

  function handleThreadClick(threadId: string) {
    onthreadselect?.(threadId);
  }

  function getThreadLabel(thread: Thread): string {
    return isDocumentAnchor(thread.anchor) ? 'Document comment' : thread.anchor.quote;
  }

  async function handleThreadDelete(threadId: string): Promise<void> {
    const displayedIndex = visibleThreads.findIndex((thread) => thread.id === threadId);
    const selectedThreadId = activeThreadId;
    onThreadDelete?.(threadId);
    await tick();

    if (visibleThreads.some((thread) => thread.id === threadId)) {
      if (selectedThreadId && visibleThreads.some((thread) => thread.id === selectedThreadId)) {
        onthreadselect?.(selectedThreadId, { openPopover: false });
        await tick();
      }
      document.getElementById(`${id}-thread-remove-${threadId}`)?.focus();
      return;
    }

    const nextThread = visibleThreads[displayedIndex] ?? visibleThreads[displayedIndex - 1];
    if (nextThread) {
      onthreadselect?.(nextThread.id, { openPopover: false });
      await tick();
      document.getElementById(`${id}-thread-open-${nextThread.id}`)?.focus();
      return;
    }

    document.getElementById(documentCommentTriggerId)?.focus();
  }

  function handleClearAllClick() {
    showConfirmClear = true;
  }

  async function restoreActionsFocus(): Promise<void> {
    await tick();
    const actionsTrigger = document.getElementById(actionsTriggerId) as HTMLButtonElement | null;
    if (actionsTrigger && !actionsTrigger.disabled) {
      actionsTrigger.focus();
      return;
    }
    document.getElementById(documentCommentTriggerId)?.focus();
  }

  function handleConfirmClear() {
    onclearall?.();
    showConfirmClear = false;
    void restoreActionsFocus();
  }

  function handleCancelClear() {
    showConfirmClear = false;
    void restoreActionsFocus();
  }
</script>

<aside {id} class={classNames('comment-sidebar', className)} aria-label="Comment threads">
  <div class="sidebar-header">
    <div class="sidebar-label-group">
      <MessageSquare class="cinder-icon-sm" />
      <h2 class="sidebar-title">Comments</h2>
      <span class="thread-count">{totalCommentCount}</span>
    </div>

    {#if !readonly}
      <div class="sidebar-action-group">
        <Button
          id={documentCommentTriggerId}
          variant="ghost"
          size="xs"
          aria-label={composingDocumentComment ? 'Cancel document comment' : 'Add document comment'}
          title={composingDocumentComment
            ? 'Cancel adding document comment'
            : 'Add comment about the entire document'}
          onclick={composingDocumentComment
            ? handleCancelDocumentComment
            : handleStartDocumentComment}
        >
          {#if composingDocumentComment}
            <X class="cinder-icon-sm" />
          {:else}
            <Plus class="cinder-icon-sm" />
          {/if}
        </Button>

        {#key visibleThreads.length > 0}
          <Dropdown id="{id}-actions">
            <DropdownTrigger
              id={actionsTriggerId}
              class="actions-trigger"
              aria-label="Comment actions"
              caretVisible={false}
              disabled={visibleThreads.length === 0}
            >
              <MoreHorizontal class="cinder-icon-sm" />
            </DropdownTrigger>
            <DropdownMenu>
              <DropdownItem
                variant="danger"
                onclick={handleClearAllClick}
                disabled={visibleThreads.length === 0}
              >
                <Trash2 class="cinder-icon-sm" />
                Clear all comments
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        {/key}
      </div>
    {/if}
  </div>

  <!-- Confirmation banner for clear all -->
  <InlineConfirm
    prompt="Delete all {visibleThreads.length} comment threads?"
    confirmLabel="Delete All"
    destructive
    bind:open={showConfirmClear}
    onConfirm={handleConfirmClear}
    onCancel={handleCancelClear}
  />

  <!-- Document comment composer -->
  {#if composingDocumentComment}
    <div class="document-comment-composer">
      <div class="document-comment-header">
        <FileText class="cinder-icon-xs" />
        <span>Document comment</span>
      </div>
      <CommentComposer
        id="{id}-document-composer"
        placeholder="Add a comment about the entire document..."
        onsubmit={handleSubmitDocumentComment}
        oncancel={handleCancelDocumentComment}
      />
    </div>
  {/if}

  <div class="thread-list" role="list" aria-label="Comment threads">
    {#if totalCommentCount === 0}
      <div class="empty-state">
        <p class="empty-message">No comments yet</p>
        <p class="empty-hint">Select text or click + to add a comment</p>
      </div>
    {:else}
      <!-- Document-level comments first -->
      {#each documentThreads as thread (thread.id)}
        <div class="thread-row" role="listitem">
          <button
            id="{id}-thread-open-{thread.id}"
            type="button"
            class="thread-item"
            data-document="true"
            data-active={activeThreadId === thread.id || undefined}
            onclick={() => handleThreadClick(thread.id)}
            aria-current={activeThreadId === thread.id ? 'true' : undefined}
            aria-label="Open comment thread: {getThreadLabel(thread)}"
          >
            <div class="thread-document-label">
              <FileText class="cinder-icon-xs" />
              <span>Document comment</span>
            </div>
            <p class="thread-preview">{getPreview(thread)}</p>
          </button>
          {#if !readonly}
            <Button
              id="{id}-thread-remove-{thread.id}"
              class="thread-remove"
              variant="ghost"
              size="xs"
              aria-label="Remove comment thread: {getThreadLabel(thread)}"
              onclick={() => void handleThreadDelete(thread.id)}
            >
              <Trash2 class="cinder-icon-sm" />
            </Button>
          {/if}
        </div>
      {/each}

      <!-- Text-anchored comments -->
      {#each textThreads as thread (thread.id)}
        <div class="thread-row" role="listitem">
          <button
            id="{id}-thread-open-{thread.id}"
            type="button"
            class="thread-item"
            data-active={activeThreadId === thread.id || undefined}
            data-orphaned={thread.anchor.status === 'orphaned' || undefined}
            onclick={() => handleThreadClick(thread.id)}
            aria-current={activeThreadId === thread.id ? 'true' : undefined}
            aria-label="Open comment thread: {getThreadLabel(thread)}"
          >
            <blockquote class="thread-quote">
              {truncate(thread.anchor.quote, 60)}
            </blockquote>
            <!--
              An orphaned thread's quote is not in the document, so it has no
              highlight to jump to. Saying so is the difference between a comment
              that looks broken and one the reader knows is waiting for its text
              to come back — the text often does, since a cut-and-paste orphans an
              anchor until the paste lands (cinder#1284).
            -->
            {#if thread.anchor.status === 'orphaned'}
              <p class="thread-orphaned">Quoted text is not in the document</p>
            {/if}
            <p class="thread-preview">{getPreview(thread)}</p>
          </button>
          {#if !readonly}
            <Button
              id="{id}-thread-remove-{thread.id}"
              class="thread-remove"
              variant="ghost"
              size="xs"
              aria-label="Remove comment thread: {getThreadLabel(thread)}"
              onclick={() => void handleThreadDelete(thread.id)}
            >
              <Trash2 class="cinder-icon-sm" />
            </Button>
          {/if}
        </div>
      {/each}

      <!-- Diff comments (COR-512 / DR-7): a third group in this same list, distinguished from
           the document threads above by `data-anchor-kind="diff"` and their own side/file badge. -->
      {#each diffComments as comment (comment.id)}
        {@const status = diffReviewState
          ? classifyDiffReviewAnchorStatus(diffReviewState, comment)
          : 'removed'}
        {@const capturedDetailId = `${id}-diff-comment-detail-${comment.id}`}
        <div class="thread-row" role="listitem" data-anchor-kind="diff" data-diff-status={status}>
          <button
            type="button"
            class="thread-item"
            data-diff-comment="true"
            onclick={() => handleDiffCommentGoTo(comment, capturedDetailId)}
            aria-label="Go to diff comment: {formatDiffReviewCommentLocation(comment)}"
          >
            <div class="thread-document-label">
              <span class="diff-comment-kind-badge">{diffCommentKindLabel(comment)}</span>
              {#if comment.resolved}
                <span class="diff-comment-status-badge diff-comment-status-resolved">Resolved</span>
              {/if}
              {#if status === 'removed'}
                <span class="diff-comment-status-badge diff-comment-status-outdated">Removed</span>
              {:else if status === 'outdated'}
                <span class="diff-comment-status-badge diff-comment-status-outdated">Outdated</span>
              {/if}
            </div>
            <p class="thread-preview">{formatDiffReviewCommentLocation(comment)}</p>
            <p class="thread-preview">{truncate(comment.body, 80)}</p>
          </button>
          {#if status !== 'current'}
            <p id={capturedDetailId} class="diff-comment-captured-detail" tabindex="-1">
              {status === 'removed' ? 'Originally at' : 'Captured at'}:
              {formatDiffReviewCommentLocation(comment)}
            </p>
          {/if}
          {#if !readonly}
            <div class="diff-comment-row-actions">
              {#if comment.resolved}
                <Button
                  variant="ghost"
                  size="xs"
                  onclick={() => onDiffCommentAction?.({ type: 'reopen-comment', id: comment.id })}
                >
                  Reopen
                </Button>
              {:else}
                <Button
                  variant="ghost"
                  size="xs"
                  onclick={() => onDiffCommentAction?.({ type: 'resolve-comment', id: comment.id })}
                >
                  Resolve
                </Button>
              {/if}
              <Button
                class="thread-remove"
                variant="ghost"
                size="xs"
                aria-label="Delete diff comment: {formatDiffReviewCommentLocation(comment)}"
                onclick={() => requestDiffCommentDelete(comment.id)}
              >
                <Trash2 class="cinder-icon-sm" />
              </Button>
            </div>
            <InlineConfirm
              prompt="Delete this comment?"
              confirmLabel="Delete"
              destructive
              open={confirmingDeleteDiffCommentId === comment.id}
              onConfirm={() => confirmDiffCommentDelete(comment.id)}
              onCancel={cancelDiffCommentDelete}
            />
          {/if}
        </div>
      {/each}
    {/if}
  </div>
</aside>

<style>
  .comment-sidebar {
    container-type: inline-size;
    display: flex;
    flex-direction: column;
    width: 280px;
    min-width: 200px;
    max-width: 400px;
    height: 100%;
    background: var(--cinder-surface-raised);
    border-inline-start: 1px solid var(--cinder-border);
    overflow: hidden;
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    gap: var(--cinder-space-3);
    padding: var(--cinder-space-3);
    border-bottom: 1px solid var(--cinder-border-muted);
    color: var(--cinder-text-muted);
  }

  .sidebar-label-group {
    display: flex;
    align-items: center;
    gap: var(--cinder-space-1);
    min-width: 0;
  }

  .sidebar-title {
    font-size: var(--cinder-text-sm);
    font-weight: var(--cinder-font-medium);
    color: var(--cinder-text-default);
    margin: 0;
  }

  .sidebar-action-group {
    display: flex;
    align-items: center;
    gap: var(--cinder-space-1);
    margin-inline-start: auto;
  }

  .thread-count {
    font-size: var(--cinder-text-xs);
    font-weight: var(--cinder-font-medium);
    color: var(--cinder-text-muted);
    background: var(--cinder-surface);
    padding: var(--cinder-space-0-5) var(--cinder-space-2);
    border-radius: var(--cinder-radius-full);
  }

  /* Style the dropdown trigger to match ghost button xs */
  .sidebar-header :global(.actions-trigger) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: var(--cinder-space-1);
    min-height: 1.5rem;
    min-width: 1.5rem;
    border: none;
    background: transparent;
    color: var(--cinder-text-muted);
    border-radius: var(--cinder-radius-md);
    cursor: pointer;
    transition:
      background var(--cinder-duration-fast) var(--cinder-ease-standard),
      color var(--cinder-duration-fast) var(--cinder-ease-standard);
  }

  @media (hover: hover) {
    .sidebar-header :global(.actions-trigger:hover) {
      background: var(--cinder-surface-hover);
      color: var(--cinder-text-default);
    }
  }

  .sidebar-header :global(.actions-trigger:focus-visible) {
    outline: var(--cinder-ring-width) solid transparent;
    box-shadow: var(--_cinder-focus-ring-shadow);
  }

  @media (forced-colors: active) {
    .sidebar-header :global(.actions-trigger:focus-visible) {
      outline: var(--cinder-ring-width) solid ButtonText;
      outline-offset: 3px;
    }
  }

  /* Document comment composer */
  .document-comment-composer {
    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-2);
    padding: var(--cinder-space-3);
    background: color-mix(in oklch, var(--cinder-accent-solid), transparent 95%);
    border-bottom: 1px solid color-mix(in oklch, var(--cinder-accent-solid), transparent 80%);
  }

  .document-comment-header {
    display: inline-flex;
    align-items: center;
    gap: var(--cinder-space-1);
    font-size: var(--cinder-text-xs);
    font-weight: var(--cinder-font-medium);
    color: var(--cinder-accent-text);
  }

  .thread-list {
    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-2);
    flex: 1;
    overflow-y: auto;
    padding: var(--cinder-space-2);
  }

  .thread-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: stretch;
    gap: var(--cinder-space-1);
  }

  .thread-item {
    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-1);
    width: 100%;
    padding: var(--cinder-space-3);
    background: var(--cinder-surface);
    border: 1px solid var(--cinder-border-muted);
    border-radius: var(--cinder-radius-md);
    cursor: pointer;
    text-align: left;
    transition:
      background var(--cinder-duration-fast) var(--cinder-ease-standard),
      border-color var(--cinder-duration-fast) var(--cinder-ease-standard);
  }

  @media (hover: hover) {
    .thread-item:hover {
      background: var(--cinder-surface-hover);
      border-color: var(--cinder-border);
    }
  }

  /* Thread items are full-bleed rows in the scrollable sidebar list; an outset
     ring is clipped at the row edges, so paint an INSET ring (Strategy B-inset). */
  .thread-item:focus-visible {
    outline: var(--cinder-ring-width) solid transparent;
    box-shadow: inset 0 0 0 var(--cinder-ring-width)
      var(--_cinder-thread-item-ring, var(--cinder-ring-color));
  }

  @media (forced-colors: active) {
    .thread-item:focus-visible {
      outline: var(--cinder-ring-width) solid ButtonText;
      outline-offset: calc(var(--cinder-ring-width) * -1);
    }
  }

  .thread-item[data-active] {
    background: color-mix(in oklch, var(--cinder-accent-solid), transparent 90%);
    border-color: var(--cinder-accent-solid);
  }

  .thread-orphaned {
    margin: var(--cinder-space-1) 0 0;
    font-size: var(--cinder-text-xs);
    color: var(--cinder-text-muted);
    font-style: italic;
  }

  .thread-item[data-orphaned] .thread-quote {
    opacity: 0.7;
    text-decoration: line-through;
  }

  .thread-quote {
    font-size: var(--cinder-text-xs);
    font-style: italic;
    color: var(--cinder-text-subtle);
    margin: 0;
    padding-inline-start: var(--cinder-space-2);
    border-inline-start: 2px solid var(--cinder-border);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .thread-preview {
    font-size: var(--cinder-text-sm);
    color: var(--cinder-text-default);
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .diff-comment-kind-badge {
    font-size: var(--cinder-text-xs);
    font-weight: var(--cinder-font-medium);
    color: var(--cinder-text-muted, #666);
  }

  .diff-comment-status-badge {
    border-radius: var(--cinder-radius-sm, 4px);
    padding: 0 0.375rem;
    font-size: var(--cinder-text-xs);
  }

  .diff-comment-status-resolved {
    background: var(--cinder-status-success-subtle, #e6f4ea);
    color: var(--cinder-status-success-solid, #1a7f37);
  }

  .diff-comment-status-outdated {
    background: var(--cinder-status-warning-subtle, #fff4e5);
    color: var(--cinder-status-warning-solid, #9a6700);
  }

  .diff-comment-captured-detail {
    margin: 0 var(--cinder-space-3, 0.75rem) var(--cinder-space-2, 0.5rem);
    font-size: var(--cinder-text-xs);
    color: var(--cinder-text-muted, #666);
  }

  .diff-comment-row-actions {
    display: flex;
    gap: var(--cinder-space-1);
    padding-inline-end: var(--cinder-space-2, 0.5rem);
  }

  .thread-document-label {
    display: inline-flex;
    align-items: center;
    gap: var(--cinder-space-1);
    font-size: var(--cinder-text-xs);
    font-weight: var(--cinder-font-medium);
    color: var(--cinder-accent-text);
    padding: var(--cinder-space-0-5) var(--cinder-space-1-5);
    background: color-mix(in oklch, var(--cinder-accent-solid), transparent 90%);
    border-radius: var(--cinder-radius-sm);
    width: fit-content;
  }

  .thread-item[data-document='true'] {
    border-inline-start: 2px solid var(--cinder-accent-solid);
  }

  .thread-row :global(.thread-remove) {
    align-self: start;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--cinder-space-6);
    text-align: center;
  }

  .empty-message {
    font-size: var(--cinder-text-sm);
    font-weight: var(--cinder-font-medium);
    color: var(--cinder-text-muted);
    margin: 0 0 var(--cinder-space-1);
  }

  .empty-hint {
    font-size: var(--cinder-text-xs);
    color: var(--cinder-text-disabled);
    margin: 0;
  }

  /* Container query: compact mode for narrow containers */
  @container (max-width: 220px) {
    .sidebar-header {
      padding: var(--cinder-space-2);
    }

    .sidebar-title {
      font-size: var(--cinder-text-xs);
    }

    .thread-item {
      padding: var(--cinder-space-2);
    }

    .thread-quote {
      display: none;
    }

    .thread-preview {
      font-size: var(--cinder-text-xs);
      -webkit-line-clamp: 1;
      line-clamp: 1;
    }

    .empty-hint {
      display: none;
    }
  }
</style>
