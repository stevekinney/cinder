<script lang="ts">
  /**
   * Test-only harness providing every context a workflows-track route
   * component reads: `HttpClient` (`getClient()`), `PrincipalStore`
   * (`getPrincipalStore()`), the shared `FleetEventSource`
   * (`getFleetEventSource()`), and a `QueryClient`
   * (`@tanstack/svelte-query`'s own `QueryClientProvider`). Mirrors the
   * `provide-client-harness.test-harness.svelte` one-provider-per-file
   * pattern, combined into one harness since every route in this track
   * needs all four simultaneously — see that file's doc for the `untrack()`
   * "read props exactly once, at init" convention this also follows.
   */
  import { untrack, type Snippet } from 'svelte';

  import type { HttpClient } from '@lostgradient/weft';
  import { QueryClientProvider, type QueryClient } from '@tanstack/svelte-query';

  import { provideFleetEventSource } from '../../../app/engine-status.svelte.ts';
  import { provideClient } from '../../../lib/client.ts';
  import { FleetEventSource } from '../../../lib/live-source/fleet-event-source.svelte.ts';
  import { providePrincipalStore, type Principal } from '../../../lib/scopes.svelte.ts';

  interface WorkflowRouteHarnessProps {
    client: HttpClient;
    principal: Principal;
    queryClient: QueryClient;
    children: Snippet;
  }

  let { client, principal, queryClient, children }: WorkflowRouteHarnessProps = $props();

  provideClient(untrack(() => client));
  const principalStore = providePrincipalStore();
  principalStore.setPrincipal(untrack(() => principal));
  // Never subscribed in a test unless the test itself flips Live on, so
  // this never issues a real fetch — see `WorkflowListLiveController`
  // (`enable()` is the only thing that calls `FleetEventSource.subscribe`).
  provideFleetEventSource(untrack(() => new FleetEventSource({ baseUrl: 'http://weft.test' })));
</script>

<QueryClientProvider client={queryClient}>
  {@render children()}
</QueryClientProvider>
