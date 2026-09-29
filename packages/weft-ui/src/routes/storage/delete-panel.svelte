<script lang="ts">
  /**
   * Delete panel (plan §9.6, §10.6; design `Weft UI.dc.html` STORAGE):
   * exact-key delete, Tier-2 `ConfirmDialog` (plan: "Tier-2 ConfirmDialog on
   * writes/deletes"). Not shown in the design mock's illustrated forms
   * (`stOps` lists it as a selectable operation but the mock only wires up
   * get/scan/put) — built to the same visual pattern as `put-panel.svelte`.
   */
  import { Button, ConfirmDialog, Input } from '@lostgradient/cinder';
  import type { StorageConnection } from './storage-client.ts';
  import { Trash2 } from 'lucide-svelte';

  import { createMutation } from '@tanstack/svelte-query';

  import { showToast } from '../../app/toast-host.svelte';
  import { faultTreatment } from '../../lib/faults.ts';
  import ReservedPrefixCallout from './reserved-prefix-callout.svelte';
  import { storageDelete } from './storage-client.ts';

  interface DeletePanelProps {
    client: StorageConnection;
  }

  let { client }: DeletePanelProps = $props();

  let key = $state('');
  let confirmOpen = $state(false);
  let triggerRef = $state<HTMLElement | null>(null);

  const deleteMutation = createMutation<void, unknown, string>(
    () => ({ mutationFn: (targetKey) => storageDelete(client, targetKey) }),
    undefined,
  );
</script>

<div class="weft-storage-form">
  <Input
    id="storage-delete-key"
    label="Key"
    bind:value={key}
    class="weft-storage-monospace-input"
  />
  <ReservedPrefixCallout {key} />
  <Button
    label="Delete · confirm"
    variant="danger"
    size="sm"
    fullWidth
    disabled={key.length === 0}
    loading={deleteMutation.isPending}
    onclick={(event) => {
      triggerRef = event.currentTarget as HTMLElement;
      confirmOpen = true;
    }}
  >
    {#snippet leadingIcon()}<Trash2 aria-hidden="true" size={14} />{/snippet}
  </Button>
  {#if deleteMutation.isError}
    <p class="weft-storage-error">{faultTreatment(deleteMutation.error).message}</p>
  {/if}
</div>

<ConfirmDialog
  bind:open={confirmOpen}
  {triggerRef}
  title={`Delete "${key}"?`}
  description="This permanently removes the key from storage. This cannot be undone."
  destructive
  confirmLabel="Delete"
  onConfirm={() => {
    const deletedKey = key;
    deleteMutation.mutate(deletedKey, {
      onSuccess: () => showToast(`Deleted "${deletedKey}"`, { variant: 'success' }),
    });
  }}
/>
