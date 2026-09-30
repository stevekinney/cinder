<script lang="ts">
  /**
   * Terminal-run restart (COR-15): the console's one `onTerminalConflict:
   * 'start-new'` action. Opened from the workflow header for a run in a
   * terminal status.
   *
   * ## What it calls
   *
   * `client.startOrSignal(type, input, signal, { id, onTerminalConflict:
   * 'start-new', tags })` (`weft.workflows.startorsignal`). The engine's
   * restart-capable surface is the signal-with-start one, which is why the
   * form asks for a signal: `start-new` "requires `options.id` and
   * `signal.signalId`" (`StartOrSignalOptions`, `@lostgradient/weft`), and
   * the initial signal is delivered to the fresh run in the same batch. The
   * `signalId` is generated once per dialog open, so a retry after a
   * network failure re-sends the SAME id and converges instead of
   * delivering twice. The fresh run reuses the prior run's `id`, `type`,
   * `input`, and `tags`. This operation is `destructive: true`: the prior
   * terminal run is purged as part of the replace. A still-live run is never
   * displaced and the call does NOT fault: the engine signals the live run
   * instead ("Non-terminal targets are still signalled, not replaced",
   * `StartOrSignalOptions.onTerminalConflict`) and the handle reports
   * `outcome: 'signalled'`. That happens when the page is stale, another
   * operator restarted the run first, or a retry's first attempt already
   * landed. The dialog then does NOT claim a restart: it invalidates the
   * caches (the signal was delivered) and stays open with an explicit
   * notice; only `outcome: 'started'` reports success and closes.
   *
   * ## Showing the revision before confirming
   *
   * A restart is a FRESH start, so no pin carries over from the prior run:
   * it resolves against whichever revision the workflow type has active.
   * The dialog fetches that pointer exactly the way `workflow-detail.svelte`
   * does for its single-record comparison — `fetchActiveWorkflowRevision`
   * under the shared `queryKeys.catalog.active(type)` key, gated on
   * `workflows:read` — and shows it before the operator confirms. It is
   * hedged with `FRESH_START_REVISION_HEDGE`, the same single-source caveat
   * `lineage-panel.svelte` uses for a start-new replacement: an
   * eager-registered type, or a sole dynamic-source candidate, can run
   * without consulting the active pointer, so the shown revision is what the
   * catalog says, not a guarantee. A pointer that cannot be resolved
   * (denied, never activated, or a failed lookup) degrades to an explicit
   * "could not be resolved" line and does not block the restart.
   */
  import { Button, Input, Modal, Skeleton } from '@lostgradient/cinder';
  import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
  import type {
    ClientStartOrSignalOptions,
    StartOrSignalOutcome,
    StartOrSignalSignal,
    WorkflowState,
  } from '@lostgradient/weft';

  import { faultTreatment } from '../../../lib/faults.ts';
  import { truncateId } from '../../../lib/format/index.ts';
  import { WORKFLOWS_LIST_KEY_PREFIX } from '../../../lib/live-source/cache-integration.ts';
  import { queryKeys } from '../../../lib/query.ts';
  import { getPrincipalStore, scopeGate } from '../../../lib/scopes.svelte.ts';
  import {
    fetchActiveWorkflowRevision,
    FRESH_START_REVISION_HEDGE,
    type WorkflowActiveRevisionClient,
  } from '../../../lib/workflow-revision.ts';

  interface RestartDialogProps {
    /**
     * `startOrSignal` is narrowed to the one string-name shape this dialog
     * calls, past `HttpClient`'s overloaded, registry-generic signature, so
     * a plain test fake can satisfy it; a real `HttpClient` does structurally
     * (its `ClientHandle` result is assignable to `{ id, outcome }`).
     */
    readonly client: {
      startOrSignal(
        type: string,
        input: unknown,
        signal: StartOrSignalSignal,
        options?: ClientStartOrSignalOptions,
      ): Promise<{ readonly id: string; readonly outcome?: StartOrSignalOutcome | undefined }>;
    } & WorkflowActiveRevisionClient;
    /** The terminal run being restarted. */
    readonly workflow: WorkflowState;
    readonly onClose: () => void;
    /** Fired after a successful restart, once the caches are invalidated. */
    readonly onRestarted?: () => void;
  }

  let { client, workflow, onClose, onRestarted }: RestartDialogProps = $props();

  const queryClient = useQueryClient();
  const principal = getPrincipalStore();
  const readGate = $derived(scopeGate(principal, ['workflows:read']));

  let open = $state(true);
  let signalName = $state('');
  let payloadText = $state('{}');
  /** True once a call resolved `'signalled'`: no restart happened. */
  let signalledToLiveRun = $state(false);

  // One id per dialog open — see the module doc on retry convergence.
  const signalId = `console-restart-${crypto.randomUUID()}`;

  const activeQuery = createQuery(() => ({
    queryKey: queryKeys.catalog.active(workflow.type),
    queryFn: () => fetchActiveWorkflowRevision(client, workflow.type),
    enabled: !readGate.disabled,
  }));

  /** An errored lookup collapses to "unresolved" rather than reusing prior `data` (same reasoning as `workflow-detail.svelte`'s `resolvedActiveRevision`). */
  const activePointer = $derived(activeQuery.isError ? undefined : activeQuery.data);
  const activeLoading = $derived(!readGate.disabled && activeQuery.isPending);

  const payloadError = $derived.by(() => {
    if (payloadText.trim().length === 0) return undefined;
    try {
      JSON.parse(payloadText);
      return undefined;
    } catch {
      return 'Must be valid JSON.';
    }
  });

  const canSubmit = $derived(
    signalName.trim().length > 0 && payloadError === undefined && !signalledToLiveRun,
  );

  const restartMutation = createMutation(() => ({
    mutationFn: () => {
      const trimmedPayload = payloadText.trim();
      return client.startOrSignal(
        workflow.type,
        workflow.input,
        {
          name: signalName.trim(),
          signalId,
          ...(trimmedPayload.length > 0 ? { payload: JSON.parse(trimmedPayload) as unknown } : {}),
        },
        {
          id: workflow.id,
          onTerminalConflict: 'start-new',
          ...(workflow.tags !== undefined && workflow.tags.length > 0
            ? { tags: [...workflow.tags] }
            : {}),
        },
      );
    },
    onSuccess: async (result) => {
      // The engine purges the prior run, so every per-run cache for this id
      // (detail, timeline, events, checkpoints, finalizer, ...) is stale.
      await Promise.all([
        queryClient.invalidateQueries({
          predicate: ({ queryKey }) => queryKey[0] === 'workflows' && queryKey[2] === workflow.id,
        }),
        queryClient.invalidateQueries({ queryKey: WORKFLOWS_LIST_KEY_PREFIX }),
      ]);
      if (result.outcome === 'signalled') {
        signalledToLiveRun = true;
        return;
      }
      onRestarted?.();
      open = false;
      onClose();
    },
  }));

  function submit(): void {
    if (!canSubmit || restartMutation.isPending) return;
    restartMutation.mutate();
  }

  function dismiss(): void {
    open = false;
    onClose();
  }
