<script lang="ts">
  /**
   * Schedule detail (Track B, plan §9.3; design `Weft UI.dc.html`
   * "Schedule detail"): spec + next-5-fires preview, overlap policy with
   * consequence text, current/queued runs, recent runs, live update on
   * `schedule:fired`/`schedule:missed-fire` via the shared
   * `FleetEventSource`.
   *
   * **"Recent runs" is real, persisted history, not a live-only
   * accumulator.** Earlier revisions of this page could only show fires
   * observed live since the page loaded — weft had no queryable link from a
   * schedule back to the workflow runs it launched (filed as
   * https://github.com/stevekinney/weft/issues/735). Weft 0.13
   * (https://github.com/stevekinney/weft/pull/759) added a `scheduleId`
   * filter to `weft.workflows.list`, so `fetchScheduleRunHistory`
   * (`schedule-queries.ts`) now queries the real history directly. The fleet
   * subscription below still matters for LIVE freshness — refetching the
   * moment a `schedule:fired`/`schedule:missed-fire` event arrives rather
   * than waiting on the query's own staleness — but is no longer the only
   * source of this data.
   */
  import {
    Badge,
    Button,
    Callout,
    Card,
    ConfirmDialog,
    ConnectionIndicator,
    DescriptionList,
    EmptyState,
    Skeleton,
    StatusDot,
  } from '@lostgradient/cinder';
  import { Info, Pause, Pencil, Play, XCircle } from 'lucide-svelte';

  import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';

  import { getFleetEventSource } from '../../app/engine-status.svelte.ts';
  import { getClient } from '../../lib/client.ts';
  import { faultTreatment } from '../../lib/faults.ts';
  import { computeNextFires } from '../../lib/format/cron-preview.ts';
  import { formatRelativeTime, truncateId } from '../../lib/format/index.ts';
  import { router, workflowDetailPath } from '../../lib/router.svelte.ts';
  import { getPrincipalStore, scopeGate } from '../../lib/scopes.svelte.ts';
  import { workflowStatusPresentation } from '../workflows/detail/workflow-status.ts';
  import { cadenceToScheduleValue, describeCadence } from './cadence.ts';
  import FaultBanner from './fault-banner.svelte';
  import { overlapConsequence, overlapLabel } from './overlap-policy.ts';
  import { revisionPolicyLabel } from './revision-policy.ts';
  import {
    cancelSchedule,
    fetchScheduleDetail,
    fetchScheduleRunHistory,
    pauseSchedule,
    resumeSchedule,
    scheduleDetailQueryKey,
    scheduleRunHistoryQueryKey,
  } from './schedule-queries.ts';
  import { scheduleStatusDescriptor } from './schedule-status.ts';

  interface Props {
    id: string;
  }

  let { id }: Props = $props();

  const client = getClient();
  const principal = getPrincipalStore();
  const queryClient = useQueryClient();
  const fleetSource = getFleetEventSource();

  const detailQuery = createQuery(() => ({
    queryKey: scheduleDetailQueryKey(id),
    queryFn: () => fetchScheduleDetail(client, id),
  }));

  const historyQuery = createQuery(() => ({
    queryKey: scheduleRunHistoryQueryKey(id),
    queryFn: () => fetchScheduleRunHistory(client, id),
  }));

  function invalidateDetail(): void {
    void queryClient.invalidateQueries({ queryKey: scheduleDetailQueryKey(id) });
    void queryClient.invalidateQueries({ queryKey: scheduleRunHistoryQueryKey(id) });
  }

  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  // A plain `$effect` (not `$derived`) owns the subscription lifecycle
  // deliberately: `$effect`'s cleanup runs BEFORE the next run whenever `id`
  // changes, so the previous schedule's live subscription is always
  // disposed before a new one opens — `$derived` has no equivalent
  // teardown-before-recompute hook, which would leak a subscription per
  // navigation between two schedule detail pages.
  $effect(() => {
    return fleetSource.subscribe((frame) => {
      if (frame.kind !== 'schedule:fired' && frame.kind !== 'schedule:missed-fire') return;
      if (!isRecord(frame.payload) || frame.payload['scheduleId'] !== id) return;
      invalidateDetail();
    });
  });

  const writeGate = $derived(scopeGate(principal, ['schedules:write']));

  const pauseMutation = createMutation(() => ({
    mutationFn: () => pauseSchedule(client, id),
    onSuccess: invalidateDetail,
  }));
  const resumeMutation = createMutation(() => ({
    mutationFn: () => resumeSchedule(client, id),
    onSuccess: invalidateDetail,
  }));
  const cancelMutation = createMutation(() => ({
    mutationFn: () => cancelSchedule(client, id),
    onSuccess: invalidateDetail,
  }));

  let cancelDialogOpen = $state(false);

  function openEdit(): void {
    router.navigate(`/schedules?id=${encodeURIComponent(id)}&edit=1`);
  }

  function backToList(): void {
    router.navigate('/schedules');
  }
</script>

