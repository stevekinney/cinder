<script lang="ts">
  import DataGrid from './data-grid.svelte';
  import type { DataGridCellContext, DataGridColumnDef } from './data-grid.types.ts';

  type Order = {
    id: string;
    customer: string;
  };

  const rows: Order[] = [
    { id: 'ord-1', customer: 'Ada Lovelace' },
    { id: 'ord-2', customer: 'Grace Hopper' },
  ];

  const columns: DataGridColumnDef<Order>[] = [
    { key: 'customer', header: 'Customer', editable: true },
  ];
</script>

{#snippet customerCell(context: DataGridCellContext<Order>)}
  <span data-testid="cell">{context.value}:{context.editing}</span>
{/snippet}

<DataGrid
  {rows}
  columns={[{ ...columns[0]!, cell: customerCell }]}
  getRowId={(row) => row.id}
  aria-label="Orders"
/>
