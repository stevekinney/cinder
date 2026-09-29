<script lang="ts">
  /** Test-only composition of `<SchedulesTestHarness>` + the Schedule health dashboard card. */
  import type { HttpClient } from '@lostgradient/weft';

  import SchedulesTestHarness from '../schedules-test-harness.test-harness.svelte';
  import DashboardCard from './dashboard-card.svelte';

  interface Props {
    client: HttpClient;
  }

  let { client }: Props = $props();
</script>

<SchedulesTestHarness {client}>
  {#snippet children()}
    <DashboardCard />
  {/snippet}
</SchedulesTestHarness>
