<script lang="ts">
  /**
   * Test-only harness for `engine-status.svelte.test.ts`'s
   * `getFleetEventSource()` coverage. Mirrors
   * `../lib/get-client-harness.test-harness.svelte`'s pattern — see that
   * file's doc for why a bare call from a `bun:test` file can't reach
   * `getFleetEventSource()`'s own "no source in context" throw directly.
   */
  import { untrack } from 'svelte';

  import { getFleetEventSource } from './engine-status.svelte.ts';
  import type { FleetEventSource } from '../lib/live-source/fleet-event-source.svelte.ts';

  interface Props {
    onSource?: ((source: FleetEventSource) => void) | undefined;
  }

  let { onSource }: Props = $props();

  const source = getFleetEventSource();
  untrack(() => onSource)?.(source);
</script>
