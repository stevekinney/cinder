<script lang="ts" module>
  export const title = 'Basic selection popover';
  export const description = 'A positioned comment action that expands into a composer.';
</script>

<script lang="ts">
  import { SelectionPopover } from '../../../../components/src/index.ts';

  type Comment = { id: string; body: string };

  let comments = $state<Comment[]>([]);

  function addComment(body: string): void {
    comments = [...comments, { id: crypto.randomUUID(), body }];
  }
</script>

<div style="position: relative; min-height: 9rem;">
  <p style="max-width: 36rem; margin: 0;">
    Select text in a review editor and this control can appear near the selection. The playground
    keeps it pinned here so the interaction is easy to inspect.
  </p>

  <SelectionPopover
    id="playground-selection-popover"
    open
    position={{ x: 180, y: 96 }}
    oncommentsubmit={addComment}
  />

  {#if comments.length > 0}
    <section class="comments-section" aria-label="Submitted comments">
      <h3 class="comments-title">Submitted comments</h3>
      {#each comments as comment (comment.id)}
        <article class="comment-card">
          {comment.body}
        </article>
      {/each}
    </section>
  {/if}
</div>

<style>
  .comments-section {
    margin: 1rem 0 0;
  }

  .comments-title {
    margin: 0 0 0.5rem;
    font-size: var(--cinder-text-xs);
    font-weight: var(--cinder-font-medium);
    color: var(--cinder-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .comment-card {
    padding: 0.5rem 0.75rem;
    margin-bottom: 0.375rem;
    border: 1px solid var(--cinder-border-muted);
    border-radius: var(--cinder-radius-sm);
    background: var(--cinder-surface);
  }
</style>
