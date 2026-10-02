<script lang="ts" module>
  export const title = 'Read-only review';
  export const description =
    'In read-only mode the filter and review note remain viewable but every mutating control is disabled.';
</script>

<script lang="ts">
  import { DiffReviewComments } from '@lostgradient/editor/diff-review-comments';
  import { createDiffReviewState } from '@lostgradient/editor/diff-review-state';

  const created = createDiffReviewState([
    {
      targetId: 'doc',
      kind: 'markdown',
      label: 'notes.md',
      original: 'a',
      current: 'b',
      normalizeInputs: false,
    },
  ]);
  let state = $state(created.ok ? created.value : undefined);
</script>

{#if state}
  <DiffReviewComments {state} onStateChange={(next) => (state = next)} readonly />
{/if}
