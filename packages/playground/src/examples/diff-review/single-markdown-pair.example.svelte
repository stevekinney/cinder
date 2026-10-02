<script lang="ts" module>
  export const title = 'Single Markdown pair';
  export const description = 'One Markdown target, comment creation, and export.';
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
      original: '# Project Plan\n\nShip login and a dashboard.',
      current: '# Project Plan\n\nShip login, a dashboard, and CSV export.',
      normalizeInputs: true,
    },
  ];

  const created = createDiffReviewState(targets);
  let state = $state(created.ok ? created.value : undefined);
</script>

{#if state}
  <DiffReview {targets} {state} onStateChange={(next) => (state = next)} />
{/if}
