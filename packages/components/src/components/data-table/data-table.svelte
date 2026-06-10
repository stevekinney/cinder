<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status alpha
   * @purpose Data-driven convenience wrapper over the compositional Table family that renders a full semantic table from a columns array and a rows array.
   * @tag table
   * @tag data
   * @useWhen Rendering a structured dataset where columns and rows are known at runtime (e.g. API responses, config-driven dashboards).
   * @useWhen You want correct scope=col / scope=row semantics and aria-sort wiring without writing Table.Header / Table.Body manually.
   * @avoidWhen You need custom cell rendering, interactive cells, nested components, or column spanning — use the compositional Table family directly.
   * @avoidWhen You need row selection — DataTable does not expose a selection prop; use Table with selectable instead.
   * @related table, table-header, table-body, table-row, table-cell, table-header-cell
   */
  export type { DataTableColumn, DataTableProps, DataTableRow } from './data-table.types.ts';
</script>

<script lang="ts" generics="Row extends DataTableRow">
  import TableBody from '../table-body/table-body.svelte';
  import TableCell from '../table-cell/table-cell.svelte';
  import TableHeaderCell from '../table-header-cell/table-header-cell.svelte';
  import TableHeader from '../table-header/table-header.svelte';
  import TableRow from '../table-row/table-row.svelte';
  import TableRoot from '../table/table.svelte';

  import { classNames } from '../../utilities/class-names.ts';
  import type { DataTableColumn, DataTableProps, DataTableRow } from './data-table.types.ts';

  let {
    columns,
    rows,
    caption,
    sort = $bindable(),
    stickyHeader = false,
    density = 'comfortable',
    scrollable = false,
    class: className,
  }: DataTableProps<Row> = $props();

  /**
   * The key of the row-header column. Explicitly set via `column.rowHeader === true`,
   * or falls back to the first column's key. Used to render `<th scope="row">` on
   * the appropriate body cell.
   */
  const rowHeaderKey = $derived(
    (columns.find((column) => column.rowHeader === true) ?? columns[0])?.key,
  );

  /**
   * Map a DataTableColumn's `align` value to the value accepted by TableHeaderCell
   * and TableCell (`'left' | 'center' | 'right'`).
   */
  function mapAlign(align: DataTableColumn['align']): 'left' | 'center' | 'right' | undefined {
    if (align === 'start') return 'left';
    if (align === 'end') return 'right';
    if (align === 'center') return 'center';
    return undefined;
  }
</script>

{#snippet table()}
  <TableRoot {...caption !== undefined ? { caption } : {}} {stickyHeader} {density} bind:sort>
    <TableHeader>
      <TableRow>
        {#each columns as column (column.key)}
          <TableHeaderCell
            {...column.sortable ? { column: column.key } : {}}
            sortable={column.sortable ?? false}
            align={mapAlign(column.align) ?? 'left'}
          >
            {column.label}
          </TableHeaderCell>
        {/each}
      </TableRow>
    </TableHeader>
    <TableBody>
      {#each rows as row, rowIndex (rowHeaderKey !== undefined ? String(row[rowHeaderKey]) : rowIndex)}
        <TableRow>
          {#each columns as column (column.key)}
            <TableCell
              as={column.key === rowHeaderKey ? 'th' : 'td'}
              align={mapAlign(column.align) ?? 'left'}
            >
              {row[column.key]}
            </TableCell>
          {/each}
        </TableRow>
      {/each}
    </TableBody>
  </TableRoot>
{/snippet}

{#if scrollable}
  <div class={classNames('cinder-data-table', 'cinder-table-scroll', className)}>
    {@render table()}
  </div>
{:else}
  <div class={classNames('cinder-data-table', className)}>
    {@render table()}
  </div>
{/if}
