<script lang="ts">
  /**
   * Read-only flat archive of every completed review (plan §9.5:
   * "Completed archive read-only"; plan Appendix B "… / archive"). Distinct
   * from the Inbox's "Decided" state, which shows the same completed
   * entries inside the two-panel decision view — the archive is a dense,
   * scannable table with no detail panel, matching
   * `design/Weft UI.dc.html`'s `archiveRows` grid.
   */
  import { Badge, EmptyState, Skeleton } from '@lostgradient/cinder';
  import CircleCheck from 'lucide-svelte/icons/circle-check';
  import CircleDot from 'lucide-svelte/icons/circle-dot';
  import CircleX from 'lucide-svelte/icons/circle-x';
  import type { ReviewListEntry } from '@lostgradient/weft';

  import { formatRelativeTime, truncateId } from '../../lib/format/index.ts';
  import QueryFaultBanner from './query-fault-banner.svelte';
  import { completedEntriesOnly, type ReviewQuery } from './review-domain.ts';

  interface ReviewsArchiveProps {
    readonly completedQuery: ReviewQuery<ReviewListEntry[]>;
  }

  let { completedQuery }: ReviewsArchiveProps = $props();

  const DECISION_PRESENTATION = {
    approved: { label: 'Approved', variant: 'success' as const, icon: CircleCheck },
    rejected: { label: 'Rejected', variant: 'danger' as const, icon: CircleX },
    'needs-changes': { label: 'Needs changes', variant: 'warning' as const, icon: CircleDot },
  } as const;

  const entries = $derived(completedEntriesOnly(completedQuery.data ?? []));
  const now = $state(Date.now());
</script>

{#if completedQuery.isPending}
  <div
    class="weft-reviews-archive__skeleton"
    role="status"
    aria-busy="true"
    aria-label="Loading archive"
  >
    <Skeleton height="2.5rem" />
    <Skeleton height="2.5rem" />
    <Skeleton height="2.5rem" />
  </div>
{:else if completedQuery.isError}
  <QueryFaultBanner error={completedQuery.error} onRetry={() => void completedQuery.refetch()} />
{:else if entries.length === 0}
  <EmptyState
    title="No decisions yet"
    description="Completed reviews will appear here once a decision has been recorded."
  />
{:else}
  <div class="weft-reviews-archive-scroll">
    <table class="weft-reviews-archive">
      <thead>
        <tr>
          <th scope="col">Decision</th>
          <th scope="col">Type</th>
          <th scope="col">Workflow</th>
          <th scope="col">Reviewer</th>
          <th scope="col">When</th>
        </tr>
      </thead>
      <tbody>
        {#each entries as entry (entry.reviewId)}
          {@const presentation = DECISION_PRESENTATION[entry.decision]}
          <tr>
            <td>
              <Badge variant={presentation.variant} size="sm">
                <presentation.icon size={11} aria-hidden="true" />
                {presentation.label}
              </Badge>
            </td>
            <td>{entry.reviewType}</td>
            <td class="weft-reviews-archive__id" title={entry.workflowId}
              >{truncateId(entry.workflowId)}</td
            >
            <td>{entry.reviewer}</td>
            <td>{formatRelativeTime(entry.timestamp, now)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}
