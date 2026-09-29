<script lang="ts">
  /** Test-only harness wrapping `QueryClientProvider` around `ChildrenTab` (mirrors `tests/tanstack-query-smoke.svelte`'s pattern). */
  import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
  import type { ComponentProps } from 'svelte';

  import ChildrenTab from './children-tab.svelte';

  let props: ComponentProps<typeof ChildrenTab> = $props();

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
</script>

<QueryClientProvider client={queryClient}>
  <ChildrenTab {...props} />
</QueryClientProvider>
