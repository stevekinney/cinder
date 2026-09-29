<script lang="ts">
  /**
   * Batch panel (plan §9.6, §10.6; design `Weft UI.dc.html` STORAGE):
   * a small set of put/delete operations applied atomically, plus
   * conditional batch (compare-and-swap) when `conditionalBatchSupported`
   * says the backend supports it — the plan's "conditional-batch shown only
   * when capabilities().conditionalBatch" (`index.svelte` resolves that
   * probe once and passes the result down). Not shown in the design mock's
   * illustrated forms (`stOps` lists `batch` as selectable but the mock only
   * wires up get/scan/put) — built to the same visual pattern as the other
   * panels, Tier-2 `ConfirmDialog` before applying (plan §10.6).
   */
  import {
    Button,
    Checkbox,
    ConfirmDialog,
    Input,
    Select,
    Toggle,
    type SelectOption,
  } from '@lostgradient/cinder';
  import { Plus, X } from 'lucide-svelte';

  import { createMutation } from '@tanstack/svelte-query';

  import { showToast } from '../../app/toast-host.svelte';
  import { faultTreatment } from '../../lib/faults.ts';
  import ReservedPrefixCallout from './reserved-prefix-callout.svelte';
  import {
    storageBatch,
    storageConditionalBatch,
    type StorageBatchOperationInput,
    type StorageConditionInput,
    type StorageConnection,
  } from './storage-client.ts';

  interface BatchPanelProps {
    client: StorageConnection;
    conditionalBatchSupported: boolean;
  }

  let { client, conditionalBatchSupported }: BatchPanelProps = $props();

  const OPERATION_TYPE_OPTIONS: readonly SelectOption<'put' | 'delete'>[] = [
    { value: 'put', label: 'Put' },
    { value: 'delete', label: 'Delete' },
  ];

  interface OperationRow {
    id: string;
    type: 'put' | 'delete';
    key: string;
    value: string;
  }

  interface ConditionRow {
    id: string;
    key: string;
    mustNotExist: boolean;
    expectedValue: string;
  }

  let nextRowId = 0;
  function newRowId(): string {
    nextRowId += 1;
    return `row-${nextRowId}`;
  }

  let operationRows = $state<OperationRow[]>([{ id: newRowId(), type: 'put', key: '', value: '' }]);
  let conditional = $state(false);
  let conditionRows = $state<ConditionRow[]>([]);
  let confirmOpen = $state(false);
  let triggerRef = $state<HTMLElement | null>(null);

  const encodedOperations = $derived<StorageBatchOperationInput[]>(
    operationRows
      .filter((row) => row.key.length > 0)
      .map((row) =>
        row.type === 'put'
          ? { type: 'put', key: row.key, value: new TextEncoder().encode(row.value) }
          : { type: 'delete', key: row.key },
      ),
  );

  const encodedConditions = $derived<StorageConditionInput[]>(
    conditionRows
      .filter((row) => row.key.length > 0)
      .map((row) => ({
        key: row.key,
        expectedValue: row.mustNotExist ? null : new TextEncoder().encode(row.expectedValue),
      })),
  );

  const batchMutation = createMutation<void, unknown, StorageBatchOperationInput[]>(
    () => ({ mutationFn: (operations) => storageBatch(client, operations) }),
    undefined,
  );

  const conditionalBatchMutation = createMutation<
    { applied: boolean },
    unknown,
    { conditions: StorageConditionInput[]; operations: StorageBatchOperationInput[] }
  >(
    () => ({
      mutationFn: ({ conditions, operations }) =>
        storageConditionalBatch(client, conditions, operations),
    }),
    undefined,
  );

  const isPending = $derived(batchMutation.isPending || conditionalBatchMutation.isPending);
  const hasError = $derived(batchMutation.isError || conditionalBatchMutation.isError);
  const errorMessage = $derived(
    batchMutation.isError
      ? faultTreatment(batchMutation.error).message
      : conditionalBatchMutation.isError
        ? faultTreatment(conditionalBatchMutation.error).message
        : undefined,
  );

  function addOperationRow(): void {
    operationRows = [...operationRows, { id: newRowId(), type: 'put', key: '', value: '' }];
  }

  function removeOperationRow(id: string): void {
    operationRows = operationRows.filter((row) => row.id !== id);
  }

  function addConditionRow(): void {
    conditionRows = [
      ...conditionRows,
      { id: newRowId(), key: '', mustNotExist: false, expectedValue: '' },
    ];
  }

  function removeConditionRow(id: string): void {
    conditionRows = conditionRows.filter((row) => row.id !== id);
  }

  function runBatch(): void {
    if (conditional) {
      conditionalBatchMutation.mutate(
        { conditions: encodedConditions, operations: encodedOperations },
        {
          onSuccess: (result) =>
            showToast(
              result.applied
                ? 'Conditional batch applied.'
                : 'Conditional batch skipped — conditions not met.',
              { variant: result.applied ? 'success' : 'warning' },
            ),
        },
      );
    } else {
      batchMutation.mutate(encodedOperations, {
        onSuccess: () =>
          showToast(`Applied batch of ${encodedOperations.length} operations.`, {
            variant: 'success',
          }),
      });
    }
  }
