<script lang="ts">
  import TransferList from './transfer-list.svelte';
  import type { TransferListItem } from './transfer-list.types.ts';

  const items: TransferListItem[] = [
    { id: 'read', label: 'Read' },
    { id: 'write', label: 'Write' },
    { id: 'billing', label: 'Billing', disabled: true },
  ];

  let {
    value = $bindable(['read']),
    onValueChange,
  }: {
    value?: string[];
    onValueChange?: (value: string[]) => void;
  } = $props();
</script>

<p data-testid="value">{value.join(',')}</p>
<TransferList
  {items}
  bind:value
  {...onValueChange ? { onValueChange } : {}}
  leftLabel="Available permissions"
  rightLabel="Granted permissions"
/>
