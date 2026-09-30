<script lang="ts">
  /**
   * Fork dialog (plan T3.3, design `Weft Patterns.dc.html` "Fork from
   * checkpoint"): `POST …/fork` (`client.fork`, public access, no scope
   * gate — verified against `weft/src/server/operations/fork-workflow.ts`),
   * success links to the new run via `forkedFrom`.
   *
   * ## Revision picker (WFT-117)
   *
   * Default fork behavior (`ForkOptions.revision` omitted) resolves and
   * persists the SOURCE run's own `revision` — shown up front as "Retains
   * rev X" (or "Unpinned source" for a legacy run with no persisted
   * revision) so an operator sees what will happen before confirming,
   * without opening anything. A collapsed "Fork a different revision"
   * disclosure opts into an EXPLICIT revision (`ForkOptions.revision`,
   * diagnostic use) — a `Select` of installed revisions
   * (`weft.workflows.revisions.list`) when `workflows:read` is granted,
   * degrading to a free-text `Input` (with a note that the server still
   * validates it) when denied, mirroring `schedule-form-fields.svelte`'s
   * identical registry-picker degrade. `weft.workflows.fork` itself is
   * `access: { kind: 'public' }` — only the LISTING read needs the scope,
   * so an operator without `workflows:read` can still legally fork against
   * an explicit revision id they already know.
   *
   * A rejection specifically coded `WorkflowRevisionUnavailableError`
   * (`isForkRevisionConflict`, `fork-revision-picker.ts`) gets its own
   * Conflict framing, distinct from the generic error paragraph every other
   * fork failure still uses — and `forkConflictGuidance()` branches that
   * framing's recovery sentence on `selection.mode` (Codex review, PR #978):
   * a default (`'source'`) fork that failed this way means the SOURCE run's
   * OWN revision is unavailable, so pointing the operator back at "use the
   * source revision" would tell them to retry the exact thing that just
   * failed — that case routes to the explicit picker instead. An
   * `'explicit'` fork that failed keeps "use the source revision instead"
   * as real, available advice.
   *
   * ## The default "Retains rev X" promise describes a SNAPSHOT, not a guarantee (Codex review, PR #978, round 5)
   *
   * `sourceRevision` is a prop threaded down from the detail page's own
   * `WorkflowState` fetch — as of whenever that page last loaded or
   * refetched, not as of the moment `Create fork` is actually clicked.
   * `client.fork(workflowId)` (the default, no explicit `revision`) asks
   * the server to resolve and persist whichever generation CURRENTLY
   * occupies `workflowId` at submission time. If the displayed terminal run
   * was replaced by a `start-new` restart after the page loaded — most
   * likely while the fleet live-update feed is unavailable, so the stale
   * page never refreshes — the two can diverge: the dialog still shows the
   * OLD generation's revision while the actual fork call resolves the
   * REPLACEMENT's. There is no client-side fix available within this
   * batch's scope (revalidating would mean re-fetching the source and
   * accepting a race against a start-new landing between that fetch and
   * submission; pinning it durably would need `ForkOptions` to accept a
   * source execution token, a `packages/weft` change, out of scope here) —
   * the retention line's copy is qualified below to say so honestly rather
   * than promise more than this snapshot can guarantee.
   *
   * ## Refetch on open (COR-15)
   *
   * Added ON TOP of the disclosure above, not instead of it: mounting the
   * dialog (it is remounted on every checkpoint selection and Fork-tab
   * switch — see `checkpoints-tab.svelte`) refetches the source run's
   * persisted `revision` (`sourceQuery`, `refetchOnMount: 'always'`) and
   * shows THAT once it lands, so a `start-new` replacement that landed
   * between page load and dialog open is reflected before the operator
   * confirms. This narrows the race but cannot close it — a replacement
   * landing between this fetch and `Create fork` is still possible, which is
   * exactly what the "as last loaded here" copy and tooltip keep saying, and
   * closing it fully would still need `ForkOptions` to accept a source
   * execution token (`packages/weft`, out of scope). While the refetch is in
   * flight, or if it fails or finds the run purged, the page-load
   * `sourceRevision` prop is what the dialog shows, unchanged.
   */
  import { Badge, Button, Input, Select, Skeleton, Tooltip } from '@lostgradient/cinder';
  import { createMutation, createQuery } from '@tanstack/svelte-query';
  import { ChevronDown, ChevronRight, GitFork } from 'lucide-svelte';

  import { faultTreatment } from '../../../../lib/faults.ts';
  import { formatRelativeTime, truncateId } from '../../../../lib/format/index.ts';
  import { queryKeys } from '../../../../lib/query.ts';
  import { getPrincipalStore, scopeGate } from '../../../../lib/scopes.svelte.ts';
  import { EAGER_REVISION_HEDGE } from '../../../../lib/workflow-revision.ts';
  import { router, workflowDetailPath } from '../../../../lib/router.svelte.ts';
  import type { ForkClient, ForkSourceClient } from './checkpoints-data.ts';
  import {
    forkConflictGuidance,
    isForkRevisionConflict,
    parseInstalledRevisions,
    resolveForkOptions,
    type ForkRevisionSelection,
    type WorkflowRevisionListClient,
  } from './fork-revision-picker.ts';

  interface ForkDialogProps {
    readonly client: ForkClient & ForkSourceClient & WorkflowRevisionListClient;
    readonly workflowId: string;
    /** Pre-fills the target step from whichever checkpoint the operator selected. */
    readonly initialStep: number;
    /** The workflow TYPE this run is — used to look up installed revisions for the picker. */
    readonly workflowType: string;
    /** The source run's own persisted `WorkflowState.revision` — `undefined` for a legacy (pre-revision-pinning) record. What a default fork (no explicit opt-in) retains. */
    readonly sourceRevision: string | undefined;
    /** Fired with the new run's id right after a successful fork, so the Checkpoints tab can offer the divergence view. */
    readonly onForked?: (forkedWorkflowId: string) => void;
  }

  let {
    client,
    workflowId,
    initialStep,
    workflowType,
    sourceRevision: loadedSourceRevision,
    onForked,
  }: ForkDialogProps = $props();

  // Refetch-on-open (COR-15) — see the module doc. Keyed under the detail
  // key's prefix so a fleet-driven invalidation of the run's detail refreshes
  // it too, but distinct from it so this fetch never rewrites the detail
  // page's own cached record. `client.get` resolves `null` for a purged run.
  const sourceQuery = createQuery(() => ({
    queryKey: [...queryKeys.workflows.detail(workflowId), 'fork-source'] as const,
    queryFn: () => client.get(workflowId),
    refetchOnMount: 'always' as const,
  }));

  const openedAt = Date.now();

  /**
   * What the retention line reports: the revision from a fetch that landed
   * AFTER this dialog opened (`dataUpdatedAt >= openedAt`, so a cache entry
   * left by an EARLIER open is never shown as if current), provided the run
   * still exists; otherwise the page-load prop.
   */
  const sourceRevision = $derived(
    sourceQuery.isSuccess && sourceQuery.data !== null && sourceQuery.dataUpdatedAt >= openedAt
      ? sourceQuery.data.revision
      : loadedSourceRevision,
  );

  // Intentional one-shot capture, not a bug: `checkpoints-tab.svelte` always
  // destroys and remounts this dialog (it lives behind an `{#if panel ===
  // 'fork'}` block gated by `selectCheckpoint()`, which resets `panel` to
  // 'replay' on every selection change), so a fresh instance always sees the
  // current `initialStep` at construction. Tracking it reactively here would
  // stomp the operator's in-progress edit to the target-step field whenever
  // `initialStep` happened to change out from under a still-mounted instance.
  // svelte-ignore state_referenced_locally
  let targetStepText = $state(String(initialStep));

  const principal = getPrincipalStore();
  const readGate = $derived(scopeGate(principal, ['workflows:read']));

  let pickerOpen = $state(false);
  /** Bound to the `Select` (installed-revisions case) — `''` means "use source revision." Empty when `Select` isn't the active input. */
  let selectedRevisionValue = $state('');
  /** Bound to the free-text `Input` (degraded, `workflows:read`-denied case). Empty when the `Input` isn't the active input. */
  let explicitRevisionText = $state('');

  const revisionsQuery = createQuery(() => ({
    // Shares the System route's Revisions-panel cache key (WFT-115) so
    // this picker starts warm when the revisions list is already cached,
    // and so activating a revision from the System route invalidates
    // this entry too — not a duplicate resource under a different key.
    queryKey: queryKeys.catalog.revisions(workflowType),
    queryFn: () => client.operations['weft.workflows.revisions.list']({ name: workflowType }),
    enabled: pickerOpen && !readGate.disabled,
  }));

  /**
   * NOT `revisionsQuery.data !== undefined ? parseInstalledRevisions(...)
   * : undefined` (Codex review, PR #978, round 6). TanStack Query keeps
   * the PREVIOUS successful `data` around across a failed refetch
   * alongside `isError: true` — without also checking `isError` here, a
   * non-403 refetch failure (network blip, `EngineFailure`, a revision
   * genuinely uninstalled server-side between fetches) would keep this
   * derived value populated from the stale success, so the markup's
   * `{:else if installedRevisions === undefined}` "Could not load" branch
   * never triggers and the `Select` keeps presenting cached, possibly
   * removed revisions as selectable — the operator submits one and gets a
   * conflict instead of an honest "could not load" state. The 403 case
   * (`revisionsForbidden`, `isDegraded`) is unaffected — it takes priority
   * in the markup's own branch order and degrades to the free-text
   * fallback instead, independent of this derivation.
   */
  const installedRevisions = $derived(
    revisionsQuery.isError || revisionsQuery.data === undefined
      ? undefined
      : parseInstalledRevisions(revisionsQuery.data),
  );

  /**
   * `readGate.disabled` reflects the principal store's scopes as of
   * bootstrap — if `workflows:read` is revoked server-side afterward
   * without the client's cached principal being updated, `readGate.disabled`
   * stays `false` and the listing request itself comes back 403. Without
   * this check that 403 fell through to the generic "could not load"
   * error, a dead end even though `weft.workflows.fork` remains public and
   * an operator who already knows a revision id could still fork against it
   * (Codex review, PR #978, round 3). Treated the same as a known-denied
   * read: degrade to the free-text fallback.
   */
  const revisionsForbidden = $derived.by(() => {
    if (!revisionsQuery.isError) return false;
    const treatment = faultTreatment(revisionsQuery.error);
    return treatment.kind === 'unauthorized' && treatment.mode === 'forbidden';
  });

  /** Which picker input is actually rendered right now — drives both `selection` below and the markup's `{#if}`. */
  const isDegraded = $derived(readGate.disabled || revisionsForbidden);

  /**
   * Clears whichever input just stopped being the rendered one. Without
   * this, a mid-session degrade — `workflows:read` revoked server-side
   * after the operator already selected a revision in the `Select`, so
   * `revisionsForbidden` flips true and the UI swaps to the free-text
   * `Input` — left `selectedRevisionValue` holding the operator's OLD
   * selection while the now-hidden `Select` component itself unmounts
   * (Codex review, PR #978): entering a different revision in the newly
   * shown `Input` looked like it should replace the choice, but
   * `selection` below reads by rendered-input identity, not "whichever
   * field is non-empty," so a stale value under a switched-away input can
   * no longer silently win either way — this effect is defense in depth
   * against exactly that leftover value resurfacing if the mode flips
   * back a second time.
   */
  $effect(() => {
    if (isDegraded) {
      selectedRevisionValue = '';
    } else {
      explicitRevisionText = '';
    }
  });

  /**
   * Reads by WHICH INPUT `isDegraded` currently renders, not by "whichever
   * field happens to be non-empty" — the latter is exactly the bug class
   * flagged in review: a stale value left in a field that stopped being
   * rendered could otherwise still win over a fresh entry in the field
   * that replaced it.
   */
  const selection = $derived<ForkRevisionSelection>(
    isDegraded
      ? explicitRevisionText.trim() !== ''
        ? { mode: 'explicit', revision: explicitRevisionText.trim() }
        : { mode: 'source' }
      : selectedRevisionValue !== ''
        ? { mode: 'explicit', revision: selectedRevisionValue }
        : { mode: 'source' },
  );

  const parsedStep = $derived.by(() => {
    const trimmed = targetStepText.trim();
    if (trimmed.length === 0) return null;
    const value = Number(trimmed);
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  });

  /**
   * The mutation's input carries `selection` alongside `fromStep` (Codex
   * review, PR #978, round 3) — NOT just `fromStep` with `selection` closed
   * over live. `forkMutation.variables` freezes whatever was passed to the
   * most recent `mutate()` call, so `forkMutation.variables?.selection`
   * below reflects the selection that actually FAILED, even if the operator
   * keeps editing the picker afterward (e.g. switching from the default
   * source-mode fork to an explicit revision) before dismissing or retrying
   * the error. Reading the live `selection` derived value there instead
   * would silently swap the conflict guidance out from under a
   * still-displayed error — recreating the exact "tells the operator to
   * retry the thing that just failed" bug `forkConflictGuidance` exists to
   * prevent.
   */
  const forkMutation = createMutation(() => ({
    mutationFn: async (input: { fromStep: number; selection: ForkRevisionSelection }) =>
      client.fork(workflowId, resolveForkOptions(input.selection, input.fromStep)),
    onSuccess: (handle) => onForked?.(handle.id),
  }));

  function submit(): void {
    if (parsedStep === null) return;
    forkMutation.mutate({ fromStep: parsedStep, selection });
  }

  function viewForkedRun(): void {
    const id = forkMutation.data?.id;
    if (id !== undefined) router.navigate(workflowDetailPath(id));
  }

  const revisionConflict = $derived(
    forkMutation.isError ? isForkRevisionConflict(forkMutation.error) : false,
  );
  /** The selection that actually produced the current error — see `forkMutation`'s doc. Falls back to the live `selection` only when `variables` is somehow absent (defensive; TanStack always sets it after a `mutate()` call that reached `mutationFn`). */
  const failedSelection = $derived(forkMutation.variables?.selection ?? selection);
