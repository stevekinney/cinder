<script lang="ts">
  /**
   * Schedule list (Track B, plan §9.3; design `Weft UI.dc.html`
   * "Schedule list"): status/cadence/next/last fire, missed-fire count (red
   * when >0), row actions gated on `schedules:write`.
   */
  import {
    Badge,
    Button,
    ConfirmDialog,
    Dropdown,
    EmptyState,
    Input,
    Select,
    Skeleton,
    Table,
  } from '@lostgradient/cinder';
  import {
    CalendarClock,
    Ellipsis,
    Lock,
    Pause,
    Pencil,
    Play,
    Search,
    XCircle,
  } from 'lucide-svelte';

  import type { ScheduleFilter, ScheduleStatus, ScheduleSummary } from '@lostgradient/weft';

  import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';

  import { getClient } from '../../lib/client.ts';
  import { faultTreatment } from '../../lib/faults.ts';
  import { formatRelativeTime } from '../../lib/format/index.ts';
  import { queryKeys } from '../../lib/query.ts';
  import { router } from '../../lib/router.svelte.ts';
  import { getPrincipalStore, scopeGate } from '../../lib/scopes.svelte.ts';
  import { describeCadence } from './cadence.ts';
  import FaultBanner from './fault-banner.svelte';
  import {
    cancelSchedule,
    fetchScheduleList,
    pauseSchedule,
    resumeSchedule,
  } from './schedule-queries.ts';
  import { missedFireBadgeVariant, scheduleStatusDescriptor } from './schedule-status.ts';

  const client = getClient();
  const principal = getPrincipalStore();
  const queryClient = useQueryClient();

  const SCHEDULE_STATUSES: readonly ScheduleStatus[] = ['active', 'paused', 'cancelled'];

  function isScheduleStatus(value: string | null): value is ScheduleStatus {
    return value !== null && (SCHEDULE_STATUSES as readonly string[]).includes(value);
  }

  /**
   * The URL owns the status filter (plan §4: "URL owns filter/pagination/tab
   * state") — the dashboard's Schedule health card deep-links here via
   * `/schedules?status=active` (plan §9.1: "Cards deep-link to pre-filtered
   * lists"). `workflowTypeFilter`/`idPrefix` stay component-local: nothing
   * deep-links into those today.
   */
  const statusFilter = $derived<ScheduleStatus | 'all'>(
    isScheduleStatus(router.current.search.get('status'))
      ? (router.current.search.get('status') as ScheduleStatus)
      : 'all',
  );

  function setStatusFilter(next: string): void {
    const params = new URLSearchParams(router.current.search);
    if (next === 'all') params.delete('status');
    else params.set('status', next);
    const query = params.toString();
    router.navigate(query ? `/schedules?${query}` : '/schedules', { replace: true });
  }

  let workflowTypeFilter = $state('all');
  let idPrefix = $state('');

  const filter = $derived<ScheduleFilter>({
    ...(statusFilter === 'all' ? {} : { status: statusFilter }),
    ...(workflowTypeFilter === 'all' ? {} : { workflowType: workflowTypeFilter }),
  });

  const listQuery = createQuery(() => ({
    queryKey: queryKeys.schedules.list(filter),
    queryFn: () => fetchScheduleList(client, filter),
  }));

  const allItems = $derived(listQuery.data?.items ?? []);

  const workflowTypeOptions = $derived([
    { value: 'all', label: 'All workflow types' },
    ...[...new Set(allItems.map((schedule) => schedule.workflowType))]
      .toSorted((a, b) => (a < b ? -1 : a > b ? 1 : 0))
      .map((type) => ({ value: type, label: type })),
  ]);

  const visibleItems = $derived(
    allItems.filter(
      (schedule) => idPrefix.trim().length === 0 || schedule.id.startsWith(idPrefix.trim()),
    ),
  );

  /** True once any filter narrows the result set — distinguishes "no schedules configured at all" (onboarding empty state) from "this filter matched nothing" (plan §10.7: every empty state names a next step, but a filtered-empty view's next step is clearing the filter, not creating a schedule that may already exist). */
  const isFiltered = $derived(
    statusFilter !== 'all' || workflowTypeFilter !== 'all' || idPrefix.trim().length > 0,
  );

  const writeGate = $derived(scopeGate(principal, ['schedules:write']));

  function invalidateSchedules(): void {
    void queryClient.invalidateQueries({ queryKey: ['schedules'] });
  }

  const pauseMutation = createMutation(() => ({
    mutationFn: (id: string) => pauseSchedule(client, id),
    onSuccess: invalidateSchedules,
  }));
  const resumeMutation = createMutation(() => ({
    mutationFn: (id: string) => resumeSchedule(client, id),
    onSuccess: invalidateSchedules,
  }));
  const cancelMutation = createMutation(() => ({
    mutationFn: (id: string) => cancelSchedule(client, id),
    onSuccess: invalidateSchedules,
  }));

  function openCreate(): void {
    router.navigate('/schedules?create=1');
  }

  function openDetail(id: string): void {
    router.navigate(`/schedules?id=${encodeURIComponent(id)}`);
  }

  /**
   * Keyboard-accessible path to the detail view (T9.4 accessibility pass).
   * `Table.Row`'s own `onclick` below is mouse-only — Cinder's `<tr>` gets no
   * `tabindex`/keydown handling (`table-row.svelte` just spreads `...rest`
   * onto a bare element), so before this the entire row was unreachable by
   * keyboard. Mirrors `workflow-table.svelte`'s `onIdLinkClick`: a real
   * anchor carries the keyboard path and modifier-click passthrough (open in
   * new tab, etc.); `stopPropagation` matches this row's own convention for
   * every other nested interactive element (`togglePause`/`openEdit`/
   * `requestCancel`) so the click isn't also seen by the row's `onclick`.
   */
  function onIdLinkClick(event: MouseEvent, id: string): void {
    event.stopPropagation();
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    event.preventDefault();
    openDetail(id);
  }

  function openEdit(id: string, event?: Event): void {
    event?.stopPropagation();
    router.navigate(`/schedules?id=${encodeURIComponent(id)}&edit=1`);
  }

  function togglePause(schedule: ScheduleSummary, event: Event): void {
    event.stopPropagation();
    if (schedule.status === 'paused') {
      resumeMutation.mutate(schedule.id);
    } else {
      pauseMutation.mutate(schedule.id);
    }
  }

  /**
   * Tier-2 confirm before cancel (plan §10.6, T8.2 tier sweep). Previously
   * mutated directly on click with no confirmation at all — a real gap:
   * `../../schedules/schedule-detail.svelte`'s own row-equivalent action
   * already required this exact `ConfirmDialog` ("This can't be undone —
   * create a new schedule to resume this cadence."); the list's row action
   * cancels the same schedule the same irreversible way and needs the same
   * gate.
   */
  let cancelDialogOpen = $state(false);
  let cancelTargetId = $state<string | null>(null);

  function requestCancel(id: string, event: Event): void {
    event.stopPropagation();
    cancelTargetId = id;
    cancelDialogOpen = true;
  }

  function confirmCancel(): void {
    if (cancelTargetId === null) return;
    cancelMutation.mutate(cancelTargetId);
    cancelDialogOpen = false;
  }
