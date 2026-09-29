<script lang="ts">
  /**
   * Task queues list (plan §9.4 T5.3): backlog, in-flight, connected
   * workers, diagnostics presence per queue.
   */
  import { Badge, EmptyState, Table } from '@lostgradient/cinder';

  import { router } from '../../lib/router.svelte.ts';
  import type { TaskDiagnosticItem, TaskQueueHealth } from './worker-catalog-types.ts';
  import { queueBacklogVariant } from './worker-presentation.ts';

  interface QueueListViewProps {
    readonly queues: readonly TaskQueueHealth[];
    readonly diagnostics: readonly TaskDiagnosticItem[];
  }

  let { queues, diagnostics }: QueueListViewProps = $props();

  function hasDiagnostics(queueName: string): boolean {
    return diagnostics.some((item) => item.queue === queueName);
  }

  function detailHref(queueName: string): string {
    return router.href(`/workers?tab=queues&queue=${encodeURIComponent(queueName)}`);
  }

  function onQueueLinkClick(event: MouseEvent, queueName: string): void {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    event.preventDefault();
    router.navigate(`/workers?tab=queues&queue=${encodeURIComponent(queueName)}`);
  }
</script>

{#if queues.length === 0}
  <EmptyState
    title="No task queues"
    description="Queues appear here once a workflow dispatches an activity or a worker connects."
  />
{:else}
  <Table caption="Task queues" scrollable class="weft-queues-table">
    <colgroup>
      <col />
      <col style="width: 110px" />
      <col style="width: 110px" />
      <col style="width: 110px" />
      <col style="width: 130px" />
    </colgroup>
    <Table.Header>
      <Table.Row>
        <Table.HeaderCell>Queue</Table.HeaderCell>
        <Table.HeaderCell align="right">Workers</Table.HeaderCell>
        <Table.HeaderCell align="right">In-flight</Table.HeaderCell>
        <Table.HeaderCell align="right">Queued</Table.HeaderCell>
        <Table.HeaderCell>Diagnostics</Table.HeaderCell>
      </Table.Row>
    </Table.Header>
    <Table.Body>
      {#each queues as queue (queue.queue)}
        <Table.Row>
          <Table.Cell>
            <a
              class="weft-workers-mono weft-workers-id-link"
              href={detailHref(queue.queue)}
              onclick={(event) => onQueueLinkClick(event, queue.queue)}
            >
              {queue.queue}
            </a>
          </Table.Cell>
          <Table.Cell align="right"
            ><span class="weft-workers-mono">{queue.connectedWorkers}</span></Table.Cell
          >
          <Table.Cell align="right"
            ><span class="weft-workers-mono">{queue.inFlight}</span></Table.Cell
          >
          <Table.Cell align="right">
            <span class="weft-workers-mono" data-variant={queueBacklogVariant(queue.backlog)}
              >{queue.backlog}</span
            >
          </Table.Cell>
          <Table.Cell>
            {#if hasDiagnostics(queue.queue)}
              <Badge variant="warning" size="sm">Active</Badge>
            {/if}
          </Table.Cell>
        </Table.Row>
      {/each}
    </Table.Body>
  </Table>
{/if}
