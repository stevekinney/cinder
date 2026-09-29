<script lang="ts">
  /** Test-only harness wrapping `QueryClientProvider` (mirrors `overview-tab.test-harness.svelte` — `createMutation` needs a real provider in tests). */
  import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
  import type { ComponentProps } from 'svelte';

  import AsyncActivityDrawer from './async-activity-drawer.svelte';

  let props: ComponentProps<typeof AsyncActivityDrawer> = $props();

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
</script>

<QueryClientProvider client={queryClient}>
  <AsyncActivityDrawer {...props} />
</QueryClientProvider>
