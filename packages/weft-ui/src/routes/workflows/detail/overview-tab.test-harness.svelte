<script lang="ts">
  /** Test-only harness wrapping `QueryClientProvider` around `OverviewTab` (mirrors `tests/tanstack-query-smoke.svelte`'s pattern — see that file's doc for why the store-API needs a real provider in tests). */
  import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
  import type { ComponentProps } from 'svelte';

  import OverviewTab from './overview-tab.svelte';

  let props: ComponentProps<typeof OverviewTab> = $props();

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
</script>

<QueryClientProvider client={queryClient}>
  <OverviewTab {...props} />
</QueryClientProvider>