</script>

<Modal
  bind:open
  title="Restart workflow"
  onDismiss={dismiss}
  dismissOnEscape={!restartMutation.isPending}
  dismissOnBackdropClick={!restartMutation.isPending}
>
  {#snippet children()}
    <div class="weft-restart-dialog">
      <p class="weft-restart-dialog__lead">
        Replaces this {workflow.status} run with a fresh one under the same id
        <code>{workflow.id}</code>. The prior run's record is purged; its input and tags are reused.
      </p>

      <div class="weft-restart-dialog__revision" role="status">
        {#if activeLoading}
          <Skeleton height="1.25rem" />
        {:else if activePointer}
          <p>
            Selects <code title={activePointer.revision}
              >rev {truncateId(activePointer.revision)}</code
            > — this workflow type's currently active revision. No pin carries over from the run being
            replaced.
          </p>
        {:else}
          <p>
            The active revision could not be resolved, so which revision the restart selects can't
            be shown here. No pin carries over from the run being replaced.
          </p>
        {/if}
        <p class="weft-restart-dialog__hedge">{FRESH_START_REVISION_HEDGE}</p>
      </div>

      <Input
        id="weft-restart-signal-name"
        label="Signal name"
        description="A restart delivers one initial signal to the fresh run."
        placeholder="resync"
        bind:value={signalName}
      />
      <Input
        id="weft-restart-signal-payload"
        label="Signal payload (JSON)"
        description="Optional — leave empty to send no payload."
        bind:value={payloadText}
        error={payloadError ?? ''}
      />

      {#if signalledToLiveRun}
        <p class="weft-restart-dialog__notice" role="alert">
          This run was not restarted: it is already live under this id, so the signal was delivered
          to it instead. Another operator may have restarted it first, or an earlier attempt already
          landed. Close this dialog to see its current state.
        </p>
      {/if}

      {#if restartMutation.isError}
        <p class="weft-restart-dialog__error" role="alert">
          {faultTreatment(restartMutation.error).message}
        </p>
      {/if}
    </div>
  {/snippet}
  {#snippet footer()}
    <Button variant="secondary" onclick={dismiss} disabled={restartMutation.isPending}
      >Cancel</Button
    >
    <Button
      variant="primary"
      onclick={submit}
      loading={restartMutation.isPending}
      disabled={!canSubmit}
    >
      Restart workflow
    </Button>
  {/snippet}
</Modal>

<style>
  .weft-restart-dialog {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .weft-restart-dialog p {
    margin: 0;
  }

  .weft-restart-dialog__lead {
    font-size: var(--cinder-text-sm);
  }

  .weft-restart-dialog__revision {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 12px;
    background: var(--cinder-surface-raised);
    border: 1px solid var(--cinder-border);
    border-radius: var(--cinder-radius-md);
    font-size: var(--cinder-text-xs);
  }

  .weft-restart-dialog__hedge {
    color: var(--cinder-text-subtle);
    font-size: var(--cinder-text-2xs);
  }

  .weft-restart-dialog__notice {
    font-size: var(--cinder-text-xs);
  }

  .weft-restart-dialog__error {
    color: var(--cinder-danger-text, var(--cinder-text));
    font-size: var(--cinder-text-xs);
  }
</style>
