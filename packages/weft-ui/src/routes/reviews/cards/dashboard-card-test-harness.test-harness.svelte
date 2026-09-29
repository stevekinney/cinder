<script lang="ts">
  /**
   * Test-only harness mounting the Reviews dashboard card under the Svelte
   * context it needs (mirrors `../reviews-test-harness.test-harness.svelte`
   * — see that module's doc for why harnesses hard-code their child rather
   * than accepting a snippet prop). Never imported by production code.
   */
  import { untrack } from 'svelte';

  import type { HttpClient } from '@lostgradient/weft';

  import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';

  import { provideClient } from '../../../lib/client.ts';
  import { providePrincipalStore, type AuthorizationScope } from '../../../lib/scopes.svelte.ts';
  import DashboardCard from './dashboard-card.svelte';

  interface DashboardCardTestHarnessProps {
    client: HttpClient;
    scopes?: readonly AuthorizationScope[];
  }

  let { client, scopes = ['reviews:read'] }: DashboardCardTestHarnessProps = $props();

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  provideClient(untrack(() => client));
  const principalStore = providePrincipalStore();
  principalStore.setPrincipal({ scopes: untrack(() => scopes), unauthenticatedAccess: null });
</script>

<QueryClientProvider client={queryClient}>
  <DashboardCard />
</QueryClientProvider>
