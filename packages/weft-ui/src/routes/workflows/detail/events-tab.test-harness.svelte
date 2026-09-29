<script lang="ts">
  /** Test-only harness wrapping `QueryClientProvider` around `EventsTab` (mirrors `tests/tanstack-query-smoke.svelte`'s pattern). */
  import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
  import type { ComponentProps } from 'svelte';

  import EventsTab from './events-tab.svelte';

  let props: ComponentProps<typeof EventsTab> = $props();

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
</script>

<QueryClientProvider client={queryClient}>
  <EventsTab {...props} />
</QueryClientProvider>
