<script lang="ts">
  /**
   * Test-only harness composing `<WorkflowRouteHarness>` (the list track's
   * shared context provider — `CheckpointsTab` reads `getPrincipalStore()`
   * for the replay scope gate) around `<CheckpointsTab>`.
   */
  import { HttpClient } from '@lostgradient/weft';
  import type { WorkflowReplay, WorkflowTimelineEntry } from '@lostgradient/weft';
  import type { QueryClient } from '@tanstack/svelte-query';

  import type { Principal } from '../../../../lib/scopes.svelte.ts';
  import WorkflowRouteHarness from '../../list/workflow-route-harness.test-harness.svelte';
  import CheckpointsTab from './checkpoints-tab.svelte';
  import type { CheckpointsOperationsClient, ForkClient } from './checkpoints-data.ts';
  import type { WorkflowRevisionListClient } from './fork-revision-picker.ts';

  interface Props {
    client: CheckpointsOperationsClient &
      ForkClient &
      WorkflowRevisionListClient & {
        replayTo: (id: string, step: number) => Promise<WorkflowReplay | null>;
        getTimeline: (id: string) => Promise<WorkflowTimelineEntry[]>;
      };
    workflowId: string;
    principal: Principal;
    queryClient: QueryClient;
    workflowType?: string;
    sourceRevision?: string;
  }

  let {
    client,
    workflowId,
    principal,
    queryClient,
    workflowType = 'test-workflow',
    sourceRevision,
  }: Props = $props();

  // `WorkflowRouteHarness` requires a full `HttpClient` for its context
  // (`getClient()`) — nothing under `<CheckpointsTab>` reads it, every
  // component here takes `client` as an explicit prop instead, so a real,
  // never-invoked instance satisfies the type without hand-duplicating the
  // whole interface or reaching for an unsafe cast.
  const contextClient = new HttpClient({ baseUrl: 'http://weft.test' });
</script>

<WorkflowRouteHarness client={contextClient} {principal} {queryClient}>
  <CheckpointsTab {client} {workflowId} {workflowType} {sourceRevision} />
</WorkflowRouteHarness>
