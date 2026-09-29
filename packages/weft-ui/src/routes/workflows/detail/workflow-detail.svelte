<script lang="ts">
  /**
   * Workflow detail entry (plan T2.4–T2.7, Phase 2 gate). Owns the
   * `client.get(id)` query, the header's cancel/suspend/resume/force-timeout
   * mutations, the "Run query" callback, URL-synced tab workflow, and the fleet
   * feed subscription that gives the header/Overview live status updates
   * (`applyFleetEventFrame` invalidates `queryKeys.workflows.detail(id)` on
   * any fleet event naming this workflow — the "signal → advance → watch it
   * resume live" path from the Phase 2 gate, without needing the
   * per-workflow tail the dev harness can't serve yet — see `events-tab.svelte`).
   *
   * Reads `router.current.params.id` directly rather than a prop — matches
   * `route-outlet.svelte`'s contract (mounts route components with no
   * props; every domain's `index.svelte` self-sources its own params, and
   * the outlet's `{#key router.pathname}` guarantees a fresh mount on every
   * workflow id change).
   *
   * ## Track A3 additions (Phase 3)
   *
   * Three small, deliberately minimal edits landed here from the Timeline
   * track, flagged per PROJECT-BRIEF's shared-file allowance:
   * 1. `./workflow-detail.css` was authored with a module-doc comment
   *    claiming it's "imported directly from `workflow-detail.svelte`'s
   *    `<script>` block" — but no such import ever existed, so the whole
   *    Overview/Events/Signals/etc. CSS class set (`.weft-workflow-detail__*`,
   *    `.weft-send-tab__*`, …) was rendering completely unstyled. Fixed here
   *    (pre-existing bug in a file this track touches — per this repo's
   *    CLAUDE.md, fixed rather than reported).
   * 2. A `checkpoints` tab (T3.3) was added to the tab list/panel — the
   *    Timeline track owns `checkpoints-tab.svelte`.
   * 3. `WorkflowLiveObservations` (T3.4 — async-activity completion tokens)
   *    is instantiated HERE, not inside `timeline-tab.svelte`, so it
   *    subscribes as early as this track's files can reach — but that turns
   *    out not to be early enough: see
   *    `timeline/workflow-live-observations.svelte.ts`'s module doc for the
   *    empirically-confirmed finding that `src/app/shell/shell.svelte`'s
   *    `EngineStatusController` always wins the shared `FleetEventSource`'s
   *    one-time replay first, regardless. Kept here anyway because it is
   *    still the earliest reachable point AND it correctly handles frames
   *    that arrive live (after mount), which is a real, tested behavior
   *    independent of the replay-timing gap.
   *
   * ## Finalizer status (weft#732 item 4, shipped 0.15.0)
   *
   * `finalizerQuery` fetches `weft.workflows.finalizer.get` alongside the
   * workflow itself and is the ONE fetch both the header badge and the
   * Timeline tab's finalizer strip render from (`workflow-observability.ts`'s
   * module doc) — no more session-scoped live-event guessing. Enabled only
   * while `workflow.status` is `cancelled`/`timed-out`
   * (`statusMayHaveFinalizer`): every other status can never carry finalizer
   * work (weft's own docs), so there's nothing to fetch. `applyFleetEventFrame`
   * (`cache-integration.ts`) also invalidates this query on any fleet event
   * naming this workflow, so a `pending`/`running` finalizer that settles
   * while this page is open refreshes without a manual reload.
   */
  import { EmptyState, Skeleton, Tabs } from '@lostgradient/cinder';
  import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
  import type { HttpClient } from '@lostgradient/weft';
  import { SearchX } from 'lucide-svelte';
  import { onDestroy, untrack } from 'svelte';

  import { getClient } from '../../../lib/client.ts';
  import { applyFleetEventFrame } from '../../../lib/live-source/cache-integration.ts';
  import { faultTreatment } from '../../../lib/faults.ts';
  import { queryKeys } from '../../../lib/query.ts';
  import { router, workflowDetailPath } from '../../../lib/router.svelte.ts';
  import { getPrincipalStore } from '../../../lib/scopes.svelte.ts';
  import { fetchActiveWorkflowRevision } from '../../../lib/workflow-revision.ts';
  import { getFleetEventSource } from '../../../app/engine-status.svelte.ts';
  import CheckpointsTab from './checkpoints/checkpoints-tab.svelte';
  import ChildrenTab from './children-tab.svelte';
  import EventsTab from './events-tab.svelte';
  import Header from './header.svelte';
  import LogsTab from './logs-tab.svelte';
  import OverviewTab from './overview-tab.svelte';
  import SignalsTab from './signals-tab.svelte';
  import TimelineTab from './timeline-tab.svelte';
  import { TickingClock } from './ticking-clock.svelte.ts';
  import { WorkflowLiveObservations } from './timeline/workflow-live-observations.svelte.ts';
  import UpdatesTab from './updates-tab.svelte';
  import './workflow-detail.css';
  import { finalizerQueryKey, getFinalizerStatus } from './workflow-observability.ts';
  import { statusMayHaveFinalizer, type WorkflowContextualAction } from './workflow-status.ts';

  const client: HttpClient = getClient();
  const queryClient = useQueryClient();
  const principalStore = getPrincipalStore();
  const clock = new TickingClock();
  onDestroy(() => clock.dispose());

  const id = $derived(router.current.params['id'] ?? '');

  const detailQuery = createQuery(() => ({
    queryKey: queryKeys.workflows.detail(id),
    queryFn: () => client.get(id),
  }));

  // See module doc "Finalizer status". `enabled` reads the JUST-fetched
  // workflow status reactively (not `untrack()`ed) — unlike the fleet
  // subscription/`liveObservations` below, this legitimately needs to
  // re-evaluate if a `cancel`/`force-timeout` mutation flips `workflow.status`
  // into `cancelled`/`timed-out` while this page stays mounted.
  const finalizerQuery = createQuery(() => ({
    queryKey: finalizerQueryKey(id),
    queryFn: () => getFinalizerStatus(client, id),
    enabled: statusMayHaveFinalizer(detailQuery.data?.status ?? 'pending'),
  }));

  // Active-revision comparison (WFT-117): mirrors `finalizerQuery`'s
  // enabled-gating precedent (only once `detailQuery` has resolved a real
  // workflow, so `weft.workflows.active.get` never fires for an empty
  // `type`), reads the just-fetched workflow's `type` reactively (like
  // `finalizerQuery` reads `status`), and is additionally gated on
  // `workflows:read` — the underlying operation's own required scope.
  // Reuses `queryKeys.catalog.active` verbatim (WFT-115, `src/lib/query.ts`)
  // rather than a locally-scoped key, so an operator activating a different
  // revision from the System route invalidates this badge too on next
  // focus/refetch — ordinary TanStack Query staleness, no bespoke cross-tab
  // notification.
  const activeRevisionQuery = createQuery(() => ({
    queryKey: queryKeys.catalog.active(detailQuery.data?.type ?? ''),
    queryFn: () => fetchActiveWorkflowRevision(client, detailQuery.data?.type ?? ''),
    enabled: detailQuery.data != null && principalStore.hasScope('workflows:read'),
  }));

  /**
   * NOT `activeRevisionQuery.data` read directly at the call sites below
   * (Codex review, PR #978, round 5). TanStack Query keeps the PREVIOUS
   * successful `data` around across a failed refetch alongside `isError`
   * true — reading `.data` alone after, say, `workflows:read` is revoked
   * server-side mid-session (the listing's own 403, same class of gap the
   * fork picker's `revisionsForbidden` check already closes) would keep
   * showing the LAST-known active pointer as current fact, potentially
   * labeling a since-superseded run "Active" on stale data presented as
   * fresh. Both `Header` and `OverviewTab` already treat `undefined` as
   * "unresolved/denied/loading" (their own prop docs), so collapsing an
   * error to `undefined` here — mirroring the System Revisions panel's own
   * `activeQuery.isError` branch — reuses that existing semantic instead
   * of inventing a new one.
   */
  const resolvedActiveRevision = $derived(
    activeRevisionQuery.isError ? undefined : activeRevisionQuery.data,
  );

  // Fleet liveness: any event naming this workflow invalidates the detail
  // query, giving header/Overview a fresh status without the per-workflow
  // tail (see module doc). Subscribed once for the component's lifetime —
  // `id` is read as a plain value here deliberately, not reactively: the
  // route outlet's `{#key router.pathname}` guarantees a fresh mount (and
  // therefore a fresh subscription) on every workflow id change, so `id`
  // cannot change under a live subscription. `untrack()` makes that
  // one-time read explicit to Svelte (mirrors `shell.svelte`'s identical
  // `untrack()` convention for its own once-at-init props) instead of
  // triggering the `state_referenced_locally` compiler warning.
  const unsubscribeFleet = getFleetEventSource().subscribe(
    (frame) => applyFleetEventFrame(queryClient, frame),
    { workflowId: untrack(() => id) },
  );
  onDestroy(unsubscribeFleet);

  // See the module doc above: started here (not lazily inside the Timeline
  // tab panel) to maximize the odds of catching the fleet feed's one-time
  // replay of this workflow's async-activity/finalizer-teardown events.
  const liveObservations = new WorkflowLiveObservations(
    getFleetEventSource(),
    queryClient,
    untrack(() => id),
  );
  onDestroy(() => liveObservations.dispose());

  let pendingAction = $state<WorkflowContextualAction | null>(null);

  const ACTION_CALL: Readonly<
    Record<WorkflowContextualAction, (workflowId: string) => Promise<unknown>>
  > = {
    cancel: (workflowId) => client.cancel(workflowId),
    suspend: (workflowId) => client.suspend(workflowId),
    resume: (workflowId) => client.resume(workflowId),
    'force-timeout': (workflowId) => client.timeout(workflowId),
  };

  const actionMutation = createMutation(() => ({
    mutationFn: (action: WorkflowContextualAction) => ACTION_CALL[action](id),
    onMutate: (action) => {
      pendingAction = action;
    },
    onSettled: () => {
      pendingAction = null;
      void queryClient.invalidateQueries({ queryKey: queryKeys.workflows.detail(id) });
    },
  }));

  function handleAction(action: WorkflowContextualAction): void {
    actionMutation.mutate(action);
  }

  async function runQuery(name: string, inputText: string): Promise<unknown> {
    const trimmed = inputText.trim();
    const input = trimmed.length === 0 ? undefined : (JSON.parse(trimmed) as unknown);
    return client.query(id, name, input);
  }

  // URL owns tab workflow (plan §4): `activeTab` is a local mirror kept in sync
  // both directions — `Tabs` writes to it via `bind:value` on every click,
  // which the first effect below pushes into the URL; the second effect
  // pulls an externally-changed URL (e.g. the browser back button) back into
  // this mirror. Each effect only writes when its target actually differs,
  // so the two converge in one round trip rather than looping.
  let activeTab = $state(router.search.get('tab') ?? 'overview');

  $effect(() => {
    const next = activeTab;
    const search = new URLSearchParams(router.search);
    if (search.get('tab') === next) return;
    search.set('tab', next);
    router.navigate(workflowDetailPath(id, search), {
      replace: true,
    });
  });

  $effect(() => {
    const fromUrl = router.search.get('tab') ?? 'overview';
    if (fromUrl !== activeTab) activeTab = fromUrl;
  });

  function navigateToTab(tab: string): void {
    activeTab = tab;
  }

  const notFound = $derived(detailQuery.isSuccess && detailQuery.data === null);
  const treatment = $derived(detailQuery.isError ? faultTreatment(detailQuery.error) : null);
