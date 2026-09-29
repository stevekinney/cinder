<script lang="ts">
  /**
   * One row in the pending-review list (plan §9.5: "pending list (countdown,
   * red when <20% of the review window remains)").
   */
  import { Badge } from '@lostgradient/cinder';
  import type { PendingReviewEntry } from '@lostgradient/weft';

  import { formatRelativeTime, truncateId } from '../../lib/format/index.ts';
  import { formatReviewCountdown, reviewDeadline } from './review-domain.ts';

  interface PendingReviewRowProps {
    readonly entry: PendingReviewEntry;
    readonly selected: boolean;
    readonly now: number;
    readonly onSelect: (reviewId: string) => void;
  }

  let { entry, selected, now, onSelect }: PendingReviewRowProps = $props();

  const deadline = $derived(reviewDeadline(entry, now));
  const countdownLabel = $derived(formatReviewCountdown(deadline));
</script>

<button
  type="button"
  class="weft-review-row"
  class:weft-review-row--selected={selected}
  aria-pressed={selected}
  onclick={() => onSelect(entry.reviewId)}
>
  <div class="weft-review-row__top">
    <Badge variant="neutral" size="sm">{entry.reviewType}</Badge>
  </div>
  <div class="weft-review-row__id" title={entry.workflowId}>{truncateId(entry.workflowId)}</div>
  <div class="weft-review-row__bottom">
    <span class="weft-review-row__created">{formatRelativeTime(entry.createdAt, now)}</span>
    <span
      class="weft-review-row__countdown"
      class:weft-review-row__countdown--urgent={deadline.isUrgent}
      class:weft-review-row__countdown--expired={deadline.isTimedOut}
    >
      {countdownLabel}
    </span>
  </div>
</button>