</script>

<div class="weft-storage-form">
  <div class="weft-storage-batch-rows">
    {#each operationRows as row (row.id)}
      <div class="weft-storage-batch-row">
        <Select
          id={`batch-type-${row.id}`}
          label="Operation"
          bind:value={row.type}
          options={OPERATION_TYPE_OPTIONS}
        />
        <Input
          id={`batch-key-${row.id}`}
          label="Key"
          labelVisible={false}
          bind:value={row.key}
          placeholder="Key"
          class="weft-storage-monospace-input"
        />
        {#if row.type === 'put'}
          <Input
            id={`batch-value-${row.id}`}
            label="Value"
            labelVisible={false}
            bind:value={row.value}
            placeholder="Value"
            class="weft-storage-monospace-input"
          />
        {/if}
        <ReservedPrefixCallout key={row.key} />
        <button
          type="button"
          class="weft-storage-row-remove"
          aria-label="Remove row"
          onclick={() => removeOperationRow(row.id)}
        >
          <X aria-hidden="true" size={14} />
        </button>
      </div>
    {/each}
  </div>
  <Button label="Add operation" variant="ghost" size="sm" onclick={addOperationRow}>
    {#snippet leadingIcon()}<Plus aria-hidden="true" size={14} />{/snippet}
  </Button>

  {#if conditionalBatchSupported}
    <Toggle
      id="storage-batch-conditional"
      label="Conditional (compare-and-swap)"
      bind:checked={conditional}
    />
  {/if}

  {#if conditional}
    <div class="weft-storage-batch-rows">
      {#each conditionRows as row (row.id)}
        <div class="weft-storage-batch-row">
          <Input
            id={`condition-key-${row.id}`}
            label="Key"
            labelVisible={false}
            bind:value={row.key}
            placeholder="Key"
            class="weft-storage-monospace-input"
          />
          <Checkbox
            id={`condition-absent-${row.id}`}
            label="Must not exist"
            bind:checked={row.mustNotExist}
          />
          {#if !row.mustNotExist}
            <Input
              id={`condition-value-${row.id}`}
              label="Expected value"
              labelVisible={false}
              bind:value={row.expectedValue}
              placeholder="Expected value"
              class="weft-storage-monospace-input"
            />
          {/if}
          <button
            type="button"
            class="weft-storage-row-remove"
            aria-label="Remove condition"
            onclick={() => removeConditionRow(row.id)}
          >
            <X aria-hidden="true" size={14} />
          </button>
        </div>
      {/each}
    </div>
    <Button label="Add condition" variant="ghost" size="sm" onclick={addConditionRow}>
      {#snippet leadingIcon()}<Plus aria-hidden="true" size={14} />{/snippet}
    </Button>
  {/if}

  <Button
    label={conditional ? 'Apply conditional batch · confirm' : 'Apply batch · confirm'}
    variant="primary"
    size="sm"
    fullWidth
    disabled={encodedOperations.length === 0}
    loading={isPending}
    onclick={(event) => {
      triggerRef = event.currentTarget as HTMLElement;
      confirmOpen = true;
    }}
  />
  {#if hasError}
    <p class="weft-storage-error">{errorMessage}</p>
  {/if}
</div>

<ConfirmDialog
  bind:open={confirmOpen}
  {triggerRef}
  title={`Apply batch of ${encodedOperations.length} operations?`}
  description={conditional
    ? 'Writes apply only if every condition currently matches. This cannot be undone.'
    : 'This applies every listed operation atomically. This cannot be undone.'}
  confirmLabel="Apply"
  onConfirm={runBatch}
/>
