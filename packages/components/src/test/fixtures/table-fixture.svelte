<script lang="ts" module>
  import type { TableSort } from '../../components/table/table.types.ts';
  import type { TableDensity } from '../../components/table/table.types.ts';
  import type { TableScrollContainerProps } from '../../components/table/table.types.ts';
  import type { TableCellProps } from '../../components/table-cell/table-cell.types.ts';
  /** Test-only fixture composing a sortable table. */
  export type TableFixtureProps = {
    sort?: TableSort;
    caption?: string;
    stickyHeader?: boolean;
    density?: TableDensity;
    selectable?: boolean;
    scrollable?: boolean;
    scrollContainerProps?: TableScrollContainerProps;
    includeHeaderSelectionState?: boolean;
    includeHeaderSelectionHandler?: boolean;
    renderSecondHeaderRow?: boolean;
    /** Set of selected row IDs when selection is enabled. */
    selectedIds?: Set<string>;
    /** Called when the user toggles a row; receives the new set. */
    onSelectedIds?: (next: Set<string>) => void;
    columns: Array<{ key: string; label: string; sortable?: boolean }>;
    rows: Array<{ id: string; cells: string[]; selectionDisabled?: boolean }>;
    /** Optional extra native attributes forwarded to every TableCell (for passthrough tests). */
    cellProps?: Omit<TableCellProps, 'children'>;
  };
</script>

<script lang="ts">
  import Table from '../../components/table/table.svelte';
  import TableBody from '../../components/table-body/table-body.svelte';
  import TableCell from '../../components/table-cell/table-cell.svelte';
  import TableHeader from '../../components/table-header/table-header.svelte';
  import TableHeaderCell from '../../components/table-header-cell/table-header-cell.svelte';
  import TableRow from '../../components/table-row/table-row.svelte';

  let {
    sort = $bindable(),
    caption,
    stickyHeader = false,
    density,
    selectable = false,
    scrollable = false,
    scrollContainerProps,
    includeHeaderSelectionState = true,
    includeHeaderSelectionHandler = true,
    renderSecondHeaderRow = false,
    selectedIds = new Set<string>(),
    onSelectedIds,
    columns,
    rows,
    cellProps,
  }: TableFixtureProps = $props();

  const selectableRows = $derived(rows.filter((r) => !r.selectionDisabled));
  const allSelected = $derived(
    selectableRows.length > 0 && selectableRows.every((r) => selectedIds.has(r.id)),
  );
  const someSelected = $derived(selectableRows.some((r) => selectedIds.has(r.id)));

  function onSelectAll(next: boolean): void {
    if (next) {
      onSelectedIds?.(new Set(selectableRows.map((r) => r.id)));
    } else {
      onSelectedIds?.(new Set());
    }
  }

  function onRowSelectedChange(id: string, next: boolean): void {
    const updated = new Set(selectedIds);
    if (next) {
      updated.add(id);
    } else {
      updated.delete(id);
    }
    onSelectedIds?.(updated);
  }
</script>

<Table
  bind:sort
  {...caption !== undefined ? { caption } : {}}
  {...density !== undefined ? { density } : {}}
  {stickyHeader}
  {selectable}
  {scrollable}
  {...scrollContainerProps !== undefined ? { scrollContainerProps } : {}}
>
  <TableHeader
    {...includeHeaderSelectionState ? { allSelected, someSelected } : {}}
    {...includeHeaderSelectionHandler ? { onselectall: onSelectAll } : {}}
  >
    <TableRow>
      {#each columns as column (column.key)}
        {#if column.sortable}
          <TableHeaderCell column={column.key} sortable>{column.label}</TableHeaderCell>
        {:else}
          <TableHeaderCell>{column.label}</TableHeaderCell>
        {/if}
      {/each}
    </TableRow>
    {#if renderSecondHeaderRow}
      <TableRow>
        {#each columns as column (column.key)}
          <TableHeaderCell>{column.label}</TableHeaderCell>
        {/each}
      </TableRow>
    {/if}
  </TableHeader>
  <TableBody>
    {#each rows as row (row.id)}
      {#if row.selectionDisabled}
        <TableRow selectionDisabled={true}>
          {#each row.cells as cell, index (index)}
            <TableCell {...cellProps}>{cell}</TableCell>
          {/each}
        </TableRow>
      {:else}
        <TableRow
          selected={selectedIds.has(row.id)}
          onselectedchange={(next) => onRowSelectedChange(row.id, next)}
          selectionLabel={`Select ${row.cells[0]}`}
        >
          {#each row.cells as cell, index (index)}
            <TableCell {...cellProps}>{cell}</TableCell>
          {/each}
        </TableRow>
      {/if}
    {/each}
  </TableBody>
</Table>