</script>

<div class="weft-workflow-detail">
  {#if detailQuery.isPending}
    <div class="weft-workflow-detail__loading" aria-busy="true" aria-label="Loading workflow">
      <Skeleton height="2rem" width="40%" />
      <Skeleton height="8rem" />
    </div>
  {:else if notFound}
    <div class="weft-workflow-detail__not-found">
      <EmptyState
        title="No workflow found"
        description={`No workflow found with id "${id}". It may have been purged, or the id may be mistyped.`}
      >
        {#snippet icon()}<SearchX aria-hidden="true" size={22} />{/snippet}
        {#snippet action()}
          <a
            href={router.href('/workflows')}
            onclick={(event) => {
              event.preventDefault();
              router.navigate('/workflows');
            }}
          >
            Back to workflows
          </a>
        {/snippet}
      </EmptyState>
    </div>
  {:else if treatment}
    <div
      class="weft-workflow-detail__fault"
      data-tone={treatment.kind === 'not-found' ? 'neutral' : 'danger'}
      role="alert"
    >
      <div class="weft-workflow-detail__fault-banner">
        <p class="weft-workflow-detail__fault-message">{treatment.message}</p>
      </div>
      {#if treatment.kind === 'internal' && treatment.tryViaJsonRpc}
        <p class="weft-workflow-detail__fault-message">
          The REST API hides internal error detail on this response — the same request over JSON-RPC
          returns the full fault.
        </p>
      {/if}
    </div>
  {:else if detailQuery.data}
    {@const workflow = detailQuery.data}
    <Header
      {workflow}
      now={clock.now}
      {pendingAction}
      onAction={handleAction}
      {activeTab}
      onNavigateToTab={navigateToTab}
      finalizerStatus={finalizerQuery.data}
      onRunQuery={runQuery}
      activeRevision={resolvedActiveRevision}
    />

    <div class="weft-workflow-detail__tab-scroll">
      <Tabs bind:value={activeTab}>
        <Tabs.List label="Workflow detail sections" class="weft-workflow-detail__tab-list">
          <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
          <Tabs.Trigger value="timeline">Timeline</Tabs.Trigger>
          <Tabs.Trigger value="events">Events</Tabs.Trigger>
          <Tabs.Trigger value="logs">Logs</Tabs.Trigger>
          <Tabs.Trigger value="checkpoints">Checkpoints</Tabs.Trigger>
          <Tabs.Trigger value="signals">Signals</Tabs.Trigger>
          <Tabs.Trigger value="updates">Updates</Tabs.Trigger>
          <Tabs.Trigger value="children">Children</Tabs.Trigger>
        </Tabs.List>

        <div class="weft-workflow-detail__content">
          <Tabs.Panel value="overview"
            ><OverviewTab {client} {workflow} activeRevision={resolvedActiveRevision} /></Tabs.Panel
          >
          <Tabs.Panel value="timeline"
            ><TimelineTab
              {client}
              {workflow}
              {liveObservations}
              finalizerStatus={finalizerQuery.data}
            /></Tabs.Panel
          >
          <Tabs.Panel value="events"><EventsTab {client} {workflow} /></Tabs.Panel>
          <Tabs.Panel value="logs"><LogsTab /></Tabs.Panel>
          <Tabs.Panel value="checkpoints"
            ><CheckpointsTab
              {client}
              workflowId={workflow.id}
              workflowType={workflow.type}
              sourceRevision={workflow.revision}
            /></Tabs.Panel
          >
          <Tabs.Panel value="signals"><SignalsTab {client} {workflow} /></Tabs.Panel>
          <Tabs.Panel value="updates"><UpdatesTab {client} {workflow} /></Tabs.Panel>
          <Tabs.Panel value="children"><ChildrenTab {client} {workflow} /></Tabs.Panel>
        </div>
      </Tabs>
    </div>
  {/if}
</div>
