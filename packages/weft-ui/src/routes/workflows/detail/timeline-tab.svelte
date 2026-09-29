<script lang="ts">
  /**
   * Timeline tab (plan T3.1/T3.2, design §E linked selection + §F
   * branch/saga cards): `RunStepTimeline` from `getTimeline()`, quick
   * filters, step-range pagination + jump-to-step, linked selection with
   * Events, the finalizer strip + run-level badges, and the async-activity
   * "awaiting external completion" affordance. See the sibling modules
   * under `./timeline/` and `./async-activity/` for what's real vs.
   * honestly degraded — this component is orchestration only.
   *
   * ## Step selection (WFC-7: adopted Cinder's public selection API)
   *
   * Cinder 0.24.0 added `selectedStepId`/`onStepSelect` to
   * `RunStepTimeline` itself, so the click/keyboard/ARIA selection UI is
   * Cinder's own now — a native, focusable control per row (`Select
   * <label>`, `aria-pressed`) that Cinder renders and manages, including
   * ignoring clicks that land on interactive descendants (so it composes
   * cleanly with the async-activity "Complete…" button rendered in the
   * `children` snippet below). We just wire `selection.selectedStepId` and
   * `selectTimelineStep` straight through. See
   * `./timeline/run-step-timeline-selection.ts`'s module doc for the
   * DOM-composition workaround this replaced, and for the divergence
   * highlighting that's unrelated and still needed.
   */
  import {
    Badge,
    Button,
    EmptyState,
    Input,
    RunStepTimeline,
    type RunStepTimelineEntry,
    SegmentedControl,
    Segment,
    Skeleton,
  } from '@lostgradient/cinder';
  import { createQuery, useQueryClient } from '@tanstack/svelte-query';
  import type {
    WeftClientActivity,
    HttpClient,
    WorkflowFinalizerStatus,
    WorkflowState,
  } from '@lostgradient/weft';
  import { Clock, Link, X } from 'lucide-svelte';
  import { untrack } from 'svelte';

  import { attachPendingActivitiesToSteps } from './async-activity/async-activity-matching.ts';
  import {
    pendingAsyncActivitiesQueryKey,
    pendingAsyncActivityObservations,
    PENDING_ASYNC_ACTIVITY_OPERATION,
  } from './async-activity/async-activity-query.ts';
  import AsyncActivityDrawer from './async-activity/async-activity-drawer.svelte';
  import FinalizerStrip from './timeline/finalizer-strip.svelte';
  import {
    TIMELINE_QUICK_FILTERS,
    filterTimelineEntries,
    needsTimelinePagination,
    timelineEntriesForPage,
    timelinePageCount,
    timelinePageForStep,
    timelineQuickFilterLabel,
    type TimelineQuickFilter,
  } from './timeline/timeline-filters.ts';
  import { mapTimelineToSteps } from './timeline/timeline-mapping.ts';
  import {
    clearTimelineSelection,
    selectTimelineStep,
    timelineSelectionFor,
  } from './timeline/timeline-selection-store.svelte.ts';
  import type { WorkflowLiveObservations } from './timeline/workflow-live-observations.svelte.ts';
  import { workflowTimelineQueryKey } from './workflow-timeline-data.ts';

  interface TimelineTabProps {
    readonly client: Pick<HttpClient, 'getTimeline'> & {
      readonly operations: Pick<HttpClient['operations'], typeof PENDING_ASYNC_ACTIVITY_OPERATION>;
      readonly activity: Pick<WeftClientActivity, 'complete' | 'completeExceptionally'>;
    };
    readonly workflow: WorkflowState;
    readonly liveObservations: WorkflowLiveObservations;
    /** `weft.workflows.finalizer.get` result, fetched once by `workflow-detail.svelte` and shared with the header badge — see `finalizer-strip.svelte`'s module doc. */
    readonly finalizerStatus: WorkflowFinalizerStatus | null | undefined;
  }

  let { client, workflow, liveObservations, finalizerStatus }: TimelineTabProps = $props();

  const timelineQuery = createQuery(() => ({
    queryKey: workflowTimelineQueryKey(workflow.id),
    queryFn: () => client.getTimeline(workflow.id),
  }));

  const queryClient = useQueryClient();
  const pendingAsyncActivitiesQuery = createQuery(() => ({
    queryKey: pendingAsyncActivitiesQueryKey(workflow.id),
    queryFn: () =>
      client.operations[PENDING_ASYNC_ACTIVITY_OPERATION]({
        workflowId: workflow.id,
        limit: 200,
      }),
  }));

  const entries = $derived(timelineQuery.data ?? []);

  let quickFilter = $state<TimelineQuickFilter>('all');
  const filteredEntries = $derived(filterTimelineEntries(entries, quickFilter));

  let pageIndex = $state(0);

  function changeQuickFilter(next: TimelineQuickFilter): void {
    quickFilter = next;
    pageIndex = 0;
  }
  const paginated = $derived(needsTimelinePagination(filteredEntries.length));
  const pageCount = $derived(timelinePageCount(filteredEntries.length));
  const pageEntries = $derived(
    paginated ? timelineEntriesForPage(filteredEntries, pageIndex) : filteredEntries,
  );

  const steps: RunStepTimelineEntry[] = $derived(mapTimelineToSteps(pageEntries));

  // Called once at component init, not reactively: `timelineSelectionFor`
  // both reads AND (conditionally) mutates the shared module-level store,
  // which Svelte forbids inside a `$derived` evaluation. `workflow.id` is
  // stable for this component's whole lifetime regardless (the route
  // outlet's `{#key router.pathname}` guarantees a fresh mount per workflow
  // id change — see `timeline-selection-store.svelte.ts`'s module doc).
  // `untrack()` makes that one-time read explicit instead of triggering the
  // `state_referenced_locally` compiler warning.
  const selection = timelineSelectionFor(untrack(() => workflow.id));

  let jumpToStepText = $state('');

  function jumpToStep(): void {
    const step = Number(jumpToStepText.trim());
    if (!Number.isSafeInteger(step)) return;
    const target = timelinePageForStep(filteredEntries, step);
    if (target !== null) pageIndex = target;
  }

  const attachedPendingActivities = $derived(
    attachPendingActivitiesToSteps(
      pendingAsyncActivityObservations(pendingAsyncActivitiesQuery.data?.items ?? []),
      entries,
    ),
  );
  const unattachedPendingActivities = $derived(
    attachedPendingActivities.filter((activity) => activity.stepId === null),
  );

  let openDrawerToken = $state<string | null>(null);
  const openActivity = $derived(
    attachedPendingActivities.find((activity) => activity.token === openDrawerToken) ?? null,
  );

  function closeDrawer(): void {
    openDrawerToken = null;
  }

  function handleResolved(token: string): void {
    liveObservations.forgetToken(token);
    void queryClient.invalidateQueries({
      queryKey: pendingAsyncActivitiesQueryKey(workflow.id),
    });
    openDrawerToken = null;
  }
