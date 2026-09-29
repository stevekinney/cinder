<script lang="ts">
  /** Test-only harness providing the `QueryClientProvider` context `<PutPanel>` needs. Never imported by production code. */
  import type { StorageConnection } from './storage-client.ts';

  import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';

  import PutPanel from './put-panel.svelte';

  interface PutPanelTestHarnessProps {
    client: StorageConnection;
  }

  let { client }: PutPanelTestHarnessProps = $props();

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
</script>

<QueryClientProvider client={queryClient}>
  <PutPanel {client} />
</QueryClientProvider>
