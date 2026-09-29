<script lang="ts">
  /**
   * Test-only harness composing `<WorkflowRouteHarness>` (provides the
   * `PrincipalStore` `ForkDialog` reads via `getPrincipalStore()` for its
   * revision-picker scope gate) around `<ForkDialog>` directly — mirrors
   * `checkpoints-tab.test-harness.svelte`'s identical pattern, scoped to
   * just this one component per WFT-117's own dedicated `fork-dialog.test.ts`.
   */
  import { HttpClient } from '@lostgradient/weft';
  import type { QueryClient } from '@tanstack/svelte-query';

  import type { Principal } from '../../../../lib/scopes.svelte.ts';
  import WorkflowRouteHarness from '../../list/workflow-route-harness.test-harness.svelte';
  import ForkDialog from './fork-dialog.svelte';
  import type { ForkClient } from './checkpoints-data.ts';
  import type { WorkflowRevisionListClient } from './fork-revision-picker.ts';

  interface Props {
    client: ForkClient & WorkflowRevisionListClient;
    workflowId: string;
    initialStep: number;
    workflowType: string;
    sourceRevision: string | undefined;
    principal: Principal;
    queryClient: QueryClient;
    onForked?: (forkedWorkflowId: string) => void;
  }

  let {
    client,
    workflowId,
    initialStep,
    workflowType,
    sourceRevision,
    principal,
    queryClient,
    onForked = () => {},
  }: Props = $props();

  // See `checkpoints-tab.test-harness.svelte`'s identical note: nothing
  // under `<ForkDialog>` reads the context client, only the explicit
  // `client` prop.
  const contextClient = new HttpClient({ baseUrl: 'http://weft.test' });
</script>

<WorkflowRouteHarness client={contextClient} {principal} {queryClient}>
  <ForkDialog {client} {workflowId} {initialStep} {workflowType} {sourceRevision} {onForked} />
</WorkflowRouteHarness>
