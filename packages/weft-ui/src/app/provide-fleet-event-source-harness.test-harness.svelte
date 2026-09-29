<script lang="ts">
  /**
   * Test-only harness for `engine-status.svelte.test.ts`. Mirrors how
   * `shell.svelte` actually uses these two functions: a parent calls
   * `provideFleetEventSource()` during its own setup, and a child renders
   * below it and calls `getFleetEventSource()`.
   */
  import { untrack } from 'svelte';

  import { provideFleetEventSource } from './engine-status.svelte.ts';
  import GetFleetEventSourceHarness from './get-fleet-event-source-harness.test-harness.svelte';
  import type { FleetEventSource } from '../lib/live-source/fleet-event-source.svelte.ts';

  interface Props {
    source: FleetEventSource;
    onSource?: ((source: FleetEventSource) => void) | undefined;
  }

  let { source, onSource }: Props = $props();

  provideFleetEventSource(untrack(() => source));
</script>

<GetFleetEventSourceHarness {onSource} />
