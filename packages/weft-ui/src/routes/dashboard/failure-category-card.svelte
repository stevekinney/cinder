<script lang="ts">
  /**
   * "Failures by category" aggregate card (plan §9.1: "your own stat cards
   * from GET /api/v1/workflows/aggregate?group_by=failureCategory"). Design
   * `Weft UI.dc.html` dashboard screen renders this as clickable
   * proportional bar rows (not literally the Cinder `BarChart` component,
   * which has no click/deep-link affordance per its props — `ChartSharedProps`
   * has no `onClick`/interactive-callback field, verified against
   * `@lostgradient/cinder` v0.16.1's `chart.types.ts`) — this track's brief
   * requires "cards deep-link to pre-filtered lists", so each row uses
   * Cinder's `Meter` (bounded proportion display, §7.1: "inline capacity/
   * utilization") for the bar, wrapped in a real link.
   *
   * `groupBy: 'failureCategory'` always includes a `key: null` group for
   * workflows with no failure category (every non-`failed` workflow) —
   * excluded here; this card is a failure breakdown, not a full census.
   */
  import { Card, Meter, Skeleton } from '@lostgradient/cinder';
  import { createQuery } from '@tanstack/svelte-query';

  import { faultTreatment } from '../../lib/faults.ts';
  import { getClient } from '../../lib/client.ts';
  import { queryKeys } from '../../lib/query.ts';
  import { router } from '../../lib/router.svelte.ts';
  import { parseWorkflowAggregateResult } from './aggregate-output.ts';

  const client = getClient();

  const FAILURE_CATEGORY_LABEL = {
    application: 'Application',
    timeout: 'Timeout',
    cancellation: 'Cancellation',
    resource: 'Resource',
    system: 'System',
  } as const;

  type FailureCategoryKey = keyof typeof FAILURE_CATEGORY_LABEL;

  function isFailureCategoryKey(key: string): key is FailureCategoryKey {
    return key in FAILURE_CATEGORY_LABEL;
  }

  const query = createQuery(() => ({
    queryKey: queryKeys.workflows.aggregate('failureCategory', {}),
    queryFn: async () =>
      parseWorkflowAggregateResult(
        await client.operations['weft.workflows.aggregate']({ groupBy: 'failureCategory' }),
      ),
  }));

  const rows = $derived.by(() => {
    const groups = (query.data?.groups ?? []).filter(
      (group): group is { key: FailureCategoryKey; count: number } =>
        group.key !== null && isFailureCategoryKey(group.key),
    );
    const total = groups.reduce((sum, group) => sum + group.count, 0);
    return groups
      .map((group) => ({
        category: group.key,
        label: FAILURE_CATEGORY_LABEL[group.key],
        count: group.count,
        total,
      }))
      .toSorted((a, b) => b.count - a.count);
  });

  const totalFailures = $derived(rows.reduce((sum, row) => sum + row.count, 0));

  function hrefFor(category: FailureCategoryKey): string {
    return `/workflows?status=failed&failure_category=${category}`;
  }
</script>

<Card padding="none" class="weft-dashboard-card">
  {#snippet header()}
    <div class="weft-dashboard-card__header">
      <span class="weft-dashboard-card__title">Failures by category</span>
      {#if !query.isPending && !query.isError}
        <span class="weft-dashboard-card__meta">{totalFailures} total</span>
      {/if}
    </div>
  {/snippet}

  {#if query.isPending}
    <div
      class="weft-failure-category-card__skeleton"
      role="status"
      aria-busy="true"
      aria-label="Loading failure categories"
    >
      <Skeleton height="9px" />
      <Skeleton height="9px" />
      <Skeleton height="9px" />
    </div>
  {:else if query.isError}
    <p class="weft-dashboard-card__error">{faultTreatment(query.error).message}</p>
  {:else if rows.length === 0}
    <p class="weft-failure-category-card__empty">No failures recorded.</p>
  {:else}
    <ul class="weft-failure-category-card__list">
      {#each rows as row (row.category)}
        <li>
          <a
            href={router.href(hrefFor(row.category))}
            class="weft-failure-category-card__row"
            onclick={(event) => {
              event.preventDefault();
              router.navigate(hrefFor(row.category));
            }}
          >
            <span class="weft-failure-category-card__label">{row.label}</span>
            <Meter
              value={row.count}
              max={row.total}
              size="sm"
              class="weft-failure-category-card__meter"
              ariaLabel={`${row.label}: ${row.count} of ${row.total} failures`}
            />
            <span class="weft-failure-category-card__count">{row.count}</span>
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</Card>
