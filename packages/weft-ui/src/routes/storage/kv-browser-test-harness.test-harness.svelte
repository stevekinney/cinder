<script lang="ts">
  /** Test-only harness providing the `QueryClientProvider` context `<KvBrowser>`'s panels need. Never imported by production code. */
  import type { StorageConnection } from './storage-client.ts';

  import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';

  import KvBrowser from './kv-browser.svelte';

  interface KvBrowserTestHarnessProps {
    client: StorageConnection;
    conditionalBatchSupported?: boolean | undefined;
  }

  let { client, conditionalBatchSupported = undefined }: KvBrowserTestHarnessProps = $props();

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
</script>

<QueryClientProvider client={queryClient}>
  <KvBrowser {client} {conditionalBatchSupported} />
</QueryClientProvider>
