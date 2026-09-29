<script lang="ts">
  /**
   * Scan panel (plan §9.6; design `Weft UI.dc.html` STORAGE "stScan"):
   * prefix or start/end range scan, NDJSON under the hood (`storage-client.ts`),
   * paginated by cursor (`gt=<last key>`) — "Load more" re-scans rather than
   * offsetting, and results are a snapshot at page load (plan §4's list
   * convention, applied here even though this isn't a `DataTable`/paginated
   * list in the URL-filter sense).
   */
  import {
    Button,
    CopyButton,
    EmptyState,
    Input,
    Segment,
    SegmentedControl,
    Table,
  } from '@lostgradient/cinder';
  import { ChevronDown, SearchX } from 'lucide-svelte';

  import { createMutation } from '@tanstack/svelte-query';

  import { faultTreatment } from '../../lib/faults.ts';
  import {
    storageScan,
    type StorageScanEntry,
    type StorageScanOptions,
    type StorageScanPage,
    type StorageConnection,
  } from './storage-client.ts';
  import { previewStorageValue } from './value-preview.ts';

  interface ScanPanelProps {
    client: StorageConnection;
  }

  let { client }: ScanPanelProps = $props();

  const DEFAULT_SCAN_LIMIT = 100;

  let mode = $state<'prefix' | 'range'>('prefix');
  let prefix = $state('');
  let rangeStart = $state('');
  let rangeEnd = $state('');
  let limit = $state(String(DEFAULT_SCAN_LIMIT));

  let entries = $state<readonly StorageScanEntry[]>([]);
  let nextCursor = $state<string | undefined>(undefined);
  let hasScanned = $state(false);

  const scanMutation = createMutation<StorageScanPage, unknown, StorageScanOptions>(
    () => ({ mutationFn: (options) => storageScan(client, options) }),
    undefined,
  );

  function boundedLimit(): number {
    const parsed = Number(limit);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_SCAN_LIMIT;
  }

  function baseScanOptions(): StorageScanOptions {
    if (mode === 'range') {
      return {
        limit: boundedLimit(),
        ...(rangeStart.length > 0 ? { gte: rangeStart } : {}),
        ...(rangeEnd.length > 0 ? { lt: rangeEnd } : {}),
      };
    }
    return { prefix, limit: boundedLimit() };
  }

  function runScan(): void {
    hasScanned = true;
    scanMutation.mutate(baseScanOptions(), {
      onSuccess: (page) => {
        entries = page.entries;
        nextCursor = page.nextCursor;
      },
    });
  }

  function loadMore(): void {
    if (nextCursor === undefined) return;
    scanMutation.mutate(
      { ...baseScanOptions(), gt: nextCursor },
      {
        onSuccess: (page) => {
          entries = [...entries, ...page.entries];
          nextCursor = page.nextCursor;
        },
      },
    );
  }

  function valuePreview(value: Uint8Array): string {
    const preview = previewStorageValue(value);
    if (preview.kind === 'empty') return '(empty)';
    if (preview.kind === 'binary') return `(binary, ${preview.byteLength} bytes)`;
    return preview.text ?? '';
  }
</script>

<div class="weft-storage-form">
  <SegmentedControl
    id="storage-scan-mode"
    label="Scan by"
    variant="tablist"
    fullWidth
    bind:value={mode}
  >
    <Segment value="prefix">Prefix</Segment>
    <Segment value="range">Start / end</Segment>
  </SegmentedControl>

  {#if mode === 'prefix'}
    <Input
      id="storage-scan-prefix"
      label="Prefix"
      bind:value={prefix}
      class="weft-storage-monospace-input"
    />
  {:else}
    <Input
      id="storage-scan-start"
      label="Start (inclusive)"
      bind:value={rangeStart}
      class="weft-storage-monospace-input"
    />
    <Input
      id="storage-scan-end"
      label="End (exclusive)"
      bind:value={rangeEnd}
      class="weft-storage-monospace-input"
    />
  {/if}

  <Input
    id="storage-scan-limit"
    label="Limit"
    type="number"
    bind:value={limit}
    class="weft-storage-monospace-input"
  />

  <Button
    label="Scan"
    variant="primary"
    size="sm"
    fullWidth
    loading={scanMutation.isPending}
    onclick={runScan}
  />
</div>

<div class="weft-storage-results">
  {#if scanMutation.isError}
    <p class="weft-storage-error">{faultTreatment(scanMutation.error).message}</p>
  {:else if !hasScanned}
    <EmptyState
      title="Scan storage"
      description="Set a prefix (or start/end range) and press Scan."
    >
      {#snippet icon()}<SearchX aria-hidden="true" size={22} />{/snippet}
    </EmptyState>
  {:else if entries.length === 0 && !scanMutation.isPending}
    <EmptyState title="No keys found" description="Nothing matched this scan.">
      {#snippet icon()}<SearchX aria-hidden="true" size={22} />{/snippet}
    </EmptyState>
  {:else}
    <div class="weft-storage-results-header">
      <span>Results</span>
      <span class="weft-storage-results-meta">
        {mode === 'prefix' ? `prefix "${prefix}"` : 'range scan'} · {entries.length}
        {entries.length === 1 ? 'key' : 'keys'}
      </span>
    </div>
    <Table scrollable caption="Scan results">
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell>Key</Table.HeaderCell>
          <Table.HeaderCell>Value</Table.HeaderCell>
          <Table.HeaderCell align="right">Copy</Table.HeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each entries as entry (entry.key)}
          <Table.Row>
            <Table.Cell class="weft-storage-key-cell">{entry.key}</Table.Cell>
            <Table.Cell class="weft-storage-value-cell">{valuePreview(entry.value)}</Table.Cell>
            <Table.Cell align="right">
              <CopyButton value={entry.key} iconOnly label={`Copy key ${entry.key}`} />
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table>
    {#if nextCursor !== undefined}
      <div class="weft-storage-load-more">
        <Button
          label="Load more"
          variant="secondary"
          size="sm"
          loading={scanMutation.isPending}
          onclick={loadMore}
        >
          {#snippet trailingIcon()}<ChevronDown aria-hidden="true" size={13} />{/snippet}
        </Button>
      </div>
    {/if}
  {/if}
</div>
