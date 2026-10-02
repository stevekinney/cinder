<script lang="ts" module>
  export const title = 'Mixed Markdown and source session';
  export const description =
    'One Markdown comparison and one source patch reviewed side by side in a single session.';
</script>

<script lang="ts">
  import { DiffReview } from '@lostgradient/editor/diff-review';
  import { createDiffReviewState } from '@lostgradient/editor/diff-review-state';
  import type { DiffReviewTargetInput } from '@lostgradient/editor/diff-review-state';

  const targets: DiffReviewTargetInput[] = [
    {
      targetId: 'readme',
      kind: 'markdown',
      label: 'README.md',
      original: 'Install with npm.',
      current: 'Install with npm or bun.',
      normalizeInputs: true,
    },
    {
      targetId: 'patch',
      kind: 'source',
      label: 'Add bun support',
      patch:
        'diff --git a/package.json b/package.json\n--- a/package.json\n+++ b/package.json\n@@ -1,2 +1,2 @@\n-{\"name\":\"demo\"}\n+{\"name\":\"demo\",\"packageManager\":\"bun\"}\n',
    },
  ];

  const created = createDiffReviewState(targets);
  let state = $state(created.ok ? created.value : undefined);
</script>

{#if state}
  <DiffReview {targets} {state} onStateChange={(next) => (state = next)} readonly />
{/if}
