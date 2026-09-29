<script lang="ts">
  /**
   * Test-only harness composing `<WorkflowRouteHarness>` (the list track's
   * shared context provider — `HttpClient`, `PrincipalStore`,
   * `FleetEventSource`, `QueryClient`) around `<WorkflowDetail>`. Mirrors
   * `../aggregate/aggregate-view.test-harness.svelte`'s identical pattern.
   * `WorkflowDetail` reads its workflow id from `router.current.params`
   * (module doc), not a prop, so the test itself drives the id via
   * `router.navigate('/workflows/:id')` before rendering.
   */
  import type { HttpClient } from '@lostgradient/weft';
  import type { QueryClient } from '@tanstack/svelte-query';

  import type { Principal } from '../../../lib/scopes.svelte.ts';
  import WorkflowRouteHarness from '../list/workflow-route-harness.test-harness.svelte';
  import WorkflowDetail from './workflow-detail.svelte';

  interface Props {
    client: HttpClient;
    principal: Principal;
    queryClient: QueryClient;
  }

  let { client, principal, queryClient }: Props = $props();
</script>

<WorkflowRouteHarness {client} {principal} {queryClient}>
  <WorkflowDetail />
</WorkflowRouteHarness>
