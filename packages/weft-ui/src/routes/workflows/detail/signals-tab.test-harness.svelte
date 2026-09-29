<script lang="ts">
  /** Test-only harness wrapping `QueryClientProvider` around `SignalsTab` (mirrors `tests/tanstack-query-smoke.svelte`'s pattern). */
  import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
  import type { ComponentProps } from 'svelte';

  import SignalsTab from './signals-tab.svelte';

  let props: ComponentProps<typeof SignalsTab> = $props();

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
</script>

<QueryClientProvider client={queryClient}>
  <SignalsTab {...props} />
</QueryClientProvider>
