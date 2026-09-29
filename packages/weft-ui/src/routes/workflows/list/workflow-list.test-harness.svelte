<script lang="ts">
  /**
   * Test-only harness composing `<WorkflowRouteHarness>` around
   * `<WorkflowList>` — `@testing-library/svelte`'s `render()` mounts one
   * component and snippets can't be constructed from a plain `.test.ts`
   * file, so this fixed composition is the render target for
   * `workflow-list.test.ts` instead of passing `children` dynamically.
   */
  import type { HttpClient } from '@lostgradient/weft';
  import type { QueryClient } from '@tanstack/svelte-query';

  import type { Principal } from '../../../lib/scopes.svelte.ts';
  import WorkflowList from './workflow-list.svelte';
  import WorkflowRouteHarness from './workflow-route-harness.test-harness.svelte';

  interface Props {
    client: HttpClient;
    principal: Principal;
    queryClient: QueryClient;
  }

  let { client, principal, queryClient }: Props = $props();
</script>

<WorkflowRouteHarness {client} {principal} {queryClient}>
  <WorkflowList />
</WorkflowRouteHarness>
