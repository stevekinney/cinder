<script lang="ts">
  /** Test-only composition of `<SchedulesTestHarness>` + the Schedules domain router (`index.svelte`). */
  import type { HttpClient } from '@lostgradient/weft';

  import SchedulesIndex from './index.svelte';
  import SchedulesTestHarness from './schedules-test-harness.test-harness.svelte';

  interface Props {
    client: HttpClient;
  }

  let { client }: Props = $props();
</script>

<SchedulesTestHarness {client}>
  {#snippet children()}
    <SchedulesIndex />
  {/snippet}
</SchedulesTestHarness>
