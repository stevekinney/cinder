<script lang="ts">
  /**
   * Queue detail (plan §9.4 T5.3): routing/scheduling strategy, workers on
   * the queue, dead-letter section (Tier-3 type-to-confirm clear per
   * dead-lettered task — see `clear-dead-letter-dialog.svelte`'s doc comment
   * for why this is per-`operationId`, not a single queue-wide button: the
   * server operation `weft.tasks.diagnostics.deadletters.clear` clears
   * exactly one `operationId`, so a queue with N dead-lettered tasks needs N
   * individually-confirmed clears, not one bulk action the API doesn't
   * offer).
   */
  import { Badge, Button, DescriptionList, Tooltip } from '@lostgradient/cinder';

  import { truncateId } from '../../lib/format/index.ts';
  import type { ScopeGate } from '../../lib/scopes.svelte.ts';
  import { DIAGNOSTIC_GUIDANCE } from './diagnostics-guidance.ts';
  import type { RoutingPolicy } from '@lostgradient/weft';
  import type {
    TaskDiagnosticItem,
    TaskQueueHealth,
    WorkerSummary,
  } from './worker-catalog-types.ts';
  import { workerHealthPresentation } from './worker-presentation.ts';

  interface QueueDetailViewProps {
    readonly queue: TaskQueueHealth;
    readonly routingPolicy: RoutingPolicy;
    readonly workersOnQueue: readonly WorkerSummary[];
    readonly deadLetteredItems: readonly TaskDiagnosticItem[];
    readonly diagnosticItems?: readonly TaskDiagnosticItem[];
    readonly adminGate: ScopeGate;
    readonly onClearDeadLetter: (operationId: string) => void;
    readonly onInspectTask?: (operationId: string) => void;
  }

  let {
    queue,
    routingPolicy,
    workersOnQueue,
    deadLetteredItems,
    diagnosticItems = deadLetteredItems,
    adminGate,
    onClearDeadLetter,
    onInspectTask = () => {},
  }: QueueDetailViewProps = $props();

  const strategyItems = $derived([
    { term: 'Routing', definition: routingPolicy },
    { term: 'Scheduling', definition: queue.schedulingPolicy },
  ]);
</script>

<div class="weft-queue-detail">
  <div class="weft-queue-detail__header">
    <span class="weft-workers-mono weft-queue-detail__name">{queue.queue}</span>
    {#if diagnosticItems.length > 0}
      <Badge variant="warning">{diagnosticItems.length} diagnostics</Badge>
    {/if}
  </div>

  <div class="weft-queue-detail__grid">
    <div class="weft-workers-panel">
      <div class="weft-workers-panel__header">Strategy</div>
      <DescriptionList items={strategyItems} />
    </div>

    <div class="weft-workers-callout weft-workers-callout--danger weft-dead-letter-panel">
      <div class="weft-dead-letter-panel__header">
        <span>Dead letter</span>
        <Badge variant="danger">{deadLetteredItems.length} tasks</Badge>
      </div>
      <p class="weft-dead-letter-panel__description">
        Tasks that exhausted their retry policy. Clearing is irreversible.
      </p>
      {#if deadLetteredItems.length === 0}
        <p class="weft-dead-letter-panel__empty">No dead-lettered tasks on this queue.</p>
      {:else}
        <ul class="weft-dead-letter-panel__list">
          {#each deadLetteredItems as item (item.operationId)}
            <li class="weft-dead-letter-panel__item">
              <span class="weft-workers-id" title={item.operationId}
                >{truncateId(item.operationId ?? '')}</span
              >
              <span class="weft-dead-letter-panel__activity"
                >{'activityName' in item ? (item.activityName ?? 'activity') : 'activity'}</span
              >
              <Button
                variant="ghost"
                size="sm"
                label="Inspect ledger"
                onclick={() => item.operationId && onInspectTask(item.operationId)}
              />
              {#if adminGate.disabled}
                <Tooltip text={adminGate.title ?? ''}>
                  <Button variant="secondary" size="sm" disabled label="Clear" />
                </Tooltip>
              {:else}
                <Button
                  variant="secondary"
                  size="sm"
                  label="Clear"
                  onclick={() => item.operationId && onClearDeadLetter(item.operationId)}
                />
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>

  <div class="weft-workers-panel">
    <div class="weft-workers-panel__header">Recovery diagnostics</div>
    {#if diagnosticItems.length === 0}
      <p class="weft-queue-detail__no-workers">No recovery diagnostics on this queue.</p>
    {:else}
      <ul class="weft-dead-letter-panel__list">
        {#each diagnosticItems as item (item.kind + (item.operationId ?? item.queue))}
          {@const guidance = DIAGNOSTIC_GUIDANCE[item.kind]}
          <li class="weft-dead-letter-panel__item">
            <Badge variant={guidance.variant} size="sm">{guidance.title}</Badge>
            <span>{item.evidence[0]}</span>
            {#if item.operationId}
              <Button
                variant="ghost"
                size="sm"
                label="Inspect ledger"
                onclick={() => onInspectTask(item.operationId ?? '')}
              />
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  <div class="weft-workers-panel">
    <div class="weft-workers-panel__header">Workers on this queue</div>
    {#if workersOnQueue.length === 0}
      <p class="weft-queue-detail__no-workers">No connected workers are polling this queue.</p>
    {:else}
      <ul class="weft-queue-workers-list">
        {#each workersOnQueue as worker (worker.id)}
          {@const presentation = workerHealthPresentation(worker)}
          <li class="weft-queue-workers-list__row">
            <span class="weft-workers-id">{truncateId(worker.id)}</span>
            <Badge variant={presentation.variant} size="sm">{presentation.label}</Badge>
            <span class="weft-workers-mono weft-queue-workers-list__inflight"
              >{worker.inFlight}/{worker.concurrency}</span
            >
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</div>
