<script lang="ts">
  /**
   * Workflow aggregate view (plan §9.2 T5.5). `group_by` selector +
   * `BarChart` (Cinder, the v1 default per plan §7.2 — the C5 donut chart
   * is explicitly not built) + a group table whose rows are the actual
   * drill-through affordance (`BarChart` has no per-bar click handler —
   * verified against `chart.types.ts`'s `ChartSharedProps`, matching plan
   * §5.5's "BarChart + group table, click-through to pre-filtered list").
   * Guards the documented 100k-distinct-keys 422
   * (`AggregateDistinctKeyCapExceededError` → `Unprocessable` → this
   * console's `invalid` fault treatment) through the shared
   * `query-fault-banner.svelte`.
   */
  import { ChevronRight } from 'lucide-svelte';
  import {
    BarChart,
    EmptyState,
    Input,
    SegmentedControl,
    Segment,
    Skeleton,
  } from '@lostgradient/cinder';
  import { createQuery } from '@tanstack/svelte-query';

  import { getClient } from '../../../lib/client.ts';
  import { serializeWorkflowListFilter, type WorkflowListQuery } from '../../../lib/filters.ts';
  import { queryKeys, type WorkflowAggregateGroupBy } from '../../../lib/query.ts';
  import { router } from '../../../lib/router.svelte.ts';
  import { getPrincipalStore, scopeGate } from '../../../lib/scopes.svelte.ts';
  import QueryFaultBanner from '../list/query-fault-banner.svelte';
  import {
    aggregateDrillThroughFilter,
    aggregateGroupByLabel,
    aggregateGroupByToWire,
    aggregateGroupKeyLabel,
    parseAggregateGroupBy,
  } from './aggregate-group-by.ts';

  const FIXED_DIMENSIONS = ['status', 'type', 'failureCategory'] as const;

  const client = getClient();
  const principalStore = getPrincipalStore();
  const gate = $derived(scopeGate(principalStore, ['workflows:read']));

  let attributeName = $state('');
  const groupBy = $derived<WorkflowAggregateGroupBy>(
    parseAggregateGroupBy(router.current.search.get('group_by')) ?? 'status',
  );

  function setGroupBy(next: WorkflowAggregateGroupBy): void {
    const params = new URLSearchParams(router.current.search);
    params.set('group_by', next);
    router.navigate(`/workflows?view=aggregate&${params.toString()}`, { replace: true });
  }

  function onFixedDimensionChange(next: string): void {
    setGroupBy(next as WorkflowAggregateGroupBy);
  }

  function onAttributeNameSubmit(): void {
    if (attributeName.trim() !== '') setGroupBy(`attribute:${attributeName.trim()}`);
  }

  const segmentedValue = $derived(
    (FIXED_DIMENSIONS as readonly string[]).includes(groupBy) ? groupBy : 'status',
  );

  const aggregateQuery = createQuery(() => ({
    queryKey: queryKeys.workflows.aggregate(groupBy, {}),
    queryFn: () =>
      client.operations['weft.workflows.aggregate']({ groupBy: aggregateGroupByToWire(groupBy) }),
    enabled: !gate.disabled,
  }));

  /**
   * The generated operation-client output types `groups[].key` as `unknown`
   * (matching `weft.system.registry`'s same conservative-typing pattern —
   * see `registry-types.ts`'s doc), even though the operation's own Zod
   * schema validates it as `z.union([z.string(), z.null()])`. Narrow it
   * back to the real shape here rather than threading `unknown` through
   * every helper this view calls.
   */
  function narrowGroupKey(key: unknown): string | null {
    return typeof key === 'string' ? key : null;
  }

  const groups = $derived(
    (aggregateQuery.data?.groups ?? []).map((group) => ({
      key: narrowGroupKey(group.key),
      count: group.count,
    })),
  );
  const total = $derived(aggregateQuery.data?.total ?? 0);
  const maxCount = $derived(groups.reduce((max, group) => Math.max(max, group.count), 0));

  const chartData = $derived(
    groups.map((group) => ({ label: aggregateGroupKeyLabel(group.key), count: group.count })),
  );

  function drillThroughHref(key: string | null): string | null {
    const filter = aggregateDrillThroughFilter(groupBy, key);
    if (!filter) return null;
    const params = serializeWorkflowListFilter(filter as WorkflowListQuery);
    return `/workflows?${params.toString()}`;
  }

  function onGroupRowClick(event: MouseEvent, key: string | null): void {
    const href = drillThroughHref(key);
    if (!href) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    event.preventDefault();
    router.navigate(href);
  }
