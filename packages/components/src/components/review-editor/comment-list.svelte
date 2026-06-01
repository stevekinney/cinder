<script lang="ts" module>
  import type { Comment } from 'cinder/commentary/comments';
  import type { ReviewMode } from './review-editor-types.ts';

  export type CommentListProps = {
    /** Comments to display */
    comments: Comment[];
    /** Current user ID (for determining edit/delete permissions) */
    currentUserId?: string | undefined;
    /** Editor mode (affects available actions) */
    mode?: ReviewMode;
    /** Additional CSS class */
    class?: string;
    /** Called when a comment is updated */
    onupdate?: (commentId: string, body: string) => void;
    /** Called when a comment is deleted */
    ondelete?: (commentId: string) => void;
  };
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import { formatRelativeTime } from '../../utilities/format-date.ts';
  import Button from '../button/button.svelte';
  import Pencil from 'lucide-svelte/icons/pencil';
  import Trash2 from 'lucide-svelte/icons/trash-2';

  let {
    comments,
    currentUserId,
    mode = 'edit',
    class: className,
    onupdate,
    ondelete,
  }: CommentListProps = $props();

  // Filter out soft-deleted comments
  const visibleComments = $derived(comments.filter((c) => !('deletedAt' in c) || !c.deletedAt));

  // Track which comment is being edited
  let editingCommentId = $state<string | null>(null);
  let editingBody = $state('');

  function startEdit(comment: Comment) {
    editingCommentId = comment.id;
    editingBody = comment.body;
  }

  function cancelEdit() {
    editingCommentId = null;
    editingBody = '';
  }

  function saveEdit(commentId: string) {
    if (editingBody.trim()) {
      onupdate?.(commentId, editingBody.trim());
    }
    cancelEdit();
  }

  function handleEditKeyDown(event: KeyboardEvent, commentId: string) {
    if (event.key === 'Escape') {
      cancelEdit();
    } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      saveEdit(commentId);
    }
  }

  function canEditComment(comment: Comment): boolean {
    return mode !== 'readonly' && comment.authorId === currentUserId;
  }

  function canDeleteComment(comment: Comment): boolean {
    return mode !== 'readonly' && comment.authorId === currentUserId;
  }
</script>

