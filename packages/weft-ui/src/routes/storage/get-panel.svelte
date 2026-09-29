<script lang="ts">
  /**
   * Get panel (plan §9.6; design `Weft UI.dc.html` STORAGE "stGet"):
   * exact-key lookup. Each click passes the current key to `mutate` and
   * retrieves a fresh value. Other components do not subscribe to this
   * result, so it does not need a shared query-cache entry.
   */
  import { Button, EmptyState, Input, Skeleton } from '@lostgradient/cinder';
  import type { StorageConnection } from './storage-client.ts';
  import { ArrowRight, Search } from 'lucide-svelte';

  import { createMutation } from '@tanstack/svelte-query';

  import { faultTreatment } from '../../lib/faults.ts';
  import { storageGet } from './storage-client.ts';
  import StorageValueDisplay from './storage-value-display.svelte';

  interface GetPanelProps {
    client: StorageConnection;
  }

  let { client }: GetPanelProps = $props();

  let key = $state('');
  let queriedKey = $state<string | null>(null);

  const getMutation = createMutation(
    () => ({
      mutationFn: (targetKey: string) => storageGet(client, targetKey),
    }),
    undefined,
  );

  function runGet(): void {
    if (key.length === 0) return;
    queriedKey = key;
    getMutation.mutate(key);
  }
</script>

<div class="weft-storage-form">
  <div class="weft-storage-field-group">
    <Input
      id="storage-get-key"
      label="Exact key"
      bind:value={key}
      class="weft-storage-monospace-input"
      onkeydown={(event) => {
        if (event.key === 'Enter') runGet();
      }}
    />
  </div>
  <Button
    label="Get"
    variant="primary"
    size="sm"
    fullWidth
    disabled={key.length === 0}
    loading={getMutation.isPending}
    onclick={runGet}
  >
    {#snippet leadingIcon()}<ArrowRight aria-hidden="true" size={14} />{/snippet}
  </Button>
</div>

<div class="weft-storage-results">
  {#if getMutation.isPending}
    <Skeleton height="4rem" />
  {:else if getMutation.isError}
    <p class="weft-storage-error">{faultTreatment(getMutation.error).message}</p>
  {:else if getMutation.isSuccess && queriedKey !== null}
    {#if getMutation.data === null}
      <EmptyState title="Key not found" description={`No value stored at "${queriedKey}".`}>
        {#snippet icon()}<Search aria-hidden="true" size={22} />{/snippet}
      </EmptyState>
    {:else}
      <StorageValueDisplay value={getMutation.data} label={queriedKey} />
    {/if}
  {:else}
    <EmptyState
      title="Enter a key"
      description="Type a key and press Get to look up its stored value."
    >
      {#snippet icon()}<Search aria-hidden="true" size={22} />{/snippet}
    </EmptyState>
  {/if}
</div>
