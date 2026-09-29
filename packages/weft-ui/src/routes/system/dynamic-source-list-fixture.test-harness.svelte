<script lang="ts">
  import type { HttpClient } from '@lostgradient/weft';
  import { QueryClientProvider, type QueryClient } from '@tanstack/svelte-query';
  import { untrack } from 'svelte';

  import { provideClient } from '../../lib/client.ts';
  import {
    AUTHORIZATION_SCOPES,
    providePrincipalStore,
    type AuthorizationScope,
  } from '../../lib/scopes.svelte.ts';
  import DynamicSourceList, { type CatalogSourceListEntry } from './dynamic-source-list.svelte';

  type SourceKey = { readonly name: string; readonly revision: string };

  interface Props {
    client: HttpClient;
    queryClient: QueryClient;
    selectedKey?: SourceKey | null;
    onSelect: (source: CatalogSourceListEntry) => void;
    principalScopes?: readonly AuthorizationScope[];
  }

  let { client, queryClient, selectedKey = null, onSelect, principalScopes }: Props = $props();

  provideClient(untrack(() => client));

  const principalStore = providePrincipalStore();
  principalStore.setPrincipal({
    scopes: untrack(() => principalScopes) ?? AUTHORIZATION_SCOPES,
    unauthenticatedAccess: null,
  });
</script>

<QueryClientProvider client={queryClient}>
  <DynamicSourceList {selectedKey} {onSelect} />
</QueryClientProvider>
