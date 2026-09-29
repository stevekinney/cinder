<script lang="ts">
  /**
   * Shared component-test harness for the Schedules track. Wires the three
   * contexts every route component needs — `QueryClientProvider`
   * (`@tanstack/svelte-query`), `provideClient()`, `providePrincipalStore()`
   * — around a `children` snippet, mirroring how `src/app/app.svelte` /
   * `shell.svelte` actually provide them in the real app. Test-only; not
   * built into the production bundle (`.test-harness.svelte` is a
   * build-excluded pattern per `weft`'s conventions this repo mirrors).
   */
  import type { HttpClient } from '@lostgradient/weft';

  import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
  import type { Snippet } from 'svelte';
  import { onDestroy, untrack } from 'svelte';

  import { provideFleetEventSource } from '../../app/engine-status.svelte.ts';
  import { provideClient } from '../../lib/client.ts';
  import { FleetEventSource } from '../../lib/live-source/fleet-event-source.svelte.ts';
  import type { AuthorizationScope, Principal } from '../../lib/scopes.svelte.ts';
  import { AUTHORIZATION_SCOPES, providePrincipalStore } from '../../lib/scopes.svelte.ts';

  interface Props {
    client: HttpClient;
    children: Snippet;
    /** Defaults to every scope granted (the optimistic-grant default — `src/lib/scopes.svelte.ts` module doc). Pass a narrower list to test a denied/disabled state. */
    scopes?: readonly AuthorizationScope[] | undefined;
    /** Test-only escape hatch: hands the test the same `QueryClient` this tree uses, so it can force a real `invalidateQueries()`/refetch — e.g. to simulate a background refetch racing an open form (schedule-form-drawer.test.ts's WFT-117 round-2 regression). */
    onQueryClient?: ((queryClient: QueryClient) => void) | undefined;
  }

  let { client, children, scopes, onQueryClient }: Props = $props();

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  // One-shot, like `provideClient(untrack(() => client))` just below — this
  // harness never swaps `onQueryClient` after mount.
  untrack(() => onQueryClient)?.(queryClient);

  provideClient(untrack(() => client));
  const principalStore = providePrincipalStore();
  const principal: Principal = untrack(() => ({
    scopes: scopes ?? AUTHORIZATION_SCOPES,
    unauthenticatedAccess: null,
  }));
  principalStore.setPrincipal(principal);

  // `getFleetEventSource()` (Schedule Detail's live update — plan §9.3)
  // needs a real provided instance, not a fake object literal, since the
  // context accessor is typed against the concrete `FleetEventSource` class.
  // Reuses the SAME real server the `client` prop points at — matches this
  // track's "no mock server" testing convention throughout.
  const fleetSource = untrack(
    () => new FleetEventSource({ baseUrl: client.baseUrl, headers: client.headers }),
  );
  provideFleetEventSource(fleetSource);
  onDestroy(() => fleetSource.close());
</script>

<QueryClientProvider client={queryClient}>
  {@render children()}
</QueryClientProvider>
