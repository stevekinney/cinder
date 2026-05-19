<script lang="ts" module>
  import type { Thread } from '@cinder/commentary/comments';

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
  import { classNames } from '../../utilities/class-names.ts';
  import { truncate } from '../../utilities/truncate.ts';
  import { MessageSquare, MoreHorizontal, Trash2, Plus, FileText, X } from '../icons/index.ts';
  import { getVisibleComments, isDocumentAnchor } from '@cinder/commentary/comments';
  import Button from '../button/button.svelte';
  import Dropdown from '../dropdown.svelte';
  import DropdownTrigger from '../dropdown-trigger.svelte';
  import DropdownMenu from '../dropdown-menu.svelte';
  import DropdownItem from '../dropdown-item.svelte';
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

  function handleConfirmClear() {
    onclearall?.();
    showConfirmClear = false;
  }

  function handleCancelClear() {
    showConfirmClear = false;
  }
</script>

<aside {id} class={classNames('comment-sidebar', className)} aria-label="Comment threads">
  <div class="sidebar-header">
    <MessageSquare class="icon-sm" />
    <h2 class="sidebar-title">Comments</h2>
    <span class="thread-count">{visibleThreads.length}</span>

    {#if !readonly}
      <Button
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
          <X class="icon-sm" />
        {:else}
          <Plus class="icon-sm" />
        {/if}
      </Button>
    {/if}

    {#if !readonly && visibleThreads.length > 0}
      <Dropdown id="{id}-actions">
        <DropdownTrigger class="actions-trigger" aria-label="Comment actions" showCaret={false}>
          <MoreHorizontal class="icon-sm" />
        </DropdownTrigger>
        <DropdownMenu>
          <DropdownItem variant="danger" onclick={handleClearAllClick}>
            <Trash2 class="icon-sm" />
            Clear all comments
          </DropdownItem>
        </DropdownMenu>
      </Dropdown>
    {/if}
  </div>

  <!-- Confirmation banner for clear all -->
  {#if showConfirmClear}
    <div class="confirm-clear" role="alertdialog" aria-labelledby="{id}-confirm-title">
      <p id="{id}-confirm-title" class="confirm-message">
        Delete all {visibleThreads.length} comment threads?
      </p>
      <div class="confirm-actions">
        <Button variant="secondary" size="xs" onclick={handleCancelClear}>Cancel</Button>
        <Button variant="danger" size="xs" onclick={handleConfirmClear}>Delete All</Button>
      </div>
    </div>
  {/if}

  <!-- Document comment composer -->
  {#if composingDocumentComment}
    <div class="document-comment-composer">
      <div class="document-comment-header">
        <FileText class="icon-xs" />
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
            <FileText class="icon-xs" />
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
          onclick={() => handleThreadClick(thread.id)}
          aria-current={activeThreadId === thread.id ? 'true' : undefined}
        >
          <blockquote class="thread-quote">
            {truncate(thread.anchor.quote, 60)}
          </blockquote>
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
    color: var(--cinder-text);
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

  .sidebar-header :global(.actions-trigger:hover) {
    background: var(--cinder-surface-hover);
    color: var(--cinder-text);
  }

  .sidebar-header :global(.actions-trigger:focus-visible) {
    outline: 2px solid var(--cinder-accent);
    outline-offset: 2px;
  }

  /* Confirmation banner */
  .confirm-clear {
    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-2);
    padding: var(--cinder-space-3);
    background: color-mix(in oklch, var(--cinder-danger), transparent 90%);
    border-bottom: 1px solid color-mix(in oklch, var(--cinder-danger), transparent 70%);
  }

  .confirm-message {
    font-size: var(--cinder-text-sm);
    font-weight: var(--cinder-font-medium);
    color: var(--cinder-danger);
    margin: 0;
  }

  .confirm-actions {
    display: flex;
    gap: var(--cinder-space-2);
    justify-content: flex-end;
  }

  /* Document comment composer */
  .document-comment-composer {
    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-2);
    padding: var(--cinder-space-3);
    background: color-mix(in oklch, var(--cinder-accent), transparent 95%);
    border-bottom: 1px solid color-mix(in oklch, var(--cinder-accent), transparent 80%);
  }

  .document-comment-header {
    display: inline-flex;
    align-items: center;
    gap: var(--cinder-space-1);
    font-size: var(--cinder-text-xs);
    font-weight: var(--cinder-font-medium);
    color: var(--cinder-accent);
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

  .thread-item:hover {
    background: var(--cinder-surface-hover);
    border-color: var(--cinder-border);
  }

  .thread-item:focus-visible {
    outline: 2px solid var(--cinder-accent);
    outline-offset: -2px;
  }

  .thread-item[data-active] {
    background: color-mix(in oklch, var(--cinder-accent), transparent 90%);
    border-color: var(--cinder-accent);
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
    color: var(--cinder-text);
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
    color: var(--cinder-accent);
    padding: var(--cinder-space-0-5) var(--cinder-space-1-5);
    background: color-mix(in oklch, var(--cinder-accent), transparent 90%);
    border-radius: var(--cinder-radius-sm);
    width: fit-content;
  }

  .thread-item[data-document='true'] {
    border-inline-start: 2px solid var(--cinder-accent);
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