</script>

<div class="weft-fork-dialog">
  <Input
    id={`fork-target-step-${workflowId}`}
    label="Target step"
    inputmode="numeric"
    bind:value={targetStepText}
  />

  <div class="weft-fork-dialog__retention" role="status">
    {#if selection.mode === 'explicit'}
      <Tooltip text={`Fork target revision (exact executable artifact): ${selection.revision}`}>
        <span>
          Will target <code>rev {truncateId(selection.revision)}</code> instead of the source run's own
          revision.
        </span>
      </Tooltip>
    {:else if sourceRevision !== undefined}
      <Tooltip
        text={`Revision (exact executable artifact) as last loaded: ${sourceRevision}. ${EAGER_REVISION_HEDGE} If this run has been replaced by a start-new restart since this page loaded, the fork instead targets the replacement's own revision.`}
      >
        <span
          >Retains <code>rev {truncateId(sourceRevision)}</code> — the source run's own revision, as last
          loaded here.</span
        >
      </Tooltip>
    {:else}
      <span>
        Unpinned source — this run predates revision pinning, so which revision the fork targets
        can't be stated here. Most types resolve whichever revision is currently active, but an
        eager-registered type instead runs whatever this process currently has loaded, and a sole
        dynamic-source candidate can be selected without consulting the active pointer at all.
      </span>
    {/if}
  </div>

  <Button
    variant="ghost"
    size="sm"
    label="Fork a different revision"
    aria-expanded={pickerOpen}
    onclick={() => (pickerOpen = !pickerOpen)}
  >
    {#snippet leadingIcon()}
      {#if pickerOpen}
        <ChevronDown aria-hidden="true" size={13} />
      {:else}
        <ChevronRight aria-hidden="true" size={13} />
      {/if}
    {/snippet}
  </Button>

  {#if pickerOpen}
    <div class="weft-fork-dialog__picker">
      {#if isDegraded}
        <Input
          id={`fork-explicit-revision-${workflowId}`}
          label="Revision id"
          description="You don't have permission to list installed revisions — enter one you already know. The server still validates it."
          bind:value={explicitRevisionText}
        />
      {:else if revisionsQuery.isPending}
        <Skeleton height="2.5rem" />
      {:else if installedRevisions === undefined}
        <p class="weft-fork-dialog__error">Could not load the list of installed revisions.</p>
      {:else if installedRevisions.length === 0}
        <p class="weft-fork-dialog__note">No installed revisions are recorded for this type.</p>
      {:else}
        <Select
          id={`fork-revision-select-${workflowId}`}
          label="Revision"
          bind:value={selectedRevisionValue}
          options={[
            { value: '', label: 'Use source revision' },
            ...installedRevisions.map((option) => ({
              // Cinder's `Select` renders each option from `{value, label}`
              // alone — no per-option `title`/description slot — so a
              // truncated label risked two installed revisions sharing the
              // same first-eight/last-four display and the same relative
              // install time, making them indistinguishable before
              // selection (Codex review, PR #978). The FULL revision id is
              // the visible label; there is no truncated form here.
              value: option.revision,
              label: `${option.revision} · installed ${formatRelativeTime(option.installedAt)}`,
            })),
          ]}
        />
      {/if}
    </div>
  {/if}

  <p class="weft-fork-dialog__note">
    A new workflow is created, linked via <code>forkedFrom</code>.
  </p>

  {#if forkMutation.isError}
    {#if revisionConflict}
      <div class="weft-fork-dialog__conflict" role="alert">
        <Badge variant="warning">Revision unavailable</Badge>
        <p>
          {forkMutation.error instanceof Error
            ? forkMutation.error.message
            : 'The requested revision could not be resolved.'}
          {forkConflictGuidance(failedSelection)}
        </p>
      </div>
    {:else}
      <p class="weft-fork-dialog__error">
        {forkMutation.error instanceof Error
          ? forkMutation.error.message
          : 'Failed to fork the workflow.'}
      </p>
    {/if}
  {/if}

  {#if forkMutation.isSuccess && forkMutation.data}
    <div class="weft-fork-dialog__success">
      <span>Forked as <code>{forkMutation.data.id}</code></span>
      <Button variant="ghost" size="sm" label="View →" onclick={viewForkedRun} />
    </div>
  {:else}
    <Button
      variant="primary"
      size="sm"
      fullWidth
      label={forkMutation.isPending ? 'Forking…' : 'Create fork'}
      loading={forkMutation.isPending}
      disabled={parsedStep === null || forkMutation.isPending}
      onclick={submit}
    >
      {#snippet leadingIcon()}
        <GitFork aria-hidden="true" size={13} />
      {/snippet}
    </Button>
  {/if}
</div>

<style>
  .weft-fork-dialog {
    background: var(--cinder-surface-raised);
    border: 1px solid var(--cinder-border);
    border-radius: var(--cinder-radius-lg);
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .weft-fork-dialog__retention {
    font-size: var(--cinder-text-xs);
    color: var(--cinder-text-subtle);
  }

  .weft-fork-dialog__retention code {
    font-family: var(--cinder-font-mono);
  }

  .weft-fork-dialog__picker {
    padding: 10px;
    background: var(--cinder-surface);
    border: 1px solid var(--cinder-border-muted);
    border-radius: var(--cinder-radius-md);
  }

  .weft-fork-dialog__note {
    margin: 0;
    font-size: var(--cinder-text-2xs);
    color: var(--cinder-text-disabled);
  }

  .weft-fork-dialog__note code {
    font-family: var(--cinder-font-mono);
  }

  .weft-fork-dialog__error {
    margin: 0;
    font-size: var(--cinder-text-2xs);
    color: var(--cinder-color-danger-fg);
  }

  .weft-fork-dialog__conflict {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 9px 12px;
    background: var(--cinder-color-warning-bg);
    border: 1px solid var(--cinder-color-warning-border);
    border-radius: var(--cinder-radius-md);
  }

  .weft-fork-dialog__conflict p {
    margin: 0;
    font-size: var(--cinder-text-xs);
    color: var(--cinder-color-warning-fg);
  }

  .weft-fork-dialog__success {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 12px;
    background: var(--cinder-color-success-bg);
    border: 1px solid var(--cinder-color-success-border);
    border-radius: var(--cinder-radius-md);
    font-size: var(--cinder-text-sm);
  }

  .weft-fork-dialog__success code {
    font-family: var(--cinder-font-mono);
  }
</style>
