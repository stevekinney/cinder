<script lang="ts">
  /**
   * Bulk-selection bar (plan §9.2/§13 T8.1, §10.6 confirmation tiers).
   * Completes the scaffold the list track shipped in Phase 2 ("count +
   * disabled actions with scope reasons; the Tier-3 flow is Phase 8, not
   * yours") — this is Phase 8.
   *
   * ## The API is filter-scoped, not id-scoped — this drives the whole design
   *
   * None of `weft.workflows.bulk.{cancel,signal,retryfailed,delete,tags}` /
   * `weft.workflows.purge` accept a list of workflow ids
   * (`bulkListFilterInputSchema` has status/type/tags/attributes/idPrefix/
   * failureCategory/time-ranges — no `ids`). There is no server call that
   * acts on "exactly these 3 checked rows" as a set. So checking individual
   * row checkboxes (`workflow-table.svelte`'s `selectedIds`) stays a visual
   * affordance only; the actual gate for running a bulk action is the
   * **"select all N matching the filter" escalation** — every action button
   * stays disabled-with-reason until that's explicitly checked, at which
   * point the action truly does operate on the full filtered set the
   * dry-run/purge count describes, matching the design mock's own copy
   * ("Operates on all 47 workflows matching the filter — not just the
   * visible page").
   *
   * `filterScoped` disables actions before a dry-run would 400 with
   * `InvalidParams` for an unscoped filter (`bulk-filter-scope.ts` mirrors
   * the server's own `assertScopedBulkWorkflowFilter`). Purge gets the same
   * gate as a deliberate client-side safety rail even though its own wire
   * contract doesn't require one (`bulk-purge-dialog.svelte`'s module doc).
   *
   * Admin gating: five of the six actions require `workflows:admin`
   * server-side (`bulkOperatorAccessPolicy`) — `scopes.svelte.ts`'s own
   * module doc calls this out explicitly as unsafe to optimistically grant.
   * Purge's real `access` is `{ kind: 'public' }` (verified against
   * `purge-workflows.ts`), but this bar still gates it behind the same
   * `workflows:admin` `adminGate` prop for one consistent bar-wide rule —
   * over-restrictive relative to the wire contract, never under.
   */
  import { RotateCw, Tags, Trash2, XCircle } from 'lucide-svelte';
  import { Button, Checkbox, Input, Select, Textarea, Tooltip } from '@lostgradient/cinder';
  import type { SelectOption } from '@lostgradient/cinder';
  import type { HttpClient } from '@lostgradient/weft';

  import type { WorkflowListQuery } from '../../../lib/filters.ts';
  import type { ScopeGate } from '../../../lib/scopes.svelte.ts';
  import {
    EAGER_REVISION_HEDGE,
    FRESH_START_REVISION_HEDGE,
  } from '../../../lib/workflow-revision.ts';
  import BulkActionDialog from './bulk-action-dialog.svelte';
  import { BULK_FILTER_UNSCOPED_REASON, isBulkOperationScoped } from './bulk-filter-scope.ts';
  import { toBulkListFilterInput } from './bulk-list-filter.ts';
  import {
    commitBulkCancel,
    commitBulkDelete,
    commitBulkRetryFailed,
    commitBulkSignal,
    commitBulkTags,
    dryRunBulkCancel,
    dryRunBulkDelete,
    dryRunBulkRetryFailed,
    dryRunBulkSignal,
    dryRunBulkTags,
    purgeWorkflows,
  } from './bulk-operations-client.ts';
  import { filterSummaryChip } from './bulk-preview-format.ts';
  import BulkPurgeDialog from './bulk-purge-dialog.svelte';
  import {
    cancelResultSummary,
    deleteResultSummary,
    purgeResultSummary,
    retryFailedResultSummary,
    signalResultSummary,
    tagResultSummary,
  } from './bulk-result-summary.ts';

  interface BulkSelectionBarProps {
    readonly client: Pick<HttpClient, 'operations'>;
    readonly filter: WorkflowListQuery;
    readonly selectedCount: number;
    readonly totalMatchingFilter: number;
    readonly onDeselect: () => void;
    readonly adminGate: ScopeGate;
    /** Invalidates the list/aggregate queries — called once a bulk action actually commits. */
    readonly onActionComplete: () => void;
  }

  let {
    client,
    filter,
    selectedCount,
    totalMatchingFilter,
    onDeselect,
    adminGate,
    onActionComplete,
  }: BulkSelectionBarProps = $props();

  /**
   * Local, not lifted: nothing outside this bar consumes the escalation
   * state, and the bar itself unmounts (via the `{#if selectedCount > 0}`
   * guard below) whenever selection is cleared, which naturally resets this
   * back to `false` on the next selection — no extra reset effect needed.
   */
  let selectedAllMatching = $state(false);

  const filterScoped = $derived(isBulkOperationScoped(filter));
  const bulkFilter = $derived(toBulkListFilterInput(filter));
  const chip = $derived(filterSummaryChip(bulkFilter));

  const actionsDisabledReason = $derived(
    adminGate.disabled
      ? adminGate.title
      : !selectedAllMatching
        ? `Select all ${totalMatchingFilter} matching the filter to enable bulk actions`
        : !filterScoped
          ? BULK_FILTER_UNSCOPED_REASON
          : undefined,
  );
  const actionsEnabled = $derived(actionsDisabledReason === undefined);

  type ActiveAction = 'cancel' | 'signal' | 'retry-failed' | 'delete' | 'tags' | 'purge' | null;
  let activeAction = $state<ActiveAction>(null);

  function closeDialog(): void {
    activeAction = null;
  }

  // --- Signal params ---------------------------------------------------
  let signalName = $state('');
  let signalPayloadText = $state('');
  const signalPayloadParsed = $derived.by((): { ok: true; value: unknown } | { ok: false } => {
    const trimmed = signalPayloadText.trim();
    if (trimmed.length === 0) return { ok: true, value: undefined };
    try {
      return { ok: true, value: JSON.parse(trimmed) };
    } catch {
      return { ok: false };
    }
  });
  const signalParamsValid = $derived(signalName.trim().length > 0 && signalPayloadParsed.ok);

  function openSignal(): void {
    signalName = '';
    signalPayloadText = '';
    activeAction = 'signal';
  }

  // --- Tags params -------------------------------------------------------
  const TAGS_OPERATION_OPTIONS: readonly SelectOption<'add' | 'remove'>[] = [
    { value: 'add', label: 'Add tags' },
    { value: 'remove', label: 'Remove tags' },
  ];
  let tagsOperation = $state<'add' | 'remove'>('add');
  let tagsText = $state('');
  const tagsList = $derived(
    tagsText
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0),
  );
  const tagsParamsValid = $derived(tagsList.length > 0);

  function openTags(): void {
    tagsOperation = 'add';
    tagsText = '';
    activeAction = 'tags';
  }
