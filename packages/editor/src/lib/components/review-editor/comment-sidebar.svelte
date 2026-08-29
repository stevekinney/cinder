<script lang="ts" module>
  import type { Thread } from '../../comments/index.ts';

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
    onthreadselect?: (threadId: string) => void;
    /** Callback when all threads should be cleared */
    onclearall?: () => void;
    /** Callback when user submits a document-level comment */
    onadddocumentcomment?: (body: string) => void;
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
  } from '@lostgradient/cinder/icons';

  import { getVisibleComments, isDocumentAnchor } from '../../comments/index.ts';
  import Button from '@lostgradient/cinder/button';
  import InlineConfirm from '@lostgradient/cinder/inline-confirm';
  import Dropdown from '@lostgradient/cinder/dropdown';
  import DropdownTrigger from '@lostgradient/cinder/dropdown-trigger';
  import DropdownMenu from '@lostgradient/cinder/dropdown-menu';
  import DropdownItem from '@lostgradient/cinder/dropdown-item';
  import CommentComposer from './comment-composer.svelte';

  let {
    id,
    threads,
    activeThreadId = null,
    readonly = false,
    onthreadselect,
    onclearall,
    onadddocumentcomment,
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
      .sort((a, b) => {
        const posA = a.anchor.from ?? a.anchor.originalPosition?.offset ?? 0;
        const posB = b.anchor.from ?? b.anchor.originalPosition?.offset ?? 0;
        return posA - posB;
      });

    return { documentThreads: docThreads, textThreads: txtThreads };
  });

  /** All visible threads (for count and clear all) */
  const visibleThreads = $derived([...documentThreads, ...textThreads]);

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
    <MessageSquare class="cinder-icon-sm" />
    <h2 class="sidebar-title">Comments</h2>
    <span class="thread-count">{visibleThreads.length}</span>

    {#if !readonly}
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
    {/if}

    {#if !readonly}
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

  <div class="thread-list">
    {#if visibleThreads.length === 0}
      <div class="empty-state">
        <p class="empty-message">No comments yet</p>
        <p class="empty-hint">Select text or click + to add a comment</p>
      </div>
    {:else}
      <!-- Document-level comments first -->
      {#each documentThreads as thread (thread.id)}
        <button
          type="button"
          class="thread-item"
          data-document="true"
          data-active={activeThreadId === thread.id || undefined}
          onclick={() => handleThreadClick(thread.id)}
          aria-current={activeThreadId === thread.id ? 'true' : undefined}
        >
          <div class="thread-document-label">
            <FileText class="cinder-icon-xs" />
            <span>Document comment</span>
          </div>
          <p class="thread-preview">{getPreview(thread)}</p>
        </button>
      {/each}

      <!-- Text-anchored comments -->
      {#each textThreads as thread (thread.id)}
        <button
          type="button"
          class="thread-item"
          data-active={activeThreadId === thread.id || undefined}
          data-orphaned={thread.anchor.status === 'orphaned' || undefined}
          onclick={() => handleThreadClick(thread.id)}
          aria-current={activeThreadId === thread.id ? 'true' : undefined}
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
    gap: var(--cinder-space-2);
    padding: var(--cinder-space-3);
    border-bottom: 1px solid var(--cinder-border-muted);
    color: var(--cinder-text-muted);
  }

  .sidebar-title {
    flex: 1;
    font-size: var(--cinder-text-sm);
    font-weight: var(--cinder-font-medium);
    color: var(--cinder-text-default);
    margin: 0;
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
    flex: 1;
    overflow-y: auto;
    padding: var(--cinder-space-2);
  }

  .thread-item {
    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-1);
    width: 100%;
    padding: var(--cinder-space-3);
    margin-bottom: var(--cinder-space-2);
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
