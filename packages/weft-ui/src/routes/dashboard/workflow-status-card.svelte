<script lang="ts">
  /**
   * "Workflows by status" aggregate card (plan §9.1: "your own stat cards
   * from GET /api/v1/workflows/aggregate?group_by=status" — this track's
   * own card, distinct from the workflows-domain card-slot registry entry).
   * Design `Weft UI.dc.html` dashboard screen. Data is fetched once by
   * the parent route (`./index.svelte`, which also needs the total for the
   * page-level empty-state gate) and passed in as a query result — this
   * component only presents it.
   */
  import { Card, Skeleton, StatusDot } from '@lostgradient/cinder';
  import type { CreateQueryResult } from '@tanstack/svelte-query';

  import { router } from '../../lib/router.svelte.ts';
  import { faultTreatment } from '../../lib/faults.ts';
  import type { WorkflowAggregateResult } from './aggregate-output.ts';
  import { STATUS_DISPLAY_ORDER, statusToneInfo } from './status-tone.ts';

  interface WorkflowStatusCardProps {
    query: CreateQueryResult<WorkflowAggregateResult>;
  }

  let { query }: WorkflowStatusCardProps = $props();

  const countByStatus = $derived.by(() => {
    const counts = new Map<string, number>();
    for (const group of query.data?.groups ?? []) {
      if (group.key !== null) counts.set(group.key, group.count);
    }
    return counts;
  });
</script>

<Card padding="none" class="weft-dashboard-card">
  {#snippet header()}
    <div class="weft-dashboard-card__header">
      <span class="weft-dashboard-card__title">Workflows by status</span>
      <a href={router.href('/workflows')} class="weft-dashboard-card__view-all">View all →</a>
    </div>
  {/snippet}

  {#if query.isPending}
    <div
      class="weft-status-card__skeleton"
      role="status"
      aria-busy="true"
      aria-label="Loading workflow status"
    >
      <Skeleton height="4.5rem" />
    </div>
  {:else if query.isError}
    <p class="weft-dashboard-card__error">{faultTreatment(query.error).message}</p>
  {:else}
    <div class="weft-status-card__grid">
      {#each STATUS_DISPLAY_ORDER as status (status)}
        {@const info = statusToneInfo(status)}
        {@const count = countByStatus.get(status) ?? 0}
        <a
          href={router.href(`/workflows?status=${status}`)}
          class="weft-status-card__cell"
          onclick={(event) => {
            event.preventDefault();
            router.navigate(`/workflows?status=${status}`);
          }}
        >
          <span class="weft-status-card__cell-label">
            <StatusDot status={info.tone} labelVisible={false} aria-hidden="true" />
            {info.label}
          </span>
          <span class="weft-status-card__cell-count" data-tone={info.tone}>{count}</span>
        </a>
      {/each}
    </div>
  {/if}
</Card>
