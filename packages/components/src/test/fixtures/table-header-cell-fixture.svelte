<script lang="ts" module>
  import type { TableHeaderCellProps } from '../../components/table-header-cell/table-header-cell.types.ts';

  export type TableHeaderCellFixtureProps = {
    align?: TableHeaderCellProps['align'];
    sortable?: TableHeaderCellProps['sortable'];
  };
</script>

<script lang="ts">
  import Table from '../../components/table/table.svelte';
  import TableBody from '../../components/table-body/table-body.svelte';
  import TableCell from '../../components/table-cell/table-cell.svelte';
  import TableHeader from '../../components/table-header/table-header.svelte';
  import TableHeaderCell from '../../components/table-header-cell/table-header-cell.svelte';
  import TableRow from '../../components/table-row/table-row.svelte';

  let { align, sortable = false }: TableHeaderCellFixtureProps = $props();
</script>

<Table>
  <TableHeader>
    <TableRow>
      <TableHeaderCell {...align === undefined ? {} : { align }} {sortable} column="commits">
        Commits
      </TableHeaderCell>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>42</TableCell>
    </TableRow>
  </TableBody>
</Table>
