<script lang="ts" module>
  import type { DiffReviewDraft } from '../../diff-review-state/index.ts';

  export interface DiffReviewDraftsInventoryProps {
    drafts: DiffReviewDraft[];
    readonly?: boolean;
    onopen: (draft: DiffReviewDraft) => void;
    onsave: (draftId: string) => void;
    ondiscard: (draftId: string) => void;
  }
</script>

<script lang="ts">
  let {
    drafts,
    readonly = false,
    onopen,
    onsave,
    ondiscard,
  }: DiffReviewDraftsInventoryProps = $props();

  function isPending(draft: DiffReviewDraft): boolean {
    return draft.body.trim().length > 0;
  }
</script>

{#if drafts.length > 0}
  <section class="diff-review-drafts-inventory" aria-label="Unsaved drafts">
    <h3 class="diff-review-drafts-inventory-heading">
      Unsaved drafts ({drafts.filter(isPending).length})
    </h3>
    <ul class="diff-review-drafts-inventory-list">
      {#each drafts as draft (draft.draftId)}
        <li class="diff-review-drafts-inventory-item">
          <span class="diff-review-drafts-inventory-excerpt">
            {draft.body.trim().length > 0 ? draft.body : '(empty draft)'}
          </span>
          <div class="diff-review-drafts-inventory-actions">
            <button type="button" onclick={() => onopen(draft)}>Open</button>
            {#if !readonly}
              <button
                type="button"
                disabled={!isPending(draft)}
                onclick={() => onsave(draft.draftId)}
              >
                Save
              </button>
              <button type="button" onclick={() => ondiscard(draft.draftId)}>Discard</button>
            {/if}
          </div>
        </li>
      {/each}
    </ul>
  </section>
{/if}
