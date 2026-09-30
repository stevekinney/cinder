<script lang="ts">
  /**
   * Compact active-versus-bound badge for list-scale revision cells (COR-15):
   * the workflow list, the children tab, and the lineage panel's children
   * preview. The single-record equivalent lives in `detail/header.svelte`
   * (same labels and variants, so the two never disagree in wording).
   *
   * Renders only the two comparisons a row can assert — `'active'` and
   * `'stale'`. `'unpinned'` is already shown by the row's own "Unpinned"
   * label, and `'unknown'` (still loading, denied, never activated, or a
   * failed lookup) renders nothing rather than repeating an "unknown" chip
   * on every row of a page; the detail header keeps that explicit state.
   */
  import { Badge, Tooltip } from '@lostgradient/cinder';
  import { CircleCheck, TriangleAlert } from 'lucide-svelte';

  import {
    EAGER_REVISION_HEDGE,
    type RevisionActiveComparison,
  } from '../../lib/workflow-revision.ts';

  interface Props {
    readonly comparison: RevisionActiveComparison;
  }

  let { comparison }: Props = $props();
</script>

{#if comparison === 'active'}
  <Tooltip
    text="Matches the revision currently active for this workflow type. {EAGER_REVISION_HEDGE}"
  >
    <Badge variant="success" size="xs">
      <CircleCheck aria-hidden="true" size={10} />
      Active
    </Badge>
  </Tooltip>
{:else if comparison === 'stale'}
  <Tooltip
    text="Differs from the revision currently active for this workflow type. {EAGER_REVISION_HEDGE}"
  >
    <Badge variant="warning" size="xs">
      <TriangleAlert aria-hidden="true" size={10} />
      Differs from active
    </Badge>
  </Tooltip>
{/if}