</script>

{#snippet signalParamsForm()}
  <Input id="bulk-signal-name" label="Signal name" bind:value={signalName} placeholder="addItem" />
  <Textarea
    id="bulk-signal-payload"
    label="Payload"
    description="JSON, optional"
    rows={4}
    bind:value={signalPayloadText}
  />
  {#if !signalPayloadParsed.ok}
    <p class="weft-bulk-bar__params-error">Payload must be valid JSON (or left blank).</p>
  {/if}
{/snippet}

{#snippet tagsParamsForm()}
  <Select
    id="bulk-tags-operation"
    label="Operation"
    bind:value={tagsOperation}
    options={TAGS_OPERATION_OPTIONS}
  />
  <Input
    id="bulk-tags-list"
    label="Tags (comma-separated)"
    bind:value={tagsText}
    placeholder="urgent, reviewed"
  />
{/snippet}

{#if selectedCount > 0}
  <div class="weft-bulk-bar">
    <div class="weft-bulk-bar__banner">
      <Checkbox
        bind:checked={selectedAllMatching}
        label={`Select all ${totalMatchingFilter} matching the filter`}
      />
      <span class="weft-bulk-bar__banner-hint">
        Bulk actions operate on the full filtered set, not the checked rows.
      </span>
    </div>
    <div class="weft-bulk-bar__row">
      <span class="weft-bulk-bar__count">{selectedCount} selected</span>
      <div class="weft-bulk-bar__actions">
        <Tooltip text={actionsDisabledReason ?? ''}>
          <Button
            variant="secondary"
            size="sm"
            disabled={!actionsEnabled}
            onclick={() => (activeAction = 'cancel')}
          >
            <XCircle aria-hidden="true" size={14} />
            Cancel
          </Button>
        </Tooltip>
        <Tooltip text={actionsDisabledReason ?? ''}>
          <Button variant="secondary" size="sm" disabled={!actionsEnabled} onclick={openSignal}>
            <RotateCw aria-hidden="true" size={14} />
            Signal
          </Button>
        </Tooltip>
        <Tooltip text={actionsDisabledReason ?? ''}>
          <Button
            variant="secondary"
            size="sm"
            disabled={!actionsEnabled}
            onclick={() => (activeAction = 'retry-failed')}
          >
            <RotateCw aria-hidden="true" size={14} />
            Retry failed
          </Button>
        </Tooltip>
        <Tooltip text={actionsDisabledReason ?? ''}>
          <Button variant="secondary" size="sm" disabled={!actionsEnabled} onclick={openTags}>
            <Tags aria-hidden="true" size={14} />
            Mutate tags
          </Button>
        </Tooltip>
        <Tooltip text={actionsDisabledReason ?? ''}>
          <Button
            variant="secondary"
            size="sm"
            disabled={!actionsEnabled}
            onclick={() => (activeAction = 'delete')}
          >
            <Trash2 aria-hidden="true" size={14} />
            Delete
          </Button>
        </Tooltip>
        <Tooltip text={actionsDisabledReason ?? ''}>
          <Button
            variant="danger"
            size="sm"
            disabled={!actionsEnabled}
            onclick={() => (activeAction = 'purge')}
          >
            <Trash2 aria-hidden="true" size={14} />
            Purge
          </Button>
        </Tooltip>
      </div>
      <button type="button" class="weft-bulk-bar__deselect" onclick={onDeselect}>Deselect</button>
    </div>
  </div>
{/if}

{#if activeAction === 'cancel'}
  <BulkActionDialog
    title="Bulk cancel"
    verb="cancel"
    runDryRun={() => dryRunBulkCancel(client, bulkFilter)}
    runCommit={async (token, matched) =>
      cancelResultSummary(await commitBulkCancel(client, bulkFilter, token), matched)}
    onClose={closeDialog}
    onSuccess={onActionComplete}
  />
{:else if activeAction === 'retry-failed'}
  <BulkActionDialog
    title="Bulk retry failed"
    verb="retry"
    destructive={false}
    runDryRun={() => dryRunBulkRetryFailed(client, bulkFilter)}
    runCommit={async (token, matched) =>
      retryFailedResultSummary(await commitBulkRetryFailed(client, bulkFilter, token), matched)}
    onClose={closeDialog}
    onSuccess={onActionComplete}
    previewNote={`A retry with a saved checkpoint resumes in place on its own persisted revision when one exists — a checkpoint from before revision pinning has none, so that retry falls back to the same active-revision resolution as a fresh start (and can fail as ambiguous if more than one candidate is installed). ${EAGER_REVISION_HEDGE} A retry with no checkpoint restarts fresh and resolves whichever revision is active right now — the same as any other start-new replacement. ${FRESH_START_REVISION_HEDGE}`}
  />
{:else if activeAction === 'delete'}
  <BulkActionDialog
    title="Bulk delete"
    verb="delete"
    runDryRun={() => dryRunBulkDelete(client, bulkFilter)}
    runCommit={async (token, matched) =>
      deleteResultSummary(await commitBulkDelete(client, bulkFilter, token), matched)}
    onClose={closeDialog}
    onSuccess={onActionComplete}
  />
{:else if activeAction === 'signal'}
  <BulkActionDialog
    title="Bulk signal"
    verb="signal"
    destructive={false}
    parameters={signalParamsForm}
    parametersValid={signalParamsValid}
    runDryRun={() =>
      dryRunBulkSignal(
        client,
        bulkFilter,
        signalName.trim(),
        signalPayloadParsed.ok ? signalPayloadParsed.value : undefined,
      )}
    runCommit={async (token, matched) =>
      signalResultSummary(
        await commitBulkSignal(
          client,
          bulkFilter,
          signalName.trim(),
          signalPayloadParsed.ok ? signalPayloadParsed.value : undefined,
          token,
        ),
        matched,
      )}
    onClose={closeDialog}
    onSuccess={onActionComplete}
  />
{:else if activeAction === 'tags'}
  <BulkActionDialog
    title="Bulk mutate tags"
    verb={tagsOperation === 'add' ? 'add tags to' : 'remove tags from'}
    destructive={false}
    parameters={tagsParamsForm}
    parametersValid={tagsParamsValid}
    runDryRun={() => dryRunBulkTags(client, bulkFilter, tagsOperation, tagsList)}
    runCommit={async (token, matched) =>
      tagResultSummary(
        await commitBulkTags(client, bulkFilter, tagsOperation, tagsList, token),
        tagsOperation,
        matched,
      )}
    onClose={closeDialog}
    onSuccess={onActionComplete}
  />
{:else if activeAction === 'purge'}
  <BulkPurgeDialog
    matchedCount={totalMatchingFilter}
    filterChip={chip}
    runPurge={async () => purgeResultSummary(await purgeWorkflows(client, bulkFilter))}
    onClose={closeDialog}
    onSuccess={onActionComplete}
  />
{/if}

<style>
  .weft-bulk-bar {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 16px;
    background: var(--cinder-surface-raised);
    border: 1px solid var(--cinder-border);
    border-radius: var(--cinder-radius-lg);
    box-shadow: var(--cinder-shadow-sm);
  }

  .weft-bulk-bar__banner {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .weft-bulk-bar__banner-hint {
    font-size: var(--cinder-text-2xs);
    color: var(--cinder-text-disabled);
  }

  .weft-bulk-bar__row {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .weft-bulk-bar__count {
    font-size: var(--cinder-text-sm);
    font-weight: 600;
  }

  .weft-bulk-bar__actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .weft-bulk-bar__deselect {
    margin-inline-start: auto;
    border: 0;
    background: transparent;
    color: var(--cinder-text-subtle);
    font-size: var(--cinder-text-xs);
    cursor: pointer;
    padding: 0;
  }

  .weft-bulk-bar__params-error {
    margin: 0;
    font-size: var(--cinder-text-xs);
    color: var(--cinder-color-danger-fg);
  }
</style>