<div class="weft-schedule-detail">
  <button type="button" class="weft-schedule-detail__back" onclick={backToList}>
    ← Back to schedules
  </button>

  {#if detailQuery.isPending}
    <div role="status" aria-busy="true" aria-label="Loading schedule">
      <Skeleton height="120px" />
      <Skeleton height="220px" />
    </div>
  {:else if detailQuery.isError}
    <FaultBanner
      treatment={faultTreatment(detailQuery.error)}
      onRetry={() => void detailQuery.refetch()}
    />
  {:else if detailQuery.data === null}
    <EmptyState
      title="Schedule not found"
      description={`No schedule with id "${id}" exists — it may have been cancelled and purged.`}
    >
      {#snippet action()}
        <Button variant="secondary" size="sm" onclick={backToList}>Back to schedules</Button>
      {/snippet}
    </EmptyState>
  {:else}
    {@const schedule = detailQuery.data}
    {@const status = scheduleStatusDescriptor(schedule.status)}
    {@const cadenceValue = cadenceToScheduleValue(schedule)}
    {@const nextFires = computeNextFires(cadenceValue, 5)}

    <div class="weft-schedule-detail__header">
      <div>
        <div class="weft-schedule-detail__title-row">
          <h1 class="weft-schedule-detail__id">{schedule.id}</h1>
          <Badge variant={status.variant}>{status.label}</Badge>
          {#if schedule.missedFireCount > 0}
            <Badge variant="warning">{schedule.missedFireCount} missed</Badge>
          {/if}
          <ConnectionIndicator status={fleetSource.status} />
        </div>
        <span class="weft-schedule-detail__subtitle">
          {schedule.workflowType} · {describeCadence(schedule)}
        </span>
      </div>
      <div class="weft-schedule-detail__actions">
        {#if schedule.status !== 'cancelled'}
          <Button
            variant="secondary"
            size="sm"
            disabled={writeGate.disabled}
            title={writeGate.title}
            onclick={() =>
              schedule.status === 'paused' ? resumeMutation.mutate() : pauseMutation.mutate()}
          >
            {#if schedule.status === 'paused'}
              <Play aria-hidden="true" size={14} /> Resume
            {:else}
              <Pause aria-hidden="true" size={14} /> Pause
            {/if}
          </Button>
        {/if}
        <Button variant="secondary" size="sm" onclick={openEdit}>
          <Pencil aria-hidden="true" size={14} /> Edit
        </Button>
        {#if schedule.status !== 'cancelled'}
          <Button
            variant="ghost"
            size="sm"
            disabled={writeGate.disabled}
            title={writeGate.title}
            onclick={() => (cancelDialogOpen = true)}
          >
            <XCircle aria-hidden="true" size={14} /> Cancel
          </Button>
        {/if}
      </div>
    </div>

    <div class="weft-schedule-detail__grid">
      <Card title="Specification">
        <DescriptionList
          items={[
            {
              term: schedule.cronExpression !== undefined ? 'Cron' : 'Interval',
              definition:
                schedule.cronExpression ??
                (schedule.intervalMs !== undefined ? `${schedule.intervalMs}ms` : '—'),
            },
            { term: 'Jitter', definition: schedule.jitterMs ? `±${schedule.jitterMs}ms` : 'None' },
            {
              term: 'Next fire',
              definition:
                schedule.nextFireAt !== null ? formatRelativeTime(schedule.nextFireAt) : '—',
            },
            { term: 'Missed fires', definition: String(schedule.missedFireCount) },
            {
              term: 'Revision policy',
              definition:
                schedule.revisionPolicy === 'pinned' && schedule.pinnedRevision !== undefined
                  ? `${revisionPolicyLabel(schedule.revisionPolicy)} (${schedule.pinnedRevision})`
                  : revisionPolicyLabel(schedule.revisionPolicy),
            },
          ]}
        />
        <div class="weft-schedule-detail__next-fires">
          <div class="weft-schedule-detail__panel-label">Next 5 fires</div>
          {#if schedule.status === 'active' && nextFires.length > 0}
            <ul class="weft-schedule-detail__fires-list">
              {#each nextFires as fire (fire.id)}
                <li>{fire.label}</li>
              {/each}
            </ul>
          {:else}
            <p class="weft-schedule-detail__muted">
              Not scheduled — schedule is {status.label.toLowerCase()}.
            </p>
          {/if}
        </div>
      </Card>

      <div class="weft-schedule-detail__side">
        <Callout variant="info" title={`Overlap policy: ${overlapLabel(schedule.overlap)}`}>
          {#snippet icon()}
            <Info aria-hidden="true" size={17} />
          {/snippet}
          {overlapConsequence(schedule.overlap)}
        </Callout>

        <Card title="Current & queued runs">
          {#if schedule.currentWorkflowId !== undefined}
            <a
              class="weft-schedule-detail__current-run"
              href={router.href(workflowDetailPath(schedule.currentWorkflowId))}
            >
              <StatusDot status="online" labelVisible={false} />
              <span class="weft-schedule-detail__mono"
                >{truncateId(schedule.currentWorkflowId)}</span
              >
              <Badge variant="success" class="weft-schedule-detail__current-run-badge"
                >running</Badge
              >
            </a>
          {/if}
          {#if schedule.queuedRuns.length > 0}
            <ul class="weft-schedule-detail__runs-list weft-schedule-detail__queued">
              {#each schedule.queuedRuns as queued (queued.workflowId)}
                <li>
                  <a
                    class="weft-schedule-detail__mono"
                    href={router.href(workflowDetailPath(queued.workflowId))}
                  >
                    {truncateId(queued.workflowId)}
                  </a>
                  <span class="weft-schedule-detail__muted"
                    >queued {formatRelativeTime(queued.queuedAt)}</span
                  >
                </li>
              {/each}
            </ul>
          {/if}
          {#if schedule.currentWorkflowId === undefined && schedule.queuedRuns.length === 0}
            <p class="weft-schedule-detail__muted">No active or queued runs.</p>
          {/if}
        </Card>
      </div>
    </div>

    <Card title="Recent runs">
      {#if historyQuery.isPending}
        <Skeleton height="80px" />
      {:else if historyQuery.isError}
        <FaultBanner
          treatment={faultTreatment(historyQuery.error)}
          onRetry={() => void historyQuery.refetch()}
        />
      {:else if historyQuery.data.items.length === 0}
        <p class="weft-schedule-detail__muted">No runs yet — this schedule hasn't fired.</p>
      {:else}
        <ul class="weft-schedule-detail__runs-list">
          {#each historyQuery.data.items as run (run.id)}
            {@const status = workflowStatusPresentation(run.status)}
            <li>
              <a class="weft-schedule-detail__mono" href={router.href(workflowDetailPath(run.id))}>
                {truncateId(run.id)}
              </a>
              <Badge variant={status.variant}>{status.label}</Badge>
              <span class="weft-schedule-detail__muted">{formatRelativeTime(run.createdAt)}</span>
            </li>
          {/each}
        </ul>
      {/if}
    </Card>

    <ConfirmDialog
      bind:open={cancelDialogOpen}
      title="Cancel this schedule?"
      description={`"${schedule.id}" will stop firing. This can't be undone — create a new schedule to resume this cadence.`}
      confirmLabel="Cancel schedule"
      destructive
      onConfirm={() => cancelMutation.mutate()}
    />
  {/if}
</div>

<style>
  .weft-schedule-detail {
    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-4, 1rem);
    max-width: 1040px;
    margin: 0 auto;
    padding: 18px 24px 60px;
  }

  .weft-schedule-detail__back {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 0;
    background: transparent;
    color: var(--cinder-text-subtle);
    font: inherit;
    font-size: var(--cinder-text-sm);
    cursor: pointer;
    padding: 0;
  }

  .weft-schedule-detail__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 14px;
    flex-wrap: wrap;
  }

  .weft-schedule-detail__title-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 5px;
    flex-wrap: wrap;
  }

  .weft-schedule-detail__id {
    margin: 0;
    font-size: var(--cinder-text-lg);
    font-weight: 600;
    font-family: var(--cinder-font-mono);
  }

  .weft-schedule-detail__subtitle {
    font-size: var(--cinder-text-sm);
    color: var(--cinder-text-subtle);
  }

  .weft-schedule-detail__actions {
    display: flex;
    gap: 7px;
    flex-wrap: wrap;
  }

  .weft-schedule-detail__grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    align-items: start;
  }

  @media (max-width: 900px) {
    .weft-schedule-detail__grid {
      grid-template-columns: 1fr;
    }
  }

  .weft-schedule-detail__side {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .weft-schedule-detail__next-fires {
    padding-top: 11px;
    margin-top: 11px;
    border-top: 1px solid var(--cinder-border-muted);
  }

  .weft-schedule-detail__panel-label {
    font-size: var(--cinder-text-xs);
    color: var(--cinder-text-subtle);
    margin-bottom: 6px;
  }

  .weft-schedule-detail__fires-list {
    display: flex;
    flex-direction: column;
    gap: 3px;
    margin: 0;
    padding: 0;
    list-style: none;
    font-family: var(--cinder-font-mono);
    font-size: var(--cinder-text-xs);
    color: var(--cinder-text-muted);
  }

  .weft-schedule-detail__muted {
    margin: 0;
    font-size: var(--cinder-text-xs);
    color: var(--cinder-text-disabled);
  }

  .weft-schedule-detail__current-run {
    display: flex;
    align-items: center;
    gap: 9px;
    text-decoration: none;
    color: inherit;
  }

  .weft-schedule-detail__current-run :global(.weft-schedule-detail__current-run-badge) {
    margin-inline-start: auto;
  }

  .weft-schedule-detail__queued {
    margin: 0;
    font-size: var(--cinder-text-xs);
    color: var(--cinder-text-muted);
  }

  .weft-schedule-detail__mono {
    font-family: var(--cinder-font-mono);
    font-size: var(--cinder-text-sm);
  }

  .weft-schedule-detail__runs-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .weft-schedule-detail__runs-list li {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .weft-schedule-detail__runs-list li .weft-schedule-detail__muted {
    margin-inline-start: auto;
  }
</style>
