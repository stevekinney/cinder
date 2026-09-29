<script lang="ts">
  /**
   * KV browser tab (plan §9.6; design `Weft UI.dc.html` STORAGE
   * "stBrowser"): the get/scan/put/delete/batch operation picker plus the
   * active operation's panel. Layout is a CSS grid (`storage.css`) with
   * named areas (`picker`/`form`/`results`) rather than DOM-order flex, so
   * each panel component can render its own `.weft-storage-form` +
   * `.weft-storage-results` pair independent of where the op-picker sits in
   * the tree.
   */
  import { Segment, SegmentedControl } from '@lostgradient/cinder';
  import type { StorageConnection } from './storage-client.ts';

  import BatchPanel from './batch-panel.svelte';
  import DeletePanel from './delete-panel.svelte';
  import GetPanel from './get-panel.svelte';
  import PutPanel from './put-panel.svelte';
  import ScanPanel from './scan-panel.svelte';

  interface KvBrowserProps {
    client: StorageConnection;
    conditionalBatchSupported: boolean | undefined;
  }

  let { client, conditionalBatchSupported }: KvBrowserProps = $props();

  type StorageOperation = 'get' | 'scan' | 'put' | 'delete' | 'batch';

  let operation = $state<StorageOperation>('scan');
</script>

<div class="weft-storage-panel-layout">
  <div class="weft-storage-op-picker">
    <SegmentedControl
      id="storage-op-picker"
      label="Storage operation"
      variant="tablist"
      fullWidth
      bind:value={operation}
    >
      <Segment value="get">Get</Segment>
      <Segment value="scan">Scan</Segment>
      <Segment value="put">Put</Segment>
      <Segment value="delete">Delete</Segment>
      <Segment value="batch">Batch</Segment>
    </SegmentedControl>
  </div>

  {#if operation === 'get'}
    <GetPanel {client} />
  {:else if operation === 'scan'}
    <ScanPanel {client} />
  {:else if operation === 'put'}
    <PutPanel {client} />
  {:else if operation === 'delete'}
    <DeletePanel {client} />
  {:else}
    <BatchPanel {client} conditionalBatchSupported={conditionalBatchSupported ?? false} />
  {/if}
</div>
