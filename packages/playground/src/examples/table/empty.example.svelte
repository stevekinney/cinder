<script lang="ts" module>
  export const title = 'Empty table';
  export const description = 'A table with no body rows still renders the header and caption.';
</script>

<script lang="ts">
  import {
    Table,
    TableBody,
    TableCell,
    TableHeader,
    TableHeaderCell,
    TableRow,
  } from '../../../../components/src/index.ts';
</script>

<Table caption="Recent contributors (none yet)">
  <TableHeader>
    <TableRow>
      <TableHeaderCell>Name</TableHeaderCell>
      <TableHeaderCell>Role</TableHeaderCell>
      <TableHeaderCell>Commits</TableHeaderCell>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>
        <span style="color: #888; font-style: italic;"
          >No contributors yet — invite your team to get started.</span
        >
      </TableCell>
      <TableCell>—</TableCell>
      <TableCell align="right">0</TableCell>
    </TableRow>
  </TableBody>
</Table>
