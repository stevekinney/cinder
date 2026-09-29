<script lang="ts">
  /** Test-only harness wrapping `QueryClientProvider` around `LineagePanel` (mirrors `tests/tanstack-query-smoke.svelte`'s pattern). */
  import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
  import type { ComponentProps } from 'svelte';

  import LineagePanel from './lineage-panel.svelte';

  let props: ComponentProps<typeof LineagePanel> = $props();

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
</script>

<QueryClientProvider client={queryClient}>
  <LineagePanel {...props} />
</QueryClientProvider>
