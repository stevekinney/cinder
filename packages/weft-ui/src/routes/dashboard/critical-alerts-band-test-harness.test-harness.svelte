<script lang="ts">
  /** Test-only composition of `<DashboardTestHarness>` + `<CriticalAlertsBand>`. */
  import type { HttpClient } from '@lostgradient/weft';
  import type { QueryClient } from '@tanstack/svelte-query';

  import type { AuthorizationScope } from '../../lib/scopes.svelte.ts';
  import CriticalAlertsBand from './critical-alerts-band.svelte';
  import DashboardTestHarness from './dashboard-test-harness.test-harness.svelte';

  interface Props {
    client: HttpClient;
    scopes?: readonly AuthorizationScope[] | undefined;
    onQueryClientReady?: ((queryClient: QueryClient) => void) | undefined;
  }

  let { client, scopes, onQueryClientReady }: Props = $props();
</script>

<DashboardTestHarness {client} {scopes} {onQueryClientReady}>
  {#snippet children()}
    <CriticalAlertsBand />
  {/snippet}
</DashboardTestHarness>
