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
  const initial = created.ok ? created.value : undefined;
  const withComment = initial
    ? reduceDiffReviewState(initial, {
        type: 'create-comment',
        targetId: 'doc',
        anchor: { kind: 'file', fileOccurrence: 0 },
        body: 'Please double check this paragraph.',
      })
    : undefined;
  let state = $state(withComment?.ok ? withComment.value : initial);
</script>

{#if state}
  <DiffReviewComments {state} onStateChange={(next) => (state = next)} />
{/if}
