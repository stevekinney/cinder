<script lang="ts">
  /**
   * Workflow detail header (plan T2.4, design `Weft UI.dc.html`
   * "Workflow detail" screen header): copyable truncated id, status badge,
   * tags, deadline countdown, contextual actions
   * (cancel/suspend/resume/force-timeout) with Tier-2 `ConfirmDialog` for the
   * irreversible pair, and Signal/Update/Query as three distinct labeled
   * buttons with semantics tooltips (design: "Fire-and-forget message" /
   * "Request / response, awaits a result" / "Read-only, no workflow change").
   *
   * Dumb component: `workflow-detail.svelte` owns the `client.get(id)` query
   * and the cancel/suspend/resume/force-timeout mutations; this component
   * only renders `workflow` and calls the callback props (same
   * mutation-ownership split as `review-decision-form.svelte`/
   * `reviews-data.ts`, Track D).
   *
   * "Finalizing"/"Cancelled — cleanup failed" sub-statuses ARE rendered here
   * as of weft 0.15.0 — see `workflow-status.ts`'s `finalizerStatusPresentation`
   * module doc (weft#732 item 4). `finalizerStatus` is a plain prop, not
   * fetched here: this stays the dumb-component/mutation-ownership split the
   * module doc above already describes — `workflow-detail.svelte` owns the
   * `weft.workflows.finalizer.get` query and passes the result down, the same
   * way it owns `client.get(id)`.
   *
   * ## `activeRevision` (WFT-117)
   *
   * Same dumb-component split as `finalizerStatus`: `workflow-detail.svelte`
   * owns the `weft.workflows.active.get` fetch (`fetchActiveWorkflowRevision`,
   * `../../../lib/workflow-revision.ts`) and passes the result down.
   * `classifyRevisionAgainstActive` turns `workflow.revision` + this prop
   * into one of four states, each with an icon+text treatment — never color
   * alone, per the acceptance criteria — and every non-`'unpinned'` tooltip
   * carries `EAGER_REVISION_HEDGE` so the WFT-159 eager-registration caveat
   * is visible wherever a revision comparison is shown as authoritative.
   */
  import {
    Badge,
    type BadgeVariant,
    Button,
    ConfirmDialog,
    CopyButton,
    Input,
    Tooltip,
  } from '@lostgradient/cinder';
  import type { WorkflowFinalizerStatus, WorkflowState } from '@lostgradient/weft';
  import {
    ArrowLeftRight,
    Ban,
    CircleCheck,
    CircleX,
    Clock,
    HelpCircle,
    Loader,
    Pause,
    Play,
    Radio,
    TimerOff,
    TriangleAlert,
  } from 'lucide-svelte';

  import { formatDuration, formatRelativeTime, truncateId } from '../../../lib/format/index.ts';
  import {
    classifyRevisionAgainstActive,
    EAGER_REVISION_HEDGE,
    type WorkflowCatalogActivePointerLike,
  } from '../../../lib/workflow-revision.ts';
  import { failureCategoryLabel } from './failure-category.ts';
  import {
    actionConfirmTier,
    actionLabel,
    availableActions,
    finalizerStatusPresentation,
    type WorkflowContextualAction,
  } from './workflow-status.ts';

  interface WorkflowDetailHeaderProps {
    readonly workflow: WorkflowState;
    readonly now: number;
    readonly pendingAction: WorkflowContextualAction | null;
    readonly onAction: (action: WorkflowContextualAction) => void;
    readonly activeTab: string;
    readonly onNavigateToTab: (tab: string) => void;
    /** `weft.workflows.finalizer.get` result — `undefined` while loading, `null` when no finalizer work was recorded. See module doc. */
    readonly finalizerStatus: WorkflowFinalizerStatus | null | undefined;
    /** Runs a read-only query and resolves with its result, or throws. */
    readonly onRunQuery: (name: string, input: string) => Promise<unknown>;
    /**
     * `weft.workflows.active.get` result for `workflow.type` — `undefined`
     * while unresolved (still loading, or `workflows:read` denied), `null`
     * for "never activated." See module doc "`activeRevision` (WFT-117)".
     */
    readonly activeRevision: WorkflowCatalogActivePointerLike | null | undefined;
  }

  let {
    workflow,
    now,
    pendingAction,
    onAction,
    activeTab,
    onNavigateToTab,
    finalizerStatus,
    onRunQuery,
    activeRevision,
  }: WorkflowDetailHeaderProps = $props();

  const presentation = $derived(finalizerStatusPresentation(workflow.status, finalizerStatus));
  const actions = $derived(availableActions(workflow.status));

  const revisionComparison = $derived(
    classifyRevisionAgainstActive(workflow.revision, activeRevision),
  );

  interface RevisionBadgeTreatment {
    readonly icon: typeof CircleCheck;
    readonly variant: BadgeVariant;
    readonly label: string;
  }

  const REVISION_BADGE: Readonly<Record<'active' | 'stale' | 'unknown', RevisionBadgeTreatment>> = {
    active: { icon: CircleCheck, variant: 'success', label: 'Active' },
    stale: { icon: TriangleAlert, variant: 'warning', label: 'Differs from active' },
    unknown: { icon: HelpCircle, variant: 'neutral', label: 'Active revision unknown' },
  };

  // `classifyRevisionAgainstActive` returns `'unpinned'` exactly when
  // `workflow.revision === undefined` (its own implementation), so this
  // equality check narrows `revisionComparison` to `REVISION_BADGE`'s key
  // type without an `as` cast (non-blocking review, PR #978).
  const revisionTreatment = $derived(
    revisionComparison === 'unpinned' ? null : REVISION_BADGE[revisionComparison],
  );
  const RevisionBadgeIcon = $derived(revisionTreatment?.icon);

  const STATUS_ICON = {
    clock: Clock,
    play: Play,
    pause: Pause,
    'circle-check': CircleCheck,
    'circle-x': CircleX,
    ban: Ban,
    'timer-off': TimerOff,
    loader: Loader,
    'triangle-alert': TriangleAlert,
  } as const;

  const StatusIcon = $derived(STATUS_ICON[presentation.icon]);

  const deadlineRemainingMs = $derived(
    workflow.executionDeadline !== undefined ? workflow.executionDeadline - now : null,
  );
  const showDeadline = $derived(
    deadlineRemainingMs !== null &&
      (workflow.status === 'pending' ||
        workflow.status === 'running' ||
        workflow.status === 'suspended'),
  );

  let confirmingAction = $state<WorkflowContextualAction | null>(null);

  function handleActionClick(action: WorkflowContextualAction): void {
    if (actionConfirmTier(action) === 'tier-2') {
      confirmingAction = action;
      return;
    }
    onAction(action);
  }

  function confirmAndClose(): void {
    if (confirmingAction === null) return;
    onAction(confirmingAction);
    confirmingAction = null;
  }

  // -------------------------------------------------------------------------
  // Run query (inline, no dedicated tab — read-only, no send-form history)
  // -------------------------------------------------------------------------
  let queryOpen = $state(false);
  let queryName = $state('');
  let queryInputText = $state('');
  let queryPending = $state(false);
  let queryError = $state<string | null>(null);
  let queryResultText = $state<string | null>(null);

  async function runQuery(): Promise<void> {
    if (queryName.trim().length === 0) return;
    queryPending = true;
    queryError = null;
    queryResultText = null;
    try {
      const result = await onRunQuery(queryName.trim(), queryInputText);
      queryResultText = JSON.stringify(result, null, 2);
    } catch (error) {
      queryError = error instanceof Error ? error.message : 'The query failed.';
    } finally {
      queryPending = false;
    }
  }

  const CONFIRM_COPY: Readonly<Record<WorkflowContextualAction, string>> = {
    cancel:
      'Cancellation is cooperative — the workflow observes a cancellation signal and unwinds via its own cleanup logic. This is irreversible from your perspective.',
    'force-timeout':
      'Forces the workflow into the timed-out terminal workflow, as if its execution deadline had elapsed. Irreversible.',
    suspend: '',
    resume: '',
  };
