<script lang="ts">
  /** Test-only harness wrapping `QueryClientProvider` around `TimelineTab` (mirrors `overview-tab.test-harness.svelte`). */
  import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
  import type { ComponentProps } from 'svelte';

  import TimelineTab from './timeline-tab.svelte';

  let props: ComponentProps<typeof TimelineTab> = $props();

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
</script>

<QueryClientProvider client={queryClient}>
  <TimelineTab {...props} />
</QueryClientProvider>
