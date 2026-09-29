<script lang="ts">
  /**
   * Worker detail (plan §9.4 T5.2): connection info, activities, drain
   * banner, drain/resume actions.
   */
  import { Badge, Button, DescriptionList, Tooltip } from '@lostgradient/cinder';

  import { formatDuration, truncateId } from '../../lib/format/index.ts';
  import type { ScopeGate } from '../../lib/scopes.svelte.ts';
  import type { WorkerSummary } from './worker-catalog-types.ts';
  import WorkerManifestPanel from './worker-manifest-panel.svelte';
  import type { WorkerManifestDiagnostics } from './worker-manifest-diagnostics.ts';
  import { workerHealthPresentation } from './worker-presentation.ts';

  interface WorkerDetailViewProps {
    readonly worker: WorkerSummary;
    readonly adminGate: ScopeGate;
    readonly onDrain: () => void;
    readonly onResume: () => void;
    readonly manifestDiagnostics?: WorkerManifestDiagnostics | null | undefined;
    readonly manifestLoading?: boolean;
    readonly manifestRefreshing?: boolean;
    readonly manifestError?: unknown;
  }

  let {
    worker,
    adminGate,
    onDrain,
    onResume,
    manifestDiagnostics = undefined,
    manifestLoading = false,
    manifestRefreshing = false,
    manifestError = null,
  }: WorkerDetailViewProps = $props();

  const presentation = $derived(workerHealthPresentation(worker));

  const connectionItems = $derived([
    { term: 'Queue', definition: worker.queue },
    { term: 'Connected', definition: formatDuration(Date.now() - worker.connectedAt) + ' ago' },
    {
      term: 'Build',
      definition: worker.buildId ?? '—',
    },
    { term: 'Concurrency', definition: `${worker.inFlight} / ${worker.concurrency}` },
  ]);
</script>

<div class="weft-worker-detail">
  <div class="weft-worker-detail__header">
    <span class="weft-workers-id" title={worker.id}>{truncateId(worker.id)}</span>
    <Badge variant={presentation.variant}>{presentation.label}</Badge>
    <div class="weft-worker-detail__actions">
      {#if adminGate.disabled}
        <Tooltip text={adminGate.title ?? ''}>
          <Button
            variant="secondary"
            size="sm"
            disabled
            label={worker.health === 'draining' ? 'Resume' : 'Drain'}
          />
        </Tooltip>
      {:else if worker.health === 'draining'}
        <Button variant="secondary" size="sm" label="Resume" onclick={onResume} />
      {:else}
        <Button variant="secondary" size="sm" label="Drain" onclick={onDrain} />
      {/if}
    </div>
  </div>

  {#if worker.health === 'draining'}
    <div class="weft-workers-callout weft-workers-callout--warning">
      Draining — finishing {worker.inFlight} in-flight task{worker.inFlight === 1 ? '' : 's'},
      accepting no new work.
    </div>
  {/if}

  <div class="weft-worker-detail__grid">
    <div class="weft-workers-panel">
      <div class="weft-workers-panel__header">Connection</div>
      <DescriptionList items={connectionItems} />
    </div>
    <div class="weft-workers-panel">
      <div class="weft-workers-panel__header">Activities</div>
      <div class="weft-worker-detail__activities">
        {#each worker.activities as activity (activity)}
          <Badge variant="neutral" monospace>{activity}</Badge>
        {/each}
      </div>
    </div>
  </div>

  <WorkerManifestPanel
    diagnostics={manifestDiagnostics}
    loading={manifestLoading}
    refreshing={manifestRefreshing}
    error={manifestError}
    capabilities={worker.capabilities}
  />
</div>
