<script lang="ts">
  /**
   * Test-only harness for the Workers route root (`index.svelte`): wraps it
   * with every context provider it needs — `provideClient()`
   * (`src/lib/client.ts`), `QueryClientProvider` (`@tanstack/svelte-query`),
   * `providePrincipalStore()` (`src/lib/scopes.svelte.ts`), and
   * `provideFleetEventSource()` (`src/app/engine-status.svelte.ts`) —
   * mirroring `src/routes/system/system-route-test-harness.test-harness.svelte`'s
   * identical shape for the same reason: `index.svelte` reads all four via
   * context, not props.
   */
  import type { HttpClient } from '@lostgradient/weft';
  import { QueryClientProvider, type QueryClient } from '@tanstack/svelte-query';
  import { onDestroy, untrack, type Component } from 'svelte';

  import { provideFleetEventSource } from '../../app/engine-status.svelte.ts';
  import { provideClient } from '../../lib/client.ts';
  import { FleetEventSource } from '../../lib/live-source/fleet-event-source.svelte.ts';
  import {
    AUTHORIZATION_SCOPES,
    providePrincipalStore,
    type AuthorizationScope,
  } from '../../lib/scopes.svelte.ts';

  interface Props {
    client: HttpClient;
    queryClient: QueryClient;
    component: Component;
    principalScopes?: readonly AuthorizationScope[];
  }

  let { client, queryClient, component: RouteComponent, principalScopes }: Props = $props();

  provideClient(untrack(() => client));

  const principalStore = providePrincipalStore();
  principalStore.setPrincipal({
    scopes: untrack(() => principalScopes) ?? AUTHORIZATION_SCOPES,
    unauthenticatedAccess: null,
  });

  // `index.svelte`'s `getFleetEventSource()` call (the Live toggle's shared
  // subscription — plan §5's one-fleet-SSE budget) needs a real provided
  // instance, not a fake object literal, since the context accessor is
  // typed against the concrete `FleetEventSource` class. Reuses the SAME
  // real server the `client` prop points at, mirroring
  // `schedules-test-harness.test-harness.svelte`'s identical pattern.
  const fleetSource = untrack(
    () => new FleetEventSource({ baseUrl: client.baseUrl, headers: client.headers }),
  );
  provideFleetEventSource(fleetSource);
  onDestroy(() => fleetSource.close());
</script>

<QueryClientProvider client={queryClient}>
  <RouteComponent />
</QueryClientProvider>
