<script lang="ts" module>
  export const title = 'Standalone comments panel';
  export const description =
    'DiffReviewComments next to a DiffViewer, sharing one controlled DiffReviewState.';
</script>

<script lang="ts">
  import { DiffViewer } from '@lostgradient/editor/diff-viewer';
  import { DiffReviewComments } from '@lostgradient/editor/diff-review-comments';
  import { createDiffReviewState } from '@lostgradient/editor/diff-review-state';

  const original = 'line one\nline two\nline three';
  const current = 'line one\nline TWO\nline three';

  const created = createDiffReviewState([
    {
      targetId: 'doc',
      kind: 'markdown',
      label: 'notes.md',
      original,
      current,
      normalizeInputs: false,
    },
  ]);
  let state = $state(created.ok ? created.value : undefined);
</script>

{#if state}
  <DiffViewer {original} {current} readonly />
  <DiffReviewComments {state} onStateChange={(next) => (state = next)} />
{/if}
