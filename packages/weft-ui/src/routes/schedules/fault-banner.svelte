<script lang="ts">
  /**
   * Inline fault banner for a query-level error (plan §10.4's six-treatment
   * `FaultDisplay`; design `Weft Patterns.dc.html` "Fault / error banner").
   * `<FaultBoundary>` (`src/app/fault-boundary.svelte`) only catches
   * exceptions thrown while rendering — `src/lib/query.ts`'s own doc is
   * explicit that a query's `query.error` must be classified and rendered
   * inline by the route component instead. No shared `FaultDisplay`
   * component exists yet (Foundation didn't ship one — verified: `grep -rl
   * FaultDisplay src/` finds only `fault-boundary.svelte`'s private
   * snippet), so this is Track B's own small, reusable rendering — every
   * Schedules surface with a query goes through this one file rather than
   * repeating the treatment mapping per screen.
   */
  import { Alert, Button } from '@lostgradient/cinder';

  import {
    FAULT_TREATMENT_TITLE,
    type FaultTreatment,
    type FaultTreatmentKind,
  } from '../../lib/faults.ts';

  interface FaultBannerProps {
    treatment: FaultTreatment;
    onRetry?: (() => void) | undefined;
  }

  let { treatment, onRetry }: FaultBannerProps = $props();

  const ALERT_VARIANT: Readonly<Record<FaultTreatmentKind, 'info' | 'warning' | 'danger'>> = {
    'not-found': 'info',
    conflict: 'warning',
    invalid: 'danger',
    unauthorized: 'danger',
    'not-supported': 'info',
    internal: 'danger',
  };
</script>

<Alert variant={ALERT_VARIANT[treatment.kind]} class="weft-schedules-fault-banner">
  <strong>{FAULT_TREATMENT_TITLE[treatment.kind]}</strong>
  <span class="weft-schedules-fault-banner__message">{treatment.message}</span>
  {#if treatment.kind === 'internal' && treatment.tryViaJsonRpc}
    <span class="weft-schedules-fault-banner__note">
      The REST API hides internal error detail on this response — retry via JSON-RPC for the full
      fault.
    </span>
  {/if}
  {#if onRetry}
    <Button size="sm" variant="secondary" label="Retry" onclick={onRetry} />
  {/if}
</Alert>

<style>
  :global(.weft-schedules-fault-banner) {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--cinder-space-2, 0.5rem) var(--cinder-space-3, 0.75rem);
  }

  .weft-schedules-fault-banner__message {
    flex: 1 1 auto;
  }

  .weft-schedules-fault-banner__note {
    flex-basis: 100%;
    font-size: var(--cinder-text-xs);
    color: var(--cinder-text-muted);
  }
</style>
