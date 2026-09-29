<script lang="ts">
  /**
   * Diagnostics view (plan §9.4 T5.4): all five kinds with the static
   * guidance copy retained verbatim (`diagnostics-guidance.ts`).
   */
  import { Badge, Button, EmptyState } from '@lostgradient/cinder';

  import { formatRelativeTime, truncateId } from '../../lib/format/index.ts';
  import { DIAGNOSTIC_GUIDANCE } from './diagnostics-guidance.ts';
  import type { TaskDiagnosticItem, TaskDiagnosticsSummary } from './worker-catalog-types.ts';

  interface DiagnosticsViewProps {
    readonly items: readonly TaskDiagnosticItem[];
    readonly summary: TaskDiagnosticsSummary;
    readonly now: number;
    readonly onInspectTask?: (operationId: string) => void;
  }

  let { items, summary, now, onInspectTask = () => {} }: DiagnosticsViewProps = $props();

  interface DiagnosticGroup {
    readonly kind: TaskDiagnosticItem['kind'];
    readonly items: readonly TaskDiagnosticItem[];
  }

  const groups = $derived(
    (
      [
        'stuck-queued',
        'dead-lettered',
        'stale-inflight',
        'retry-storm',
        'all-workers-at-capacity',
        'delayed',
        'unadopted-terminal',
      ] as const
    )
      .map((kind): DiagnosticGroup => ({ kind, items: items.filter((item) => item.kind === kind) }))
      .filter((group) => group.items.length > 0),
  );

  const totalDiagnostics = $derived(
    summary.stuckQueued +
      summary.staleInflight +
      summary.retryStorms +
      summary.allWorkersAtCapacity +
      summary.deadLettered +
      summary.delayed +
      summary.unadoptedTerminal,
  );
</script>

{#if totalDiagnostics === 0}
  <EmptyState
    title="No diagnostics"
    description="Nothing delayed, stuck, stale, retrying, at capacity, unadopted, or dead-lettered right now."
  />
{:else}
  <div class="weft-diagnostics-view">
    {#each groups as group (group.kind)}
      {@const guidance = DIAGNOSTIC_GUIDANCE[group.kind]}
      <div class={`weft-diagnostic-card weft-diagnostic-card--${guidance.variant}`}>
        <div class="weft-diagnostic-card__header">
          <span class="weft-workers-mono weft-diagnostic-card__kind">{guidance.title}</span>
          <Badge variant={guidance.variant}>{group.items.length} affected</Badge>
          <span class="weft-diagnostic-card__meta">
            {#if group.items[0]?.queue}queue: {group.items[0].queue}{/if}
            {#if group.kind === 'dead-lettered' && group.items[0] && 'deadLetteredAt' in group.items[0] && group.items[0].deadLetteredAt}
              · last {formatRelativeTime(group.items[0].deadLetteredAt, now)}
            {/if}
          </span>
        </div>
        <p class="weft-diagnostic-card__guidance">
          <strong>Recommended:</strong>
          {guidance.guidance}
        </p>
        <ul class="weft-diagnostic-card__evidence">
          {#each group.items.slice(0, 3) as item (item.operationId ?? item.workflowId ?? item.queue)}
            <li>
              {#if item.workflowId}
                <span class="weft-workers-id">{truncateId(item.workflowId)}</span>
              {:else if item.operationId}
                <span class="weft-workers-id">{truncateId(item.operationId)}</span>
              {/if}
              {item.evidence[0]}
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
      </div>
    {/each}
  </div>
{/if}
