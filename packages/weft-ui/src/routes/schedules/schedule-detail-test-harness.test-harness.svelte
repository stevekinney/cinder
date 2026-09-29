<script lang="ts">
  /** Test-only composition of `<SchedulesTestHarness>` + `<ScheduleDetail>` — see `schedule-list-test-harness.test-harness.svelte`'s doc for why this wrapper exists. */
  import type { HttpClient } from '@lostgradient/weft';

  import type { AuthorizationScope } from '../../lib/scopes.svelte.ts';
  import ScheduleDetail from './schedule-detail.svelte';
  import SchedulesTestHarness from './schedules-test-harness.test-harness.svelte';

  interface Props {
    client: HttpClient;
    id: string;
    scopes?: readonly AuthorizationScope[] | undefined;
  }

  let { client, id, scopes }: Props = $props();
</script>

<SchedulesTestHarness {client} {scopes}>
  {#snippet children()}
    <ScheduleDetail {id} />
  {/snippet}
</SchedulesTestHarness>
