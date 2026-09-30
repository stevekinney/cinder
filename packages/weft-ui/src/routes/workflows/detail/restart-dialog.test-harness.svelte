<script lang="ts">
  /**
   * Test-only harness composing `<WorkflowRouteHarness>` (provides the
   * `PrincipalStore` `RestartDialog` reads for its scope gates, and a
   * `QueryClient`) around `<RestartDialog>` — same shape as
   * `checkpoints/fork-dialog.test-harness.svelte`.
   */
  import { HttpClient, type WorkflowState } from '@lostgradient/weft';
  import type { QueryClient } from '@tanstack/svelte-query';

  import type { Principal } from '../../../lib/scopes.svelte.ts';
  import WorkflowRouteHarness from '../list/workflow-route-harness.test-harness.svelte';
  import type { ComponentProps } from 'svelte';

  import RestartDialog from './restart-dialog.svelte';

  interface Props {
    client: ComponentProps<typeof RestartDialog>['client'];
    workflow: WorkflowState;
    principal: Principal;
    queryClient: QueryClient;
    onClose?: () => void;
    onRestarted?: () => void;
  }

  let {
    client,
    workflow,
    principal,
    queryClient,
    onClose = () => {},
    onRestarted = () => {},
  }: Props = $props();

  // Nothing under `<RestartDialog>` reads the context client, only the
  // explicit `client` prop.
  const contextClient = new HttpClient({ baseUrl: 'http://weft.test' });
</script>

<WorkflowRouteHarness client={contextClient} {principal} {queryClient}>
  <RestartDialog {client} {workflow} {onClose} {onRestarted} />
</WorkflowRouteHarness>
