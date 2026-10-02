<script lang="ts" module>
  import type { DiffReviewComment } from '../../diff-review-state/index.ts';
  import type { DiffReviewAnchorStatus } from '../diff-review/diff-review-anchor-status.ts';

  export interface DiffReviewCommentItemProps {
    comment: DiffReviewComment;
    status: DiffReviewAnchorStatus;
    readonly?: boolean;
    onedit: (id: string, body: string) => void;
    ondelete: (id: string) => void;
    onresolve: (id: string) => void;
    onreopen: (id: string) => void;
    /**
     * Activated by the "Go to" action for every status. The parent only
     * forwards this to the host for a `current` comment -- for `outdated`/
     * `removed`, this component instead moves DOM focus to its own
     * captured-detail text and never calls it, so the diff is never focused
     * for a stale or gone anchor.
     */
    onnavigate: () => void;
  }
</script>

<script lang="ts">
  import { untrack } from 'svelte';

  import { ConfirmDialog } from '@lostgradient/cinder';

  import { formatDiffReviewCommentLocation } from './diff-review-comment-location.ts';

  let {
    comment,
    status,
    readonly = false,
    onedit,
    ondelete,
    onresolve,
    onreopen,
    onnavigate,
  }: DiffReviewCommentItemProps = $props();

  let isEditing = $state(false);
  // Intentionally a one-time snapshot at mount: `startEdit` re-seeds it from
  // the live `comment.body` on every edit, so it never drifts stale.
  let draftBody = $state(untrack(() => comment.body));
  let confirmingDelete = $state(false);
  let capturedDetailElement = $state<HTMLElement | undefined>(undefined);

  function goTo(): void {
    if (status === 'current') {
      onnavigate();
      return;
    }
    // Outdated/removed: focus the captured detail in place. Never call
    // `onnavigate` -- the diff must never be focused for a stale anchor.
    capturedDetailElement?.focus();
  }

  function startEdit(): void {
    draftBody = comment.body;
    isEditing = true;
  }

  function cancelEdit(): void {
    isEditing = false;
  }

  function saveEdit(): void {
    if (draftBody.trim().length === 0) return;
    onedit(comment.id, draftBody);
    isEditing = false;
  }

  function requestDelete(): void {
    confirmingDelete = true;
  }

  function confirmDelete(): void {
    confirmingDelete = false;
    ondelete(comment.id);
  }

  const capturedDetailText = $derived(
    [
      comment.capturedContext.targetLabel,
      comment.capturedContext.newPath ?? comment.capturedContext.oldPath,
    ]
      .filter((part): part is string => Boolean(part))
      .join(' · '),
  );
</script>

<li
  class="diff-review-comment-item"
  data-outdated={comment.outdated}
  data-resolved={comment.resolved}
  data-anchor-status={status}
>
  <div class="diff-review-comment-item-meta">
    <span class="diff-review-comment-item-location">{formatDiffReviewCommentLocation(comment)}</span
    >
    {#if comment.resolved}
      <span class="diff-review-comment-item-badge diff-review-comment-item-badge-resolved"
        >Resolved</span
      >
    {/if}
    {#if status === 'removed'}
      <span class="diff-review-comment-item-badge diff-review-comment-item-badge-outdated"
        >Removed</span
      >
    {:else if status === 'outdated'}
      <span class="diff-review-comment-item-badge diff-review-comment-item-badge-outdated"
        >Outdated</span
      >
    {/if}
    <button type="button" class="diff-review-comment-item-goto" onclick={goTo}>Go to</button>
  </div>

  {#if status !== 'current'}
    <p
      class="diff-review-comment-item-captured-detail"
      tabindex="-1"
      bind:this={capturedDetailElement}
    >
      {status === 'removed' ? 'Originally at' : 'Captured at'}: {capturedDetailText}
    </p>
  {/if}

  {#if isEditing}
    <textarea
      class="diff-review-comment-item-textarea"
      aria-label="Edit comment"
      bind:value={draftBody}></textarea>
    <div class="diff-review-comment-item-actions">
      <button type="button" onclick={saveEdit} disabled={draftBody.trim().length === 0}>Save</button
      >
      <button type="button" onclick={cancelEdit}>Cancel</button>
    </div>
  {:else}
    <p class="diff-review-comment-item-body">{comment.body}</p>
    {#if !readonly}
      <div class="diff-review-comment-item-actions">
        <button type="button" onclick={startEdit}>Edit</button>
        {#if comment.resolved}
          <button type="button" onclick={() => onreopen(comment.id)}>Reopen</button>
        {:else}
          <button type="button" onclick={() => onresolve(comment.id)}>Resolve</button>
        {/if}
        <button type="button" class="diff-review-comment-item-delete" onclick={requestDelete}>
          Delete
        </button>
      </div>
    {/if}
  {/if}
</li>

<ConfirmDialog
  bind:open={confirmingDelete}
  title="Delete comment?"
  description="This removes the comment from the review and from every export. This cannot be undone."
  confirmLabel="Delete"
  destructive
  onConfirm={confirmDelete}
/>

<style>
  .diff-review-comment-item {
    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-1, 0.25rem);
    padding: var(--cinder-space-2, 0.5rem) 0;
    border-block-end: 1px solid var(--cinder-border-faint);
  }

  .diff-review-comment-item-meta {
    display: flex;
    align-items: center;
    gap: var(--cinder-space-2, 0.5rem);
    font-size: var(--cinder-text-xs, 0.75rem);
    color: var(--cinder-text-muted);
  }

  .diff-review-comment-item-goto {
    margin-inline-start: auto;
  }

  .diff-review-comment-item-captured-detail {
    margin: 0;
    font-size: var(--cinder-text-xs, 0.75rem);
    color: var(--cinder-text-muted);
  }

  .diff-review-comment-item-badge {
    border-radius: var(--cinder-radius-sm, 4px);
    padding: 0 0.375rem;
  }

  .diff-review-comment-item-badge-resolved {
    background: var(--cinder-status-success-subtle);
    color: var(--cinder-status-success-solid);
  }

  .diff-review-comment-item-badge-outdated {
    background: var(--cinder-status-warning-subtle);
    color: var(--cinder-status-warning-solid);
  }

  .diff-review-comment-item-body {
    white-space: pre-wrap;
    margin: 0;
  }

  .diff-review-comment-item-textarea {
    width: 100%;
    min-height: 4rem;
  }

  .diff-review-comment-item-actions {
    display: flex;
    gap: var(--cinder-space-2, 0.5rem);
  }
</style>
