<script lang="ts" module>
  import type { TableSort } from '../../components/table.svelte';
  /** Test-only fixture composing a sortable table. */
  export type TableFixtureProps = {
    sort?: TableSort;
    caption?: string;
    stickyHeader?: boolean;
    columns: Array<{ key: string; label: string; sortable?: boolean }>;
    rows: Array<{ id: string; cells: string[] }>;
  };
</script>

<script lang="ts">
  import Table from '../../components/table.svelte';
  import TableBody from '../../components/table-body.svelte';
  import TableCell from '../../components/table-cell.svelte';
  import TableHeader from '../../components/table-header.svelte';
  import TableHeaderCell from '../../components/table-header-cell.svelte';
  import TableRow from '../../components/table-row.svelte';

  let {
    sort = $bindable(),
    caption,
    stickyHeader = false,
    columns,
    rows,
  }: TableFixtureProps = $props();
</script>

<Table bind:sort {...caption !== undefined ? { caption } : {}} {stickyHeader}>
  <TableHeader>
    <TableRow>
      {#each columns as column (column.key)}
        {#if column.sortable}
          <TableHeaderCell column={column.key} sortable>{column.label}</TableHeaderCell>
        {:else}
          <TableHeaderCell>{column.label}</TableHeaderCell>
        {/if}
      {/each}
    </TableRow>
  </TableHeader>
  <TableBody>
    {#each rows as row (row.id)}
      <TableRow>
        {#each row.cells as cell, index (index)}
          <TableCell>{cell}</TableCell>
        {/each}
      </TableRow>
    {/each}
  </TableBody>
</Table>
