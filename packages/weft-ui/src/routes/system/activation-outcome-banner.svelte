<script lang="ts">
  /**
   * Renders one {@link WorkflowActivationOutcome} — the result of a
   * `weft.workflows.revisions.activate` mutation `<WorkflowRevisionsPanel>`
   * just ran — as an explicit, never-color-only outcome banner. Split out
   * of `workflow-revisions-panel.svelte` (WFT-115 review feedback) purely
   * to keep that file under the repository's 500-line implementation-file
   * ceiling; this component owns no state of its own and reads nothing
   * from a query — every prop is already resolved by the caller.
   */
  import { Badge, Button } from '@lostgradient/cinder';
  import { Ban, CheckCircle2, RefreshCw } from 'lucide-svelte';

  import {
    compatibilityReasonLabel,
    type WorkflowActivationOutcome,
  } from './compatibility-verdict.ts';

  interface Props {
    outcome: WorkflowActivationOutcome;
    /** Whether the outcome being rendered came from re-stamping the already-active revision ("Refresh") or activating a genuine candidate ("Activate") — see `workflow-revisions-panel.svelte`'s module doc for why the two need distinct copy. */
    verb: 'Activated' | 'Refreshed';
    onRefresh: () => void;
  }

  let { outcome, verb, onRefresh }: Props = $props();

  function appliedOutcomeMessage(
    applied: Extract<WorkflowActivationOutcome, { kind: 'applied' }>,
  ): string {
    return `${verb} revision "${applied.pointer.revision}" (generation ${applied.pointer.generation}).`;
  }

  function staleOutcomeMessage(
    stale: Extract<WorkflowActivationOutcome, { kind: 'stale' }>,
  ): string {
    return `The active revision changed (current generation ${stale.currentGeneration}). Refresh and try again.`;
  }

  function reasonListItem(reason: string): string {
    return `${compatibilityReasonLabel(reason)} (${reason})`;
  }
</script>

{#if outcome.kind === 'applied'}
  <div class="weft-activation-outcome weft-activation-outcome--applied" role="status">
    <CheckCircle2 aria-hidden="true" size={16} />
    <div>
      <Badge variant="success">Compatible</Badge>
      <p>{appliedOutcomeMessage(outcome)}</p>
    </div>
  </div>
{:else if outcome.kind === 'incompatible'}
  <div class="weft-activation-outcome weft-activation-outcome--incompatible" role="alert">
    <Ban aria-hidden="true" size={16} />
    <div>
      <Badge variant="danger">Incompatible</Badge>
      <ul>
        {#each outcome.reasons as reason, index (index)}
          <li>{reasonListItem(reason)}</li>
        {/each}
      </ul>
    </div>
  </div>
{:else}
  <div class="weft-activation-outcome weft-activation-outcome--stale" role="alert">
    <RefreshCw aria-hidden="true" size={16} />
    <div>
      <Badge variant="warning">Conflict</Badge>
      <p>{staleOutcomeMessage(outcome)}</p>
      <Button size="sm" variant="secondary" label="Refresh" onclick={onRefresh} />
    </div>
  </div>
{/if}

<style>
  .weft-activation-outcome {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px 14px;
    border-radius: var(--cinder-radius-lg);
    border: 1px solid var(--cinder-border);
  }

  .weft-activation-outcome p {
    margin: 6px 0 0;
    font-size: var(--cinder-text-sm);
  }

  .weft-activation-outcome ul {
    margin: 6px 0 0;
    padding-inline-start: 1.1rem;
    font-size: var(--cinder-text-sm);
  }

  .weft-activation-outcome--applied {
    background: var(--cinder-color-success-bg);
    border-color: var(--cinder-color-success-border);
  }

  .weft-activation-outcome--incompatible {
    background: var(--cinder-color-danger-bg);
    border-color: var(--cinder-color-danger-border);
  }

  .weft-activation-outcome--stale {
    background: var(--cinder-color-warning-bg);
    border-color: var(--cinder-color-warning-border);
  }
</style>
