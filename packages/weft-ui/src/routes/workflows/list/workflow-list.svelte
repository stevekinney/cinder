<script lang="ts">
  /**
   * Workflow list screen (plan §9.2 T2.1). Orchestrates the URL-backed
   * filter, the search-attribute query builder disclosure, the Live toggle,
   * pagination, and every Appendix-B state (loading/empty×2/denied/fault)
   * around the child components built for this track.
   */
  import { ChartBar, GitBranch, Plus } from 'lucide-svelte';
  import { Button, ConnectionIndicator, EmptyState, Skeleton } from '@lostgradient/cinder';
  import { createQuery, keepPreviousData, useQueryClient } from '@tanstack/svelte-query';
  import { untrack } from 'svelte';

  import { getFleetEventSource } from '../../../app/engine-status.svelte.ts';
  import type { AttributeFilter } from '../../../lib/attribute-filters.ts';
  import { createActiveRevisionComparisons } from '../../../lib/active-revision-comparisons.svelte.ts';
  import { getClient } from '../../../lib/client.ts';
  import {
    parseWorkflowListFilter,
    serializeWorkflowListFilter,
    type WorkflowListQuery,
  } from '../../../lib/filters.ts';
  import {
    WORKFLOWS_AGGREGATE_KEY_PREFIX,
    WORKFLOWS_LIST_KEY_PREFIX,
  } from '../../../lib/live-source/cache-integration.ts';
  import { queryKeys } from '../../../lib/query.ts';
  import { router } from '../../../lib/router.svelte.ts';
  import { getPrincipalStore, scopeGate } from '../../../lib/scopes.svelte.ts';
  import BulkSelectionBar from './bulk-selection-bar.svelte';
  import QueryBuilder from './query-builder.svelte';
  import QueryFaultBanner from './query-fault-banner.svelte';
  import WorkflowListFilters from './workflow-list-filters.svelte';
  import { WorkflowListLiveController } from './workflow-list-live.svelte.ts';
  import WorkflowListPagination, { DEFAULT_PAGE_SIZE } from './workflow-list-pagination.svelte';
  import WorkflowTable from './workflow-table.svelte';

  const client = getClient();
  const principalStore = getPrincipalStore();
  const queryClient = useQueryClient();
  const listGate = $derived(scopeGate(principalStore, ['workflows:read']));
  const bulkAdminGate = $derived(scopeGate(principalStore, ['workflows:admin']));

  const filter = $derived<WorkflowListQuery>({
    limit: DEFAULT_PAGE_SIZE,
    offset: 0,
    ...parseWorkflowListFilter(router.current.search),
  });

  const hasActiveFilter = $derived(
    Boolean(
      filter.status ||
      filter.type ||
      (filter.tags && filter.tags.length > 0) ||
      filter.idPrefix ||
      (filter.attributes && filter.attributes.length > 0) ||
      filter.createdAt,
    ),
  );

  function navigateToFilter(next: WorkflowListQuery, resetOffset = false): void {
    const nextFilter = { ...next };
    if (resetOffset) delete nextFilter.offset;
    const params = serializeWorkflowListFilter(nextFilter);
    const query = params.toString();
    router.navigate(`/workflows${query ? `?${query}` : ''}`, { replace: true });
  }

  const listQuery = createQuery(() => ({
    queryKey: queryKeys.workflows.list(filter),
    queryFn: () => client.list(filter),
    placeholderData: keepPreviousData,
    enabled: !listGate.disabled,
  }));

  const rows = $derived(listQuery.data?.items ?? []);
  const total = $derived(listQuery.data?.total ?? 0);

  // One `weft.workflows.active.get` per DISTINCT workflow type on the page
  // (COR-15), never per row; gated on `workflows:read`, the operation's own
  // scope (`listGate` is that same scope).
  const revisionComparisons = createActiveRevisionComparisons({
    client,
    rows: () => rows,
    enabled: () => !listGate.disabled,
  });

  // --- Live toggle (plan §5.2, §9.2) ---------------------------------------
  const liveController = new WorkflowListLiveController(getFleetEventSource(), queryClient);
  $effect(() => {
    return () => liveController.dispose();
  });

  function onLiveRefresh(): void {
    liveController.refresh();
    // Fleet frames only invalidate the list query directly
    // (`WorkflowListLiveController.refresh`); the aggregate card on the
    // dashboard reads a separate cache entry this list doesn't own, so it
    // is invalidated here too rather than teaching the live controller
    // about a query key outside its own module.
    void queryClient.invalidateQueries({ queryKey: WORKFLOWS_AGGREGATE_KEY_PREFIX });
  }

  /**
   * Invalidates list + aggregate queries after a bulk action commits (plan
   * §13 T8.1) — same two keys `onLiveRefresh` above already invalidates for
   * the same reason. Also clears the row selection: after a successful
   * bulk action the previously-checked rows may no longer exist (cancel/
   * delete/purge) or no longer match the filter, so leaving them "selected"
   * (`bulk-selection-bar.svelte`'s own bar would then show a stale "N
   * selected" against a changed/empty result set) is confusing rather than
   * a convenience. Wired to `BulkActionDialog`/`BulkPurgeDialog`'s
   * `onSuccess` — fires ONLY when a commit actually succeeds, never on a
   * plain dismiss (`onClose`), so trying a different action against the
   * same selection after backing out of one dialog still works.
   */
  function onBulkActionComplete(): void {
    void queryClient.invalidateQueries({ queryKey: WORKFLOWS_LIST_KEY_PREFIX });
    void queryClient.invalidateQueries({ queryKey: WORKFLOWS_AGGREGATE_KEY_PREFIX });
    selectedIds = new Set();
  }

  // --- Query builder disclosure (plan §10.3) -------------------------------
  // Seeded once from the initial URL (`untrack` makes that explicit); the
  // user's own open/close toggle afterward should not snap shut just
  // because a later edit changes `filter.attributes.length`.
  let queryBuilderOpen = $state(untrack(() => (filter.attributes?.length ?? 0) > 0));
  const knownAttributeKeys = $derived(Array.from(new Set(rows.flatMap((row) => row.tags ?? []))));

  function onAttributesChange(nextAttributes: AttributeFilter[]): void {
    const next: WorkflowListQuery = { ...filter };
    if (nextAttributes.length > 0) next.attributes = nextAttributes;
    else delete next.attributes;
    navigateToFilter(next, true);
  }

  // --- Bulk selection scaffold (plan §9.2: SCAFFOLD only) ------------------
  let selectedIds = $state(new Set<string>());
  $effect(() => {
    // A page/filter change invalidates any prior selection.
    void filter;
    selectedIds = new Set();
  });

  function clearFilters(): void {
    const next: WorkflowListQuery = {};
    if (filter.limit !== undefined) next.limit = filter.limit;
    navigateToFilter(next);
  }

  function onStartWorkflowClick(event: MouseEvent): void {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    event.preventDefault();
    router.navigate('/workflows?view=start');
  }

  function onAggregateClick(event: MouseEvent): void {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    event.preventDefault();
    router.navigate('/workflows?view=aggregate');
  }

  const deniedDescription = $derived(
    listGate.title
      ? `You don't have permission to view workflows. ${listGate.title}.`
      : "You don't have permission to view workflows.",
  );
