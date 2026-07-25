<script lang="ts">
  import DataGrid from './data-grid.svelte';
  import { observeSelectionModel } from './data-grid-selection-bind-probe.ts';
  import type { DataGridColumnDef } from './data-grid.types.ts';

  type Order = {
    id: string;
    customer: string;
  };

  const rows: Order[] = [
    { id: 'ord-1', customer: 'Ada Lovelace' },
    { id: 'ord-2', customer: 'Grace Hopper' },
  ];

  const columns: DataGridColumnDef<Order>[] = [{ key: 'customer', header: 'Customer' }];

  let selectionModel = $state<string[] | undefined>(undefined);
</script>

<DataGrid
  {rows}
  {columns}
  getRowId={(row) => row.id}
  selectionMode="multiple"
  bind:selectionModel
  onSelectionModelChange={observeSelectionModel}
  aria-label="Orders"
/>