<div class={classNames('comment-list', className)}>
  {#each visibleComments as comment (comment.id)}
    <article class="comment" data-comment-id={comment.id}>
      <header class="comment-header">
        <div class="comment-author">
          <div class="comment-avatar" aria-hidden="true">
            {comment.authorId.charAt(0).toUpperCase()}
          </div>
          <span class="comment-author-name">{comment.authorId}</span>
        </div>
        <div class="comment-meta">
          <time class="comment-time" datetime={comment.createdAt} title={comment.createdAt}>
            {formatRelativeTime(comment.createdAt)}
          </time>
          {#if 'editedAt' in comment && comment.editedAt}
            <span class="comment-edited" title={`Edited ${comment.editedAt}`}>(edited)</span>
          {/if}
        </div>
      </header>

      {#if editingCommentId === comment.id}
        <div class="comment-edit">
          <label for="{comment.id}-edit" class="sr-only">Edit comment</label>
          <textarea
            id="{comment.id}-edit"
            class="comment-edit-textarea"
            bind:value={editingBody}
            onkeydown={(e) => handleEditKeyDown(e, comment.id)}
            rows={3}
          ></textarea>
          <div class="comment-edit-actions">
            <Button variant="ghost" size="xs" onclick={cancelEdit}>Cancel</Button>
            <Button
              variant="primary"
              size="xs"
              onclick={() => saveEdit(comment.id)}
              disabled={!editingBody.trim()}
            >
              Save
            </Button>
          </div>
        </div>
      {:else}
        <div class="comment-body">
          {comment.body}
        </div>
      {/if}

      {#if mode !== 'readonly' && editingCommentId !== comment.id}
        <div class="comment-actions">
          {#if canEditComment(comment)}
            <button
              type="button"
              class="comment-action"
              onclick={() => startEdit(comment)}
              aria-label="Edit comment"
              title="Edit comment"
            >
              <Pencil class="icon-sm" />
            </button>
          {/if}
          {#if canDeleteComment(comment)}
            <button
              type="button"
              class="comment-action comment-action-danger"
              onclick={() => ondelete?.(comment.id)}
              aria-label="Delete comment"
              title="Delete comment"
            >
              <Trash2 class="icon-sm" />
            </button>
          {/if}
        </div>
      {/if}
    </article>
  {/each}

  {#if visibleComments.length === 0}
    <p class="comment-list-empty">No comments yet.</p>
  {/if}
</div>

<style>
  .comment-list {
    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-4);
  }

  .comment {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-2);
    padding: var(--cinder-space-3);
    background: var(--cinder-surface);
    border: 1px solid var(--cinder-border-muted);
    border-radius: var(--cinder-radius-md);
  }

  .comment:hover .comment-actions {
    opacity: 1;
  }

  .comment-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--cinder-space-2);
  }

  .comment-author {
    display: flex;
    align-items: center;
    gap: var(--cinder-space-2);
  }

  .comment-avatar {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    font-size: var(--cinder-text-xs);
    font-weight: var(--cinder-font-medium);
    color: var(--cinder-accent-contrast);
    background: var(--cinder-accent);
    border-radius: var(--cinder-radius-full);
  }

  .comment-author-name {
    font-size: var(--cinder-text-sm);
    font-weight: var(--cinder-font-medium);
    color: var(--cinder-text);
  }

  .comment-meta {
    display: flex;
    align-items: center;
    gap: var(--cinder-space-1);
  }

  .comment-time {
    font-size: var(--cinder-text-xs);
    color: var(--cinder-text-subtle);
  }

  .comment-edited {
    font-size: var(--cinder-text-xs);
    color: var(--cinder-text-subtle);
    font-style: italic;
  }

  .comment-body {
    font-size: var(--cinder-text-sm);
    line-height: var(--cinder-leading-relaxed);
    color: var(--cinder-text);
    white-space: pre-wrap;
    word-break: break-word;
  }

  .comment-edit {
    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-2);
  }

  .comment-edit-textarea {
    width: 100%;
    min-height: 4rem;
    padding: var(--cinder-space-2);
    font-family: inherit;
    font-size: var(--cinder-text-sm);
    line-height: var(--cinder-leading-normal);
    color: var(--cinder-text);
    background: var(--cinder-surface);
    border: 1px solid var(--cinder-border);
    border-radius: var(--cinder-radius-md);
    resize: vertical;
  }

  .comment-edit-textarea:focus {
    outline: none;
    border-color: var(--cinder-accent);
  }

  .comment-edit-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--cinder-space-2);
  }

  .comment-actions {
    position: absolute;
    top: var(--cinder-space-2);
    right: var(--cinder-space-2);
    display: flex;
    gap: var(--cinder-space-1);
    opacity: 0;
    transition: opacity var(--cinder-duration-fast) var(--cinder-ease-standard);
  }

  .comment:focus-within .comment-actions {
    opacity: 1;
  }

  .comment-action {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    color: var(--cinder-text-muted);
    background: var(--cinder-surface-raised);
    border: 1px solid var(--cinder-border);
    border-radius: var(--cinder-radius-sm);
    cursor: pointer;
    transition:
      background-color var(--cinder-duration-fast) var(--cinder-ease-standard),
      color var(--cinder-duration-fast) var(--cinder-ease-standard);
  }

  @media (hover: hover) {
    .comment-action:hover {
      color: var(--cinder-text);
      background: var(--cinder-surface-hover);
    }

    .comment-action-danger:hover {
      color: var(--cinder-color-danger-fg);
      background: var(--cinder-color-danger-bg);
      border-color: var(--cinder-color-danger-border);
    }
  }

  .comment-list-empty {
    font-size: var(--cinder-text-sm);
    color: var(--cinder-text-subtle);
    text-align: center;
    padding: var(--cinder-space-4);
  }

  /* Screen reader only utility */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