</script>

<div class="weft-workflow-list">
  <div class="weft-workflow-list__header">
    <div>
      <h1>Workflows</h1>
      <p class="weft-workflow-list__subtitle">
        Snapshot at page load{total > 0 ? ` · ${total.toLocaleString()} matching` : ''}
      </p>
    </div>
    <div class="weft-workflow-list__header-actions">
      <Button
        variant="secondary"
        size="sm"
        class="weft-workflow-list__header-action"
        href={router.href('/workflows?view=aggregate')}
        onclick={onAggregateClick}
      >
        <ChartBar aria-hidden="true" size={14} />
        Aggregate view
      </Button>
      <Button
        variant="primary"
        size="sm"
        class="weft-workflow-list__header-action"
        href={router.href('/workflows?view=start')}
        onclick={onStartWorkflowClick}
      >
        <Plus aria-hidden="true" size={14} />
        Start workflow
      </Button>
    </div>
  </div>

  {#if listGate.disabled}
    <EmptyState title="Access restricted" description={deniedDescription}>
      {#snippet icon()}<GitBranch aria-hidden="true" size={22} />{/snippet}
    </EmptyState>
  {:else}
    <WorkflowListFilters
      {filter}
      onFilterChange={(next) => navigateToFilter(next, true)}
      {queryBuilderOpen}
      onQueryBuilderOpenChange={(open) => (queryBuilderOpen = open)}
      activeConditionCount={filter.attributes?.length ?? 0}
    />

    {#if queryBuilderOpen}
      <QueryBuilder
        attributes={filter.attributes ?? []}
        {onAttributesChange}
        {knownAttributeKeys}
      />
    {/if}

    <div class="weft-workflow-list__toolbar">
      <ConnectionIndicator
        status={liveController.enabled ? liveController.status : 'closed'}
        {...liveController.enabled ? {} : { label: 'Live off' }}
      />
      <Button
        size="sm"
        variant={liveController.enabled ? 'primary' : 'secondary'}
        onclick={() =>
          liveController.enabled ? liveController.disable() : liveController.enable()}
      >
        {liveController.enabled ? 'Live' : 'Go live'}
      </Button>
      {#if liveController.newCount > 0}
        <button type="button" class="weft-workflow-list__new-count" onclick={onLiveRefresh}>
          +{liveController.newCount} new
        </button>
      {/if}
      <span class="weft-workflow-list__showing">
        Showing <strong>{rows.length}</strong> of {total.toLocaleString()}
      </span>
    </div>

    {#if listQuery.isPending}
      <div
        class="weft-workflow-list__skeleton"
        role="status"
        aria-busy="true"
        aria-label="Loading workflows"
      >
        <Skeleton height="2.5rem" />
        <Skeleton height="2.5rem" />
        <Skeleton height="2.5rem" />
        <Skeleton height="2.5rem" />
      </div>
    {:else if listQuery.isError}
      <QueryFaultBanner error={listQuery.error} onRetry={() => void listQuery.refetch()} />
    {:else if rows.length === 0 && !hasActiveFilter}
      <EmptyState
        title="No workflows yet"
        description="Start one from a registered type, or kick one off from your SDK."
      >
        {#snippet icon()}<GitBranch aria-hidden="true" size={22} />{/snippet}
        {#snippet action()}
          <Button
            variant="primary"
            size="md"
            href={router.href('/workflows?view=start')}
            onclick={onStartWorkflowClick}
          >
            <Plus aria-hidden="true" size={15} />
            Start workflow
          </Button>
        {/snippet}
      </EmptyState>
    {:else if rows.length === 0}
      <EmptyState
        title="No workflows match"
        description="No results for the current filter set. Try widening the status or date range."
      >
        {#snippet action()}
          <Button variant="secondary" size="md" onclick={clearFilters}>Clear filters</Button>
        {/snippet}
      </EmptyState>
    {:else}
      <WorkflowTable
        {rows}
        {selectedIds}
        onSelectionChange={(next) => (selectedIds = next)}
        revisionComparison={revisionComparisons.compare}
      />
      <WorkflowListPagination
        offset={filter.offset ?? 0}
        limit={filter.limit ?? DEFAULT_PAGE_SIZE}
        {total}
        onOffsetChange={(offset) => navigateToFilter({ ...filter, offset })}
        onLimitChange={(limit) => navigateToFilter({ ...filter, limit })}
      />
    {/if}

    <BulkSelectionBar
      {client}
      {filter}
      selectedCount={selectedIds.size}
      totalMatchingFilter={total}
      onDeselect={() => (selectedIds = new Set())}
      adminGate={bulkAdminGate}
      onActionComplete={onBulkActionComplete}
    />
  {/if}
</div>
