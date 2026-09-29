<script lang="ts">
  /** Test-only composition of `<SchedulesTestHarness>` + `<ScheduleList>` — a snippet can't be built from a plain `.test.ts` file, so each top-level route component gets one small `.svelte` wrapper like this. */
  import type { HttpClient } from '@lostgradient/weft';

  import type { AuthorizationScope } from '../../lib/scopes.svelte.ts';
  import ScheduleList from './schedule-list.svelte';
  import SchedulesTestHarness from './schedules-test-harness.test-harness.svelte';

  interface Props {
    client: HttpClient;
    scopes?: readonly AuthorizationScope[] | undefined;
  }

  let { client, scopes }: Props = $props();
</script>

<SchedulesTestHarness {client} {scopes}>
  {#snippet children()}
    <ScheduleList />
  {/snippet}
</SchedulesTestHarness>