</script>

<div class="weft-workflow-detail__header">
  <div class="weft-workflow-detail__title-row">
    <div class="weft-workflow-detail__identity">
      <div class="weft-workflow-detail__badges">
        <h1 class="weft-workflow-detail__title">{workflow.type}</h1>
        <Badge variant="accent" monospace>v{workflow.versionTuple.workflowVersion}</Badge>
        {#if workflow.revision !== undefined}
          <Tooltip
            text={`Revision (exact executable artifact): ${workflow.revision}. ${EAGER_REVISION_HEDGE}`}
          >
            <Badge variant="neutral" monospace>rev {truncateId(workflow.revision)}</Badge>
          </Tooltip>
          {#if revisionTreatment && RevisionBadgeIcon}
            <Tooltip
              text={`${revisionTreatment.label} — compared against the catalog's currently active revision. ${EAGER_REVISION_HEDGE}`}
            >
              <Badge variant={revisionTreatment.variant}>
                <RevisionBadgeIcon aria-hidden="true" size={11} />
                {revisionTreatment.label}
              </Badge>
            </Tooltip>
          {/if}
        {:else}
          <Tooltip
            text="This run predates revision pinning (WFT-17) — no persisted revision to compare against the active one."
          >
            <Badge variant="neutral">Unpinned (pre-revision record)</Badge>
          </Tooltip>
        {/if}
        {#if presentation.tooltip}
          <Tooltip text={presentation.tooltip}>
            <Badge variant={presentation.variant}>
              <StatusIcon aria-hidden="true" size={11} />
              {presentation.label}
            </Badge>
          </Tooltip>
        {:else}
          <Badge variant={presentation.variant}>
            <StatusIcon aria-hidden="true" size={11} />
            {presentation.label}
            {#if workflow.status === 'failed' && workflow.failureCategory !== undefined}
              · {failureCategoryLabel(workflow.failureCategory)}
            {/if}
          </Badge>
        {/if}
        {#if workflow.tags && workflow.tags.length > 0}
          {#each workflow.tags as tag (tag)}
            <Badge variant="neutral" size="sm">{tag}</Badge>
          {/each}
        {/if}
      </div>
      <div class="weft-workflow-detail__meta-row">
        <span class="weft-workflow-detail__id" title={workflow.id}>
          {truncateId(workflow.id)}
        </span>
        <CopyButton value={workflow.id} iconOnly label="Copy workflow id" />
        <span class="weft-workflow-detail__meta-sep">·</span>
        <span>created {formatRelativeTime(workflow.createdAt, now)}</span>
        {#if showDeadline && deadlineRemainingMs !== null}
          <span class="weft-workflow-detail__meta-sep">·</span>
          <span class="weft-workflow-detail__deadline" data-overdue={deadlineRemainingMs <= 0}>
            <Clock aria-hidden="true" size={11} />
            deadline {deadlineRemainingMs > 0 ? formatDuration(deadlineRemainingMs) : 'passed'}
          </span>
        {/if}
      </div>
    </div>
  </div>

  <div class="weft-workflow-detail__actions">
    {#each actions as action (action)}
      <Button
        variant="secondary"
        size="sm"
        label={actionLabel(action)}
        loading={pendingAction === action}
        disabled={pendingAction !== null && pendingAction !== action}
        onclick={() => handleActionClick(action)}
      />
    {/each}

    {#if actions.length > 0}
      <span class="weft-workflow-detail__actions-divider"></span>
    {/if}

    <Tooltip text="Fire-and-forget message">
      <Button
        variant="ghost"
        size="sm"
        label="Send signal"
        onclick={() => onNavigateToTab('signals')}
        aria-pressed={activeTab === 'signals'}
      >
        {#snippet leadingIcon()}
          <Radio aria-hidden="true" size={14} />
        {/snippet}
      </Button>
    </Tooltip>
    <Tooltip text="Request / response, awaits a result">
      <Button
        variant="ghost"
        size="sm"
        label="Send update"
        onclick={() => onNavigateToTab('updates')}
        aria-pressed={activeTab === 'updates'}
      >
        {#snippet leadingIcon()}
          <ArrowLeftRight aria-hidden="true" size={14} />
        {/snippet}
      </Button>
    </Tooltip>
    <Tooltip text="Read-only, no workflow change">
      <Button
        variant="ghost"
        size="sm"
        label="Run query"
        onclick={() => (queryOpen = !queryOpen)}
        aria-pressed={queryOpen}
        aria-expanded={queryOpen}
      >
        {#snippet leadingIcon()}
          <HelpCircle aria-hidden="true" size={14} />
        {/snippet}
      </Button>
    </Tooltip>
  </div>

  {#if queryOpen}
    <div class="weft-workflow-detail__query-panel">
      <Input
        id="workflow-detail-query-name"
        label="Query name"
        placeholder="getOrderStatus"
        bind:value={queryName}
      />
      <Input
        id="workflow-detail-query-input"
        label="Input (JSON, optional)"
        placeholder={'{}'}
        bind:value={queryInputText}
      />
      <Button
        variant="primary"
        size="sm"
        label={queryPending ? 'Running…' : 'Run'}
        loading={queryPending}
        disabled={queryName.trim().length === 0}
        onclick={() => void runQuery()}
      />
      {#if queryError}
        <p class="weft-send-tab__error">{queryError}</p>
      {/if}
      {#if queryResultText !== null}
        <pre class="weft-send-tab__result">{queryResultText}</pre>
      {/if}
    </div>
  {/if}
</div>

{#if confirmingAction !== null}
  <ConfirmDialog
    open={confirmingAction !== null}
    title={`${actionLabel(confirmingAction)} this workflow?`}
    description={CONFIRM_COPY[confirmingAction]}
    confirmLabel={actionLabel(confirmingAction)}
    destructive
    onConfirm={confirmAndClose}
    onCancel={() => (confirmingAction = null)}
  />
{/if}
