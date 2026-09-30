<script lang="ts">
  /** Test-only host for `createActiveRevisionComparisons`: provides the `QueryClient` the inner host's queries need. */
  import { QueryClientProvider, type QueryClient } from '@tanstack/svelte-query';

  import ActiveRevisionComparisonsHost from './active-revision-comparisons.test-host.svelte';
  import type { WorkflowActiveRevisionClient } from './workflow-revision.ts';

  interface Props {
    client: WorkflowActiveRevisionClient;
    queryClient: QueryClient;
    rows: readonly { readonly type: string; readonly revision: string | undefined }[];
    enabled?: boolean;
  }

  let { client, queryClient, rows, enabled = true }: Props = $props();
</script>

<QueryClientProvider client={queryClient}>
  <ActiveRevisionComparisonsHost {client} {rows} {enabled} />
</QueryClientProvider>
