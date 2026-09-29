<script lang="ts">
  /**
   * "Schedule health" dashboard card (Track B, plan §9.1, §13 T4.1; design
   * `Weft UI.dc.html` dashboard screen's "Schedule health" card:
   * active/paused counts, missed-fires warning). Self-contained — the
   * card-slot contract (`src/routes/dashboard/cards.ts`) renders it with no
   * props, matching every other domain's card.
   *
   * `weft-dashboard-card*` class names reuse the Dashboard track's shared
   * card-grid styling contract (`src/styles/dashboard.css`, imported
   * globally ahead of this track's stylesheet) — the same convention
   * `failure-category-card.svelte` and `workflow-status-card.svelte` use,
   * so this card sits in the aggregate-cards grid with consistent spacing.
   *
   * No `weft.schedules.aggregate` operation exists (only workflows has
   * `aggregate`), so counts are computed client-side over one bounded
   * `listSchedules` page — reasonable for an operator's schedule count
   * (dozens, not thousands); a full census would need pagination this
   * summary card doesn't need.
   */
  import { Card, Skeleton, StatusDot } from '@lostgradient/cinder';
  import { createQuery } from '@tanstack/svelte-query';

  import { getClient } from '../../../lib/client.ts';
  import { faultTreatment } from '../../../lib/faults.ts';
  import { queryKeys } from '../../../lib/query.ts';
  import { router } from '../../../lib/router.svelte.ts';

  const client = getClient();

  const HEALTH_CARD_SCHEDULE_LIMIT = 200;
  const MISSED_WITHIN_MS = 24 * 60 * 60 * 1000;

  const filter = { limit: HEALTH_CARD_SCHEDULE_LIMIT };

  const query = createQuery(() => ({
    queryKey: queryKeys.schedules.list(filter),
    queryFn: () => client.listSchedules(filter),
  }));

  const summary = $derived.by(() => {
    const items = query.data?.items ?? [];
    const now = Date.now();
    let active = 0;
    let paused = 0;
    let missedWithin24h = 0;
    for (const schedule of items) {
      if (schedule.status === 'active') active += 1;
      else if (schedule.status === 'paused') paused += 1;
      if (
        schedule.lastMissedFireAt !== undefined &&
        now - schedule.lastMissedFireAt < MISSED_WITHIN_MS
      ) {
        missedWithin24h += 1;
      }
    }
    return { total: items.length, active, paused, missedWithin24h };
  });

  function openList(status?: 'active' | 'paused'): void {
    router.navigate(status ? `/schedules?status=${status}` : '/schedules');
  }
</script>

<Card padding="none" class="weft-dashboard-card">
  {#snippet header()}
    <div class="weft-dashboard-card__header">
      <span class="weft-dashboard-card__title">Schedule health</span>
      {#if query.isSuccess}
        <span class="weft-dashboard-card__meta">{summary.total} schedules</span>
      {/if}
    </div>
  {/snippet}

  {#if query.isPending}
    <div
      class="weft-schedules-dashboard-card__skeleton"
      role="status"
      aria-busy="true"
      aria-label="Loading schedule health"
    >
      <Skeleton height="52px" />
    </div>
  {:else if query.isError}
    <p class="weft-dashboard-card__error">{faultTreatment(query.error).message}</p>
  {:else}
    <div class="weft-schedules-dashboard-card__grid">
      <button
        type="button"
        class="weft-schedules-dashboard-card__segment"
        onclick={() => openList('active')}
      >
        <span class="weft-schedules-dashboard-card__segment-label">
          <StatusDot status="success" labelVisible={false} />
          Active
        </span>
        <span class="weft-schedules-dashboard-card__segment-count">{summary.active}</span>
      </button>
      <button
        type="button"
        class="weft-schedules-dashboard-card__segment"
        onclick={() => openList('paused')}
      >
        <span class="weft-schedules-dashboard-card__segment-label">
          <StatusDot status="neutral" labelVisible={false} />
          Paused
        </span>
        <span class="weft-schedules-dashboard-card__segment-count">{summary.paused}</span>
      </button>
      <button
        type="button"
        class="weft-schedules-dashboard-card__segment"
        onclick={() => openList()}
      >
        <span class="weft-schedules-dashboard-card__segment-label">
          <StatusDot
            status={summary.missedWithin24h > 0 ? 'warning' : 'neutral'}
            labelVisible={false}
          />
          Missed 24h
        </span>
        <span
          class="weft-schedules-dashboard-card__segment-count"
          data-warning={summary.missedWithin24h > 0 ? '' : undefined}
        >
          {summary.missedWithin24h}
        </span>
      </button>
    </div>
  {/if}
</Card>

<style>
  .weft-schedules-dashboard-card__skeleton {
    padding: 13px 16px;
  }

  .weft-schedules-dashboard-card__grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    padding: 6px 4px;
  }

  .weft-schedules-dashboard-card__segment {
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: 13px 14px;
    border: 0;
    background: transparent;
    border-radius: 8px;
    cursor: pointer;
    text-align: left;
    font: inherit;
    color: inherit;
  }

  @media (hover: hover) {
    .weft-schedules-dashboard-card__segment:hover {
      background: var(--cinder-surface-inset);
    }
  }

  .weft-schedules-dashboard-card__segment-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--cinder-text-2xs);
    color: var(--cinder-text-subtle);
  }

  .weft-schedules-dashboard-card__segment-count {
    font-size: var(--cinder-text-2xl);
    font-weight: 600;
    font-family: var(--cinder-font-mono);
  }

  .weft-schedules-dashboard-card__segment-count[data-warning] {
    color: var(--cinder-color-warning-fg);
  }
</style>
