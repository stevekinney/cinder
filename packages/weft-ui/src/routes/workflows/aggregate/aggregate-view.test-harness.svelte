<script lang="ts">
  /**
   * Test-only harness composing `<WorkflowRouteHarness>` (the list track's
   * shared context provider) around `<AggregateView>` — see
   * `../list/workflow-list.test-harness.svelte`'s identical doc for why
   * this fixed composition exists instead of passing `children` from a
   * plain `.test.ts` file.
   */
  import type { HttpClient } from '@lostgradient/weft';
  import type { QueryClient } from '@tanstack/svelte-query';

  import type { Principal } from '../../../lib/scopes.svelte.ts';
  import WorkflowRouteHarness from '../list/workflow-route-harness.test-harness.svelte';
  import AggregateView from './aggregate-view.svelte';

  interface Props {
    client: HttpClient;
    principal: Principal;
    queryClient: QueryClient;
  }

  let { client, principal, queryClient }: Props = $props();
</script>

<WorkflowRouteHarness {client} {principal} {queryClient}>
  <AggregateView />
</WorkflowRouteHarness>
