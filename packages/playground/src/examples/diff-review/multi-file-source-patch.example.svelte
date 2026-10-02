<script lang="ts" module>
  export const title = 'Multi-file source patch';
  export const description =
    'One source target spanning several files, navigable from the file list.';
</script>

<script lang="ts">
  import { DiffReview } from '@lostgradient/editor/diff-review';
  import { createDiffReviewState } from '@lostgradient/editor/diff-review-state';
  import type { DiffReviewTargetInput } from '@lostgradient/editor/diff-review-state';

  const patch = `diff --git a/src/one.ts b/src/one.ts\n--- a/src/one.ts\n+++ b/src/one.ts\n@@ -1,2 +1,2 @@\n-const a = 1;\n+const a = 2;\n keep();\ndiff --git a/src/two.ts b/src/two.ts\n--- a/src/two.ts\n+++ b/src/two.ts\n@@ -1,2 +1,2 @@\n-const b = 1;\n+const b = 2;\n keep();\n`;

  const targets: DiffReviewTargetInput[] = [
    { targetId: 'patch', kind: 'source', label: 'Refactor constants', patch },
  ];

  const created = createDiffReviewState(targets);
  let state = $state(created.ok ? created.value : undefined);
</script>

{#if state}
  <DiffReview {targets} {state} onStateChange={(next) => (state = next)} />
{/if}
