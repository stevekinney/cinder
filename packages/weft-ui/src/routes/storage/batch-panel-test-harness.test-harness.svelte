<script lang="ts">
  /** Test-only harness providing the `QueryClientProvider` context `<BatchPanel>` needs. Never imported by production code. */
  import type { StorageConnection } from './storage-client.ts';

  import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';

  import BatchPanel from './batch-panel.svelte';

  interface BatchPanelTestHarnessProps {
    client: StorageConnection;
    conditionalBatchSupported?: boolean;
  }

  let { client, conditionalBatchSupported = false }: BatchPanelTestHarnessProps = $props();

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
</script>

<QueryClientProvider client={queryClient}>
  <BatchPanel {client} {conditionalBatchSupported} />
</QueryClientProvider>
