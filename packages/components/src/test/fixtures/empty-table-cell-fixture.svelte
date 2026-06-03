<script lang="ts">
  import Table from '../../components/table/table.svelte';
  import TableBody from '../../components/table-body/table-body.svelte';
  import TableCell from '../../components/table-cell/table-cell.svelte';
  import TableHeader from '../../components/table-header/table-header.svelte';
  import TableHeaderCell from '../../components/table-header-cell/table-header-cell.svelte';
  import TableRow from '../../components/table-row/table-row.svelte';
</script>

<!--
  Minimal table fixture that renders a single TableCell with no children
  snippet to verify the omitted-children case does not throw.
-->
<Table>
  <TableHeader>
    <TableRow>
      <TableHeaderCell>Column</TableHeaderCell>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell></TableCell>
    </TableRow>
  </TableBody>
</Table>
