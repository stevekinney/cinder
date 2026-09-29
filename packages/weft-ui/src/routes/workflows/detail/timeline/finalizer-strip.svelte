<script lang="ts">
  /**
   * Finalizer strip (plan T3.2, design `Weft New Surfaces.dc.html` §F: "Weft
   * concept, not a RunStepTimeline primitive") + the run-level Finalizing /
   * Cancelled — cleanup failed badges.
   *
   * ## Durable, as of weft 0.15.0 — not a live-feed-only observation anymore
   *
   * This used to render from `WorkflowLiveObservations`' session-scoped,
   * live-event-only `finalizingLive`/`finalizerTeardown` state, and it
   * empirically never populated on a typical page load (see this repo's git
   * history / the removed module doc on `workflow-live-observations.svelte.ts`
   * for the confirmed replay-ordering reason) — weft#732 item 4 asked for a
   * durable field instead. `@lostgradient/weft@0.15.0` (PR #760) shipped
   * `weft.workflows.finalizer.get`, so `status` here is the same durable
   * `WorkflowFinalizerStatus | null` `workflow-detail.svelte` fetches once and
   * passes to both this strip and the header badge (`workflow-status.ts`'s
   * `finalizerStatusPresentation` — the two surfaces now derive their special
   * statuses from the exact same field instead of two independent
   * heuristics). Renders nothing when the workflow recorded no finalizer work
   * (`status === null`) or the query hasn't resolved yet (`undefined`).
   */
  import { Badge, StatusDot } from '@lostgradient/cinder';
  import type { WorkflowFinalizerStatus, WorkflowStatus } from '@lostgradient/weft';
  import { CircleX, Loader, Paintbrush, TriangleAlert } from 'lucide-svelte';

  import { finalizerStatusPresentation } from '../workflow-status.ts';

  interface FinalizerStripProps {
    /** The workflow's base terminal status — only `cancelled`/`timed-out` ever carry finalizer work; used for wording ("Cancelled" vs "Timed out"). */
    readonly baseStatus: WorkflowStatus;
    /** `weft.workflows.finalizer.get` result. `undefined` while loading, `null` when nothing was recorded — both render nothing. */
    readonly status: WorkflowFinalizerStatus | null | undefined;
  }

  let { baseStatus, status }: FinalizerStripProps = $props();

  const presentation = $derived(finalizerStatusPresentation(baseStatus, status));
  const inFlight = $derived(status?.status === 'pending' || status?.status === 'running');
  const failed = $derived(status?.status === 'failed');
  const succeeded = $derived(status?.status === 'succeeded');
</script>

{#if status !== null && status !== undefined}
  <div class="weft-finalizer-strip">
    {#if inFlight || failed}
      <div class="weft-finalizer-strip__badges">
        <span class="weft-finalizer-strip__badges-label">Special statuses</span>
        <Badge variant={presentation.variant}>
          {#if inFlight}
            <Loader aria-hidden="true" size={11} />
          {:else}
            <TriangleAlert aria-hidden="true" size={11} />
          {/if}
          {presentation.label}
        </Badge>
      </div>
    {/if}

    <div class="weft-finalizer-strip__section">
      <div class="weft-finalizer-strip__section-label">
        <Paintbrush aria-hidden="true" size={12} />
        Finalizer · runs after {baseStatus === 'timed-out' ? 'a timeout' : 'cancellation'}
      </div>
      <div class="weft-finalizer-strip__row">
        {#if inFlight}
          <StatusDot status="pending" label="Finalizer pending" labelVisible={false} />
          <span class="weft-finalizer-strip__row-name">Awaiting completion…</span>
        {:else if status}
          <StatusDot
            status={succeeded ? 'success' : 'danger'}
            label={succeeded ? 'Finalizer completed' : 'Finalizer failed'}
            labelVisible={false}
          />
          <span class="weft-finalizer-strip__row-name">
            Teardown {succeeded ? 'completed' : 'failed'}
            {#if status.attempts > 1}
              · {status.attempts} attempts
            {/if}
          </span>
          {#if failed}
            <Badge size="sm" variant="danger">
              <CircleX aria-hidden="true" size={10} />
              Failed
            </Badge>
          {/if}
        {/if}
      </div>
      {#if status && 'error' in status}
        <p class="weft-finalizer-strip__error">{status.error}</p>
      {/if}
    </div>
  </div>
{/if}

<style>
  .weft-finalizer-strip {
    margin-top: 12px;
    padding: 12px;
    background: var(--cinder-surface-raised);
    border: 1px solid var(--cinder-border);
    border-radius: var(--cinder-radius-lg);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .weft-finalizer-strip__badges {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .weft-finalizer-strip__badges-label {
    font-size: var(--cinder-text-2xs);
    color: var(--cinder-text-disabled);
  }

  .weft-finalizer-strip__section {
    background: var(--cinder-surface-inset);
    border-radius: var(--cinder-radius-md);
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .weft-finalizer-strip__section-label {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: var(--cinder-text-2xs);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--cinder-text-subtle);
  }

  .weft-finalizer-strip__row {
    display: flex;
    align-items: center;
    gap: 9px;
    font-size: var(--cinder-text-xs);
  }

  .weft-finalizer-strip__row-name {
    flex: 1;
  }

  .weft-finalizer-strip__error {
    margin: 0;
    font-size: var(--cinder-text-2xs);
    color: var(--cinder-color-danger-fg);
  }
</style>
