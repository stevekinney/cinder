<script lang="ts">
  /**
   * Replay read-only view (plan T3.3, design `Weft Patterns.dc.html`
   * "Replay · read-only"): blue left border + orange "no actions available"
   * banner. Reconstructs historical state via `client.replayTo` — a
   * side-effecting READ (`weft.workflows.replay`, `workflows:read` scope),
   * never mutates the live workflow.
   */
  import { DescriptionList, EmptyState, PayloadInspector, Skeleton } from '@lostgradient/cinder';
  import { createQuery } from '@tanstack/svelte-query';
  import type { HttpClient } from '@lostgradient/weft';
  import { Rewind } from 'lucide-svelte';

  import { getPrincipalStore, scopeGate } from '../../../../lib/scopes.svelte.ts';
  import { formatBytes } from '../../../../lib/format/index.ts';
  import { EAGER_REVISION_HEDGE } from '../../../../lib/workflow-revision.ts';
  import { replayQueryKey, replayWorkflow } from './checkpoints-data.ts';

  interface ReplayViewProps {
    readonly client: Pick<HttpClient, 'replayTo'>;
    readonly workflowId: string;
    readonly step: number;
  }

  let { client, workflowId, step }: ReplayViewProps = $props();

  const principalStore = getPrincipalStore();
  const gate = $derived(scopeGate(principalStore, ['workflows:read']));

  const replayQuery = createQuery(() => ({
    queryKey: replayQueryKey(workflowId, step),
    queryFn: () => replayWorkflow(client, workflowId, step),
    enabled: !gate.disabled,
  }));
</script>

<div class="weft-replay-view">
  {#if gate.disabled}
    <EmptyState title="Replay unavailable" description={gate.title ?? ''} />
  {:else}
    <div class="weft-replay-view__banner">
      <Rewind aria-hidden="true" size={14} />
      This is a replay. No actions available.
    </div>
    <p class="weft-replay-view__description">
      Re-executes from stored state at step {step}. Read-only; does not affect the live workflow.
    </p>

    {#if replayQuery.isPending}
      <div style="padding: 12px;"><Skeleton height="6rem" /></div>
    {:else if replayQuery.data === null}
      <EmptyState
        title="No replay available"
        description={`No checkpoint is retained at step ${step}.`}
      />
    {:else if replayQuery.data}
      {@const replay = replayQuery.data}
      <div class="weft-replay-view__body">
        <DescriptionList
          items={[
            { term: 'Version', definition: replay.checkpoint.version },
            {
              term: 'Revision',
              definition:
                replay.revision !== undefined
                  ? `${replay.revision}. ${EAGER_REVISION_HEDGE}`
                  : 'Not attributable — the source record was purged, this checkpoint or the workflow record predates execution-token correlation, or the stable id has since been reused by a different run.',
            },
            { term: 'Recorded', definition: new Date(replay.checkpoint.createdAt).toISOString() },
            { term: 'Events at this step', definition: String(replay.events.length) },
            ...(replay.compactedBefore !== undefined
              ? [
                  {
                    term: 'Compacted',
                    definition: `Earlier events before sequence ${replay.compactedBefore} were dropped by retention.`,
                  },
                ]
              : []),
          ]}
        />
        <div class="weft-replay-view__section">
          <div class="weft-replay-view__section-label">Local state</div>
          <PayloadInspector value={replay.checkpoint.locals} label="Checkpoint locals" />
        </div>
        <div class="weft-replay-view__section">
          <div class="weft-replay-view__section-label">
            Accumulated results
            <span class="weft-replay-view__section-meta">
              {formatBytes(JSON.stringify(replay.accumulatedResults).length)}
            </span>
          </div>
          <PayloadInspector value={replay.accumulatedResults} label="Accumulated results" />
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .weft-replay-view {
    background: var(--cinder-surface-raised);
    border: 1px solid var(--cinder-border);
    border-inline-start: 3px solid var(--cinder-info);
    border-radius: var(--cinder-radius-lg);
    overflow: hidden;
  }

  .weft-replay-view__banner {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 14px;
    background: var(--cinder-color-warning-bg);
    color: var(--cinder-color-warning-fg);
    border-bottom: 1px solid var(--cinder-color-warning-border);
    font-size: var(--cinder-text-xs);
    font-weight: 600;
  }

  .weft-replay-view__description {
    margin: 0;
    padding: 12px 14px 0;
    font-size: var(--cinder-text-xs);
    color: var(--cinder-text-subtle);
  }

  .weft-replay-view__body {
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .weft-replay-view__section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .weft-replay-view__section-label {
    font-size: var(--cinder-text-2xs);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--cinder-text-disabled);
  }

  .weft-replay-view__section-meta {
    font-weight: 400;
    text-transform: none;
    letter-spacing: normal;
    margin-inline-start: 6px;
  }
</style>
