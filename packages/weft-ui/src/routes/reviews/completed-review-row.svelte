<script lang="ts">
  /**
   * One row for a completed review — used by both the Inbox "Decided" state
   * and the flat Archive table (plan §9.5, plan Appendix B "Review …
   * completed / archive").
   */
  import { Badge } from '@lostgradient/cinder';
  import CircleCheck from 'lucide-svelte/icons/circle-check';
  import CircleDot from 'lucide-svelte/icons/circle-dot';
  import CircleX from 'lucide-svelte/icons/circle-x';
  import type { CompletedReviewEntry } from '@lostgradient/weft';

  import { formatRelativeTime, truncateId } from '../../lib/format/index.ts';

  interface CompletedReviewRowProps {
    readonly entry: CompletedReviewEntry;
    readonly selected: boolean;
    readonly now: number;
    readonly onSelect: (reviewId: string) => void;
  }

  let { entry, selected, now, onSelect }: CompletedReviewRowProps = $props();

  const DECISION_PRESENTATION = {
    approved: { label: 'Approved', variant: 'success' as const, icon: CircleCheck },
    rejected: { label: 'Rejected', variant: 'danger' as const, icon: CircleX },
    'needs-changes': { label: 'Needs changes', variant: 'warning' as const, icon: CircleDot },
  } as const;

  const presentation = $derived(DECISION_PRESENTATION[entry.decision]);
</script>

<button
  type="button"
  class="weft-review-row"
  class:weft-review-row--selected={selected}
  aria-pressed={selected}
  onclick={() => onSelect(entry.reviewId)}
>
  <div class="weft-review-row__top">
    <Badge variant={presentation.variant} size="sm">
      <presentation.icon size={11} aria-hidden="true" />
      {presentation.label}
    </Badge>
    <span class="weft-review-row__type">{entry.reviewType}</span>
  </div>
  <div class="weft-review-row__id" title={entry.workflowId}>{truncateId(entry.workflowId)}</div>
  <div class="weft-review-row__bottom">
    <span class="weft-review-row__created">{entry.reviewer}</span>
    <span class="weft-review-row__completed">{formatRelativeTime(entry.timestamp, now)}</span>
  </div>
</button>
