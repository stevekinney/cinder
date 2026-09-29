<script lang="ts">
  /**
   * Test-only harness mounting `dashboard-card.svelte` under the Svelte
   * context it needs at runtime (`HttpClient` via `provideClient()`, a
   * `PrincipalStore`, and a `QueryClientProvider`) — mirrors
   * `reviews/reviews-test-harness.test-harness.svelte`'s pattern. Never
   * imported by production code.
   */
  import { untrack } from 'svelte';

  import type { HttpClient } from '@lostgradient/weft';

  import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';

  import { provideClient } from '../../../lib/client.ts';
  import { providePrincipalStore, type AuthorizationScope } from '../../../lib/scopes.svelte.ts';
  import WorkersDashboardCard from './dashboard-card.svelte';

  interface WorkersCardTestHarnessProps {
    client: HttpClient;
    scopes?: readonly AuthorizationScope[];
  }

  let { client, scopes = ['system:read'] }: WorkersCardTestHarnessProps = $props();

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  provideClient(untrack(() => client));
  const principalStore = providePrincipalStore();
  principalStore.setPrincipal({ scopes: untrack(() => scopes), unauthenticatedAccess: null });
</script>

<QueryClientProvider client={queryClient}>
  <WorkersDashboardCard />
</QueryClientProvider>