</script>

<div class="weft-aggregate-view">
  <div class="weft-aggregate-view__header">
    <h1>Workflow aggregate</h1>
    <a
      class="weft-aggregate-view__back"
      href={router.href('/workflows')}
      onclick={(event) => {
        event.preventDefault();
        router.navigate('/workflows');
      }}
    >
      ← Back to list
    </a>
  </div>

  {#if gate.disabled}
    <EmptyState
      title="Access restricted"
      description={gate.title ?? "You don't have permission to view workflows."}
    />
  {:else}
    <div class="weft-aggregate-view__controls">
      <span class="weft-aggregate-view__group-by-label">Group by</span>
      <SegmentedControl
        id="weft-aggregate-group-by"
        label="Group by"
        labelVisible={false}
        density="toolbar"
        value={segmentedValue}
        onValueChange={onFixedDimensionChange}
      >
        <Segment value="status">Status</Segment>
        <Segment value="type">Type</Segment>
        <Segment value="failureCategory">Failure category</Segment>
      </SegmentedControl>
      <form
        class="weft-aggregate-view__attribute-form"
        onsubmit={(event) => {
          event.preventDefault();
          onAttributeNameSubmit();
        }}
      >
        <div class="weft-aggregate-view__attribute-form-field">
          <Input
            id="weft-aggregate-attribute-name"
            label="Attribute name"
            labelVisible={false}
            placeholder="or group by attribute…"
            value={attributeName}
            oninput={(event) => (attributeName = (event.currentTarget as HTMLInputElement).value)}
          />
        </div>
      </form>
      {#if total > 0}
        <span class="weft-aggregate-view__total">{total.toLocaleString()} total</span>
      {/if}
    </div>

    {#if aggregateQuery.isPending}
      <div
        class="weft-aggregate-view__skeleton"
        role="status"
        aria-busy="true"
        aria-label="Loading aggregate"
      >
        <Skeleton height="16rem" />
      </div>
    {:else if aggregateQuery.isError}
      <QueryFaultBanner
        error={aggregateQuery.error}
        onRetry={() => void aggregateQuery.refetch()}
      />
    {:else if groups.length === 0}
      <EmptyState
        title="No data to aggregate"
        description="No workflows match this grouping yet."
      />
    {:else}
      <BarChart
        label={`Workflows grouped by ${aggregateGroupByLabel(groupBy)}`}
        data={chartData}
        categoryKey="label"
        series={[{ id: 'count', label: 'Count', valueKey: 'count' }]}
        orientation="horizontal"
        tooltip
      />

      <table class="weft-aggregate-view__table">
        <caption class="weft-aggregate-view__table-caption">
          Each row links to a pre-filtered workflow list.
        </caption>
        <thead>
          <tr>
            <th scope="col">{aggregateGroupByLabel(groupBy)}</th>
            <th scope="col">Count</th>
            <th scope="col">Share</th>
            <th scope="col"></th>
          </tr>
        </thead>
        <tbody>
          {#each groups as group (group.key ?? '(none)')}
            {@const href = drillThroughHref(group.key)}
            {@const pct = total > 0 ? Math.round((group.count / total) * 100) : 0}
            <tr
              class="weft-aggregate-view__row"
              data-clickable={href ? '' : undefined}
              onclick={href ? (event) => onGroupRowClick(event, group.key) : undefined}
            >
              <td>
                {#if href}
                  <a href={router.href(href)} onclick={(event) => onGroupRowClick(event, group.key)}
                    >{aggregateGroupKeyLabel(group.key)}</a
                  >
                {:else}
                  {aggregateGroupKeyLabel(group.key)}
                {/if}
              </td>
              <td>{group.count.toLocaleString()}</td>
              <td>
                <div class="weft-aggregate-view__bar-cell">
                  <span
                    class="weft-aggregate-view__bar"
                    style:width={`${maxCount > 0 ? (group.count / maxCount) * 100 : 0}%`}
                  ></span>
                  <span>{pct}%</span>
                </div>
              </td>
              <td
                >{#if href}<ChevronRight aria-hidden="true" size={14} />{/if}</td
              >
            </tr>
          {/each}
        </tbody>
      </table>

      {#if aggregateQuery.data?.truncated}
        <p class="weft-aggregate-view__truncated">
          Showing the largest groups only — more groups exist than fit this view.
        </p>
      {/if}
    {/if}
  {/if}
</div>
