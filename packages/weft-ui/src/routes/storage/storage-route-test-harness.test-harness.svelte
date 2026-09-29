<script lang="ts">
  /**
   * Test-only harness mounting the real Storage route (`./index.svelte`)
   * under the Svelte context it needs at runtime — mirrors the pattern
   * `src/routes/reviews/reviews-test-harness.test-harness.svelte` documents
   * (a harness renders ONE fixed subject, not an arbitrary snippet). Never
   * imported by production code.
   */
  import { untrack } from 'svelte';

  import type { HttpClient } from '@lostgradient/weft';

  import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';

  import { provideClient } from '../../lib/client.ts';
  import { providePrincipalStore, type AuthorizationScope } from '../../lib/scopes.svelte.ts';
  import StorageRoute from './index.svelte';

  interface StorageRouteTestHarnessProps {
    client: HttpClient;
    scopes?: readonly AuthorizationScope[];
  }

  let { client, scopes = ['storage:admin'] }: StorageRouteTestHarnessProps = $props();

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  provideClient(untrack(() => client));
  const principalStore = providePrincipalStore();
  principalStore.setPrincipal({ scopes: untrack(() => scopes), unauthenticatedAccess: null });
</script>

<QueryClientProvider client={queryClient}>
  <StorageRoute />
</QueryClientProvider>
