<script lang="ts" module>
  export const title = 'Reviewing only open feedback';
  export const description =
    'Toggling to the unresolved-only filter hides resolved comments without discarding them.';
</script>

<script lang="ts">
  import { DiffReviewComments } from '@lostgradient/editor/diff-review-comments';
  import {
    createDiffReviewState,
    reduceDiffReviewState,
  } from '@lostgradient/editor/diff-review-state';

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

  if (state) {
    const withComment = reduceDiffReviewState(state, {
      type: 'create-comment',
      targetId: 'doc',
      anchor: { kind: 'file', fileOccurrence: 0 },
      body: 'Please double check this paragraph.',
    });
    if (withComment.ok) state = withComment.value;
  }
</script>

{#if state}
  <DiffReviewComments {state} onStateChange={(next) => (state = next)} />
{/if}