</script>

<div class="weft-timeline-tab">
  <FinalizerStrip baseStatus={workflow.status} status={finalizerStatus} />

  {#if unattachedPendingActivities.length > 0}
    <div class="weft-timeline-tab__unattached">
      {#each unattachedPendingActivities as activity (activity.token)}
        <div class="weft-timeline-tab__unattached-row">
          <Badge variant="warning">
            <Clock aria-hidden="true" size={11} />
            Awaiting external completion
          </Badge>
          <span class="weft-timeline-tab__unattached-name">{activity.activityName}</span>
          <span class="weft-timeline-tab__unattached-note">
            Couldn't link this to a single timeline step — see the run's Complete list.
          </span>
          <Button
            variant="ghost"
            size="sm"
            label="Complete…"
            onclick={() => (openDrawerToken = activity.token)}
          />
        </div>
      {/each}
    </div>
  {/if}

  {#if timelineQuery.isPending}
    <div style="padding: 15px;"><Skeleton height="8rem" /></div>
  {:else if entries.length === 0}
    <EmptyState
      title="No timeline entries yet"
      description="Durable operations this run has performed will appear here as it executes."
    />
  {:else}
    <div class="weft-timeline-tab__toolbar">
      <SegmentedControl
        id={`timeline-quick-filter-${workflow.id}`}
        label="Quick filter"
        labelVisible={false}
        density="toolbar"
        value={quickFilter}
        onValueChange={changeQuickFilter}
      >
        {#each TIMELINE_QUICK_FILTERS as filter (filter)}
          <Segment value={filter}>{timelineQuickFilterLabel(filter)}</Segment>
        {/each}
      </SegmentedControl>

      {#if paginated}
        <nav class="weft-timeline-tab__pagination" aria-label="Timeline pagination">
          <Button
            variant="ghost"
            size="sm"
            label="Previous"
            disabled={pageIndex === 0}
            onclick={() => (pageIndex = Math.max(0, pageIndex - 1))}
          />
          <span class="weft-timeline-tab__page-label">Page {pageIndex + 1} of {pageCount}</span>
          <Button
            variant="ghost"
            size="sm"
            label="Next"
            disabled={pageIndex >= pageCount - 1}
            onclick={() => (pageIndex = Math.min(pageCount - 1, pageIndex + 1))}
          />
          <Input
            id={`timeline-jump-to-step-${workflow.id}`}
            label="Jump to step"
            labelVisible={false}
            placeholder="Jump to step"
            inputmode="numeric"
            bind:value={jumpToStepText}
            onkeydown={(event) => {
              if (event.key === 'Enter') jumpToStep();
            }}
          />
          <Button variant="ghost" size="sm" label="Go" onclick={jumpToStep} />
        </nav>
      {/if}
    </div>

    {#if filteredEntries.length === 0}
      <EmptyState title="No steps match this filter" description="Try a different quick filter." />
    {:else}
      <RunStepTimeline
        {steps}
        label={`${workflow.type} timeline`}
        selectedStepId={selection.selectedStepId}
        onStepSelect={selectTimelineStep}
      >
        {#snippet children(step)}
          {#if attachedPendingActivities.some((activity) => activity.stepId === step.id)}
            {@const activity = attachedPendingActivities.find(
              (candidate) => candidate.stepId === step.id,
            )}
            {#if activity}
              <div class="weft-timeline-tab__step-async">
                <Badge variant="warning">
                  <Clock aria-hidden="true" size={11} />
                  Awaiting external completion
                </Badge>
                <Button
                  variant="secondary"
                  size="sm"
                  label="Complete…"
                  onclick={() => (openDrawerToken = activity.token)}
                />
              </div>
            {/if}
          {/if}
        {/snippet}
      </RunStepTimeline>
    {/if}
  {/if}

  {#if selection.selectedStepId !== null}
    <div class="weft-timeline-tab__selection-chip">
      <Link aria-hidden="true" size={12} />
      Selected — Events filtered to this step
      <button
        type="button"
        class="weft-timeline-tab__selection-clear"
        onclick={clearTimelineSelection}
      >
        <X aria-hidden="true" size={11} />
        Clear
      </button>
    </div>
  {/if}
</div>

{#if openActivity}
  <AsyncActivityDrawer
    {client}
    open={true}
    activity={openActivity}
    onClose={closeDrawer}
    onResolved={handleResolved}
  />
{/if}

<style>
  .weft-timeline-tab {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 15px;
  }

  .weft-timeline-tab__unattached {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .weft-timeline-tab__unattached-row {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 8px 12px;
    background: var(--cinder-surface-inset);
    border-radius: var(--cinder-radius-md);
    font-size: var(--cinder-text-xs);
  }

  .weft-timeline-tab__unattached-name {
    font-weight: 600;
  }

  .weft-timeline-tab__unattached-note {
    flex: 1;
    color: var(--cinder-text-disabled);
    font-size: var(--cinder-text-2xs);
  }

  .weft-timeline-tab__toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .weft-timeline-tab__pagination {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-inline-start: auto;
  }

  .weft-timeline-tab__page-label {
    font-size: var(--cinder-text-2xs);
    color: var(--cinder-text-subtle);
    white-space: nowrap;
  }

  .weft-timeline-tab__step-async {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 6px;
  }

  .weft-timeline-tab__selection-chip {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 7px 10px;
    background: color-mix(in oklch, var(--cinder-accent), transparent 92%);
    border-radius: var(--cinder-radius-md);
    font-size: var(--cinder-text-2xs);
    color: var(--cinder-accent-text);
  }

  .weft-timeline-tab__selection-clear {
    margin-inline-start: auto;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-height: 24px;
  }
</style>
