<script lang="ts">
  /** Test-only composition of `<DashboardTestHarness>` + the Dashboard route's `<Index>` component. */
  import type { HttpClient } from '@lostgradient/weft';

  import type { AuthorizationScope } from '../../lib/scopes.svelte.ts';
  import DashboardTestHarness from './dashboard-test-harness.test-harness.svelte';
  import DashboardIndex from './index.svelte';

  interface Props {
    client: HttpClient;
    scopes?: readonly AuthorizationScope[] | undefined;
  }

  let { client, scopes }: Props = $props();
</script>

<DashboardTestHarness {client} {scopes}>
  {#snippet children()}
    <DashboardIndex />
  {/snippet}
</DashboardTestHarness>