</script>

<div class="weft-schedule-list">
  <div class="weft-schedule-list__header">
    <div>
      <h1 class="weft-schedule-list__title">Schedules</h1>
      <p class="weft-schedule-list__subtitle">
        {allItems.length} schedule{allItems.length === 1 ? '' : 's'}
      </p>
    </div>
    <div class="weft-schedule-list__header-actions">
      <Button
        variant="primary"
        size="sm"
        disabled={writeGate.disabled}
        onclick={openCreate}
        leadingIcon={plusIcon}
      >
        Create schedule
      </Button>
      {#if writeGate.disabled}
        <span class="weft-schedule-list__scope-pill">
          <Lock aria-hidden="true" size={12} />
          {writeGate.title}
        </span>
      {/if}
    </div>
  </div>

  {#snippet plusIcon()}
    <CalendarClock aria-hidden="true" size={14} />
  {/snippet}

  <div class="weft-schedule-list__filters">
    <Select
      id="weft-schedule-status-filter"
      aria-label="Status"
      value={statusFilter}
      onchange={(event) => setStatusFilter(event.currentTarget.value)}
      options={[
        { value: 'all', label: 'All statuses' },
        { value: 'active', label: 'Active' },
        { value: 'paused', label: 'Paused' },
        { value: 'cancelled', label: 'Cancelled' },
      ]}
    />
    <Select
      id="weft-schedule-type-filter"
      aria-label="Workflow type"
      bind:value={workflowTypeFilter}
      options={workflowTypeOptions}
    />
    <Input
      id="weft-schedule-id-filter"
      label="ID prefix"
      labelVisible={false}
      placeholder="ID prefix…"
      bind:value={idPrefix}
      leading={searchIcon}
    />
  </div>

  {#snippet searchIcon()}
    <Search aria-hidden="true" size={14} />
  {/snippet}

  {#if listQuery.isPending}
    <div
      class="weft-schedule-list__skeleton"
      role="status"
      aria-busy="true"
      aria-label="Loading schedules"
    >
      {#each Array(6) as _, index (index)}
        <Skeleton height="42px" />
      {/each}
    </div>
  {:else if listQuery.isError}
    <FaultBanner
      treatment={faultTreatment(listQuery.error)}
      onRetry={() => void listQuery.refetch()}
    />
  {:else if visibleItems.length === 0 && !isFiltered}
    <EmptyState title="No schedules" description="Create one to run workflows on a cadence.">
      {#snippet icon()}
        <CalendarClock aria-hidden="true" size={26} />
      {/snippet}
      {#snippet action()}
        <Button variant="primary" size="sm" disabled={writeGate.disabled} onclick={openCreate}>
          Create schedule
        </Button>
      {/snippet}
    </EmptyState>
  {:else if visibleItems.length === 0}
    <EmptyState
      title="No matching schedules"
      description="No schedule matches the current filters. Clear a filter to see more."
    />
  {:else}
    <Table scrollable caption="Schedules">
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell>Status</Table.HeaderCell>
          <Table.HeaderCell>Schedule ID</Table.HeaderCell>
          <Table.HeaderCell>Type</Table.HeaderCell>
          <Table.HeaderCell>Cadence</Table.HeaderCell>
          <Table.HeaderCell>Next fire</Table.HeaderCell>
          <Table.HeaderCell>Last fire</Table.HeaderCell>
          <Table.HeaderCell align="right">Missed</Table.HeaderCell>
          <Table.HeaderCell><span class="weft-sr-only">Actions</span></Table.HeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each visibleItems as schedule (schedule.id)}
          {@const status = scheduleStatusDescriptor(schedule.status)}
          <Table.Row onclick={() => openDetail(schedule.id)} class="weft-schedule-list__row">
            <Table.Cell as="th">
              <Badge variant={status.variant}>{status.label}</Badge>
            </Table.Cell>
            <Table.Cell class="weft-schedule-list__id">
              <a
                class="weft-schedule-list__id-link"
                href={router.href(`/schedules?id=${encodeURIComponent(schedule.id)}`)}
                onclick={(event) => onIdLinkClick(event, schedule.id)}
              >
                {schedule.id}
              </a>
            </Table.Cell>
            <Table.Cell>{schedule.workflowType}</Table.Cell>
            <Table.Cell>{describeCadence(schedule)}</Table.Cell>
            <Table.Cell class="weft-schedule-list__mono">
              {schedule.nextFireAt !== null ? formatRelativeTime(schedule.nextFireAt) : '—'}
            </Table.Cell>
            <Table.Cell class="weft-schedule-list__mono">
              {schedule.lastFireAt !== undefined ? formatRelativeTime(schedule.lastFireAt) : '—'}
            </Table.Cell>
            <Table.Cell align="right">
              <Badge variant={missedFireBadgeVariant(schedule.missedFireCount)}>
                {schedule.missedFireCount}
              </Badge>
            </Table.Cell>
            <Table.Cell align="right">
              <Dropdown id={`weft-schedule-actions-${schedule.id}`} placement="bottom-end">
                <Dropdown.Trigger caretVisible={false} onclick={(event) => event.stopPropagation()}>
                  <Ellipsis aria-hidden="true" size={16} />
                  <span class="weft-sr-only">Actions for {schedule.id}</span>
                </Dropdown.Trigger>
                <Dropdown.Menu>
                  {#if schedule.status !== 'cancelled'}
                    <Dropdown.Item
                      disabled={writeGate.disabled}
                      onclick={(event) => togglePause(schedule, event)}
                    >
                      {#if schedule.status === 'paused'}
                        <Play aria-hidden="true" size={14} /> Resume
                      {:else}
                        <Pause aria-hidden="true" size={14} /> Pause
                      {/if}
                    </Dropdown.Item>
                  {/if}
                  <Dropdown.Item
                    disabled={writeGate.disabled}
                    onclick={(event) => openEdit(schedule.id, event)}
                  >
                    <Pencil aria-hidden="true" size={14} /> Edit
                  </Dropdown.Item>
                  {#if schedule.status !== 'cancelled'}
                    <Dropdown.Item
                      variant="danger"
                      disabled={writeGate.disabled}
                      onclick={(event) => requestCancel(schedule.id, event)}
                    >
                      <XCircle aria-hidden="true" size={14} /> Cancel
                    </Dropdown.Item>
                  {/if}
                </Dropdown.Menu>
              </Dropdown>
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table>
  {/if}
</div>

<ConfirmDialog
  bind:open={cancelDialogOpen}
  title="Cancel this schedule?"
  description={cancelTargetId
    ? `"${cancelTargetId}" will stop firing. This can't be undone — create a new schedule to resume this cadence.`
    : ''}
  confirmLabel="Cancel schedule"
  destructive
  onConfirm={confirmCancel}
/>

<style>
  .weft-schedule-list {
    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-4, 1rem);
    max-width: 1180px;
    margin: 0 auto;
    padding: 18px 24px 60px;
  }

  .weft-schedule-list__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--cinder-space-3, 0.75rem);
    flex-wrap: wrap;
  }

  .weft-schedule-list__title {
    margin: 0;
    font-size: var(--cinder-text-xl);
    font-weight: 600;
  }

  .weft-schedule-list__subtitle {
    margin: 2px 0 0;
    font-size: var(--cinder-text-xs);
    color: var(--cinder-text-subtle);
  }

  .weft-schedule-list__header-actions {
    display: flex;
    align-items: center;
    gap: var(--cinder-space-2, 0.5rem);
    flex-wrap: wrap;
  }

  .weft-schedule-list__scope-pill {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 6px 10px;
    background: var(--cinder-surface-raised);
    border: 1px solid var(--cinder-border);
    border-radius: var(--cinder-radius-md);
    font-size: var(--cinder-text-2xs);
    color: var(--cinder-text-subtle);
    box-shadow: var(--cinder-shadow-sm);
  }

  .weft-schedule-list__filters {
    display: flex;
    gap: var(--cinder-space-2, 0.5rem);
    flex-wrap: wrap;
    align-items: center;
  }

  .weft-schedule-list__filters > :global(*) {
    min-width: 150px;
  }

  .weft-schedule-list__skeleton {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  :global(.weft-schedule-list__row) {
    cursor: pointer;
  }

  :global(.weft-schedule-list__id) {
    font-family: var(--cinder-font-mono);
    font-size: var(--cinder-text-sm);
  }

  .weft-schedule-list__id-link {
    color: inherit;
    text-decoration: none;
  }

  @media (hover: hover) {
    .weft-schedule-list__id-link:hover {
      text-decoration: underline;
    }
  }

  :global(.weft-schedule-list__mono) {
    font-family: var(--cinder-font-mono);
    font-size: var(--cinder-text-xs);
    color: var(--cinder-text-subtle);
  }

  .weft-sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
