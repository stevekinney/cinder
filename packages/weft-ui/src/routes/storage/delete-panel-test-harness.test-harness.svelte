<script lang="ts">
  /** Test-only harness providing the `QueryClientProvider` context `<DeletePanel>` needs. Never imported by production code. */
  import type { StorageConnection } from './storage-client.ts';

  import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';

  import DeletePanel from './delete-panel.svelte';

  interface DeletePanelTestHarnessProps {
    client: StorageConnection;
  }

  let { client }: DeletePanelTestHarnessProps = $props();

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
</script>

<QueryClientProvider client={queryClient}>
  <DeletePanel {client} />
</QueryClientProvider>
