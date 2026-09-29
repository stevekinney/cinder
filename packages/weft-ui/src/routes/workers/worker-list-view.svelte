<script lang="ts">
  /**
   * Worker list (plan §9.4 T5.2): dense table, In-flight/Concurrency as
   * `Meter`. Compositional `Table` family, not `DataTable` — same reasoning
   * as `workflow-table.svelte` (badges, a meter, a copyable id are real cell
   * content `DataTable`'s plain `row[column.key]` interpolation can't render).
   */
  import { Badge, EmptyState, Meter, Table } from '@lostgradient/cinder';

  import { formatDuration, truncateId } from '../../lib/format/index.ts';
  import { router } from '../../lib/router.svelte.ts';
  import type { WorkerSummary } from './worker-catalog-types.ts';
  import {
    heartbeatSeverity,
    heartbeatSeverityCssVariable,
    workerHealthPresentation,
  } from './worker-presentation.ts';

  interface WorkerListViewProps {
    readonly workers: readonly WorkerSummary[];
  }

  let { workers }: WorkerListViewProps = $props();

  function detailHref(workerId: string): string {
    return router.href(`/workers?tab=list&worker=${encodeURIComponent(workerId)}`);
  }

  function onIdLinkClick(event: MouseEvent, workerId: string): void {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    event.preventDefault();
    router.navigate(`/workers?tab=list&worker=${encodeURIComponent(workerId)}`);
  }
</script>

{#if workers.length === 0}
  <EmptyState
    title="No workers connected"
    description="Connect a RemoteWorker to this queue to see it here — see the SDK docs for `RemoteWorker`."
  />
{:else}
  <Table caption="Workers" scrollable class="weft-workers-table">
    <colgroup>
      <col style="width: 200px" />
      <col style="width: 120px" />
      <col style="width: 140px" />
      <col style="width: 120px" />
      <col style="width: 200px" />
      <col style="width: 110px" />
    </colgroup>
    <Table.Header>
      <Table.Row>
        <Table.HeaderCell>Worker ID</Table.HeaderCell>
        <Table.HeaderCell>Queue</Table.HeaderCell>
        <Table.HeaderCell>Deployment</Table.HeaderCell>
        <Table.HeaderCell>Health</Table.HeaderCell>
        <Table.HeaderCell>In-flight</Table.HeaderCell>
        <Table.HeaderCell align="right">Heartbeat</Table.HeaderCell>
      </Table.Row>
    </Table.Header>
    <Table.Body>
      {#each workers as worker (worker.id)}
        {@const presentation = workerHealthPresentation(worker)}
        {@const severity = heartbeatSeverity(worker.heartbeatAgeMs)}
        <Table.Row>
          <Table.Cell>
            <a
              class="weft-workers-id-link"
              href={detailHref(worker.id)}
              onclick={(event) => onIdLinkClick(event, worker.id)}
              title={worker.id}
            >
              {truncateId(worker.id)}
            </a>
          </Table.Cell>
          <Table.Cell><span class="weft-workers-mono">{worker.queue}</span></Table.Cell>
          <Table.Cell>{worker.deploymentName ?? '—'}</Table.Cell>
          <Table.Cell
            ><Badge variant={presentation.variant} size="sm">{presentation.label}</Badge
            ></Table.Cell
          >
          <Table.Cell>
            <div class="weft-worker-meter">
              <span class="weft-workers-mono weft-worker-meter__value"
                >{worker.inFlight}/{worker.concurrency}</span
              >
              <Meter
                value={worker.inFlight}
                max={worker.concurrency}
                size="sm"
                ariaLabel={`In-flight tasks for worker ${worker.id}`}
                ariaValueText={`${worker.inFlight} of ${worker.concurrency}`}
                class="weft-worker-meter__meter"
              />
            </div>
          </Table.Cell>
          <Table.Cell align="right">
            <span
              class="weft-workers-mono weft-heartbeat"
              data-severity={severity}
              style={`color: ${heartbeatSeverityCssVariable(severity)}`}
            >
              {formatDuration(worker.heartbeatAgeMs)}
            </span>
          </Table.Cell>
        </Table.Row>
      {/each}
    </Table.Body>
  </Table>
{/if}
