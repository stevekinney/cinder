<script lang="ts">
  /**
   * Test-only harness for `fault-boundary.test.ts`. `<svelte:boundary>`
   * catches errors thrown while rendering its `children` snippet, which a
   * `bun:test` file can't construct directly (a snippet is compiled
   * template syntax) — this tiny component gives the test a controllable
   * child that throws a caller-supplied error on demand, and stops throwing
   * once `shouldThrow` flips to `false` (simulating "the underlying issue
   * is now fixed"), so the test can drive the Retry button through a real
   * recovery.
   */
  import FaultBoundary from './fault-boundary.svelte';
  import type { FaultTreatment } from '../lib/faults.ts';

  interface Props {
    error: unknown;
    shouldThrow?: boolean;
    onFault?: ((treatment: FaultTreatment, error: unknown) => void) | undefined;
  }

  let { error, shouldThrow = true, onFault }: Props = $props();

  function boom(): string {
    throw error;
  }
</script>

<FaultBoundary {onFault}>
  {#snippet children()}
    {#if shouldThrow}
      {boom()}
    {:else}
      <p data-testid="recovered">recovered</p>
    {/if}
  {/snippet}
</FaultBoundary>
