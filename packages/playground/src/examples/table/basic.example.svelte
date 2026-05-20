<script lang="ts" module>
  export const title = 'Basic table';
  export const description = 'Header row plus three body rows; semantic <table> markup.';
</script>

<script lang="ts">
  import { Table } from 'cinder/table';
  import { TableBody } from 'cinder/table-body';
  import { TableCell } from 'cinder/table-cell';
  import { TableHeader } from 'cinder/table-header';
  import { TableHeaderCell } from 'cinder/table-header-cell';
  import { TableRow } from 'cinder/table-row';
  const people = [
    { name: 'Ada Lovelace', role: 'Mathematician', commits: 142 },
    { name: 'Grace Hopper', role: 'Computer Scientist', commits: 98 },
    { name: 'Alan Turing', role: 'Cryptanalyst', commits: 76 },
  ];
</script>

<Table caption="Recent contributors">
  <TableHeader>
    <TableRow>
      <TableHeaderCell>Name</TableHeaderCell>
      <TableHeaderCell>Role</TableHeaderCell>
      <TableHeaderCell>Commits</TableHeaderCell>
    </TableRow>
  </TableHeader>
  <TableBody>
    {#each people as person (person.name)}
      <TableRow>
        <TableCell>{person.name}</TableCell>
        <TableCell>{person.role}</TableCell>
        <TableCell align="right">{person.commits}</TableCell>
      </TableRow>
    {/each}
  </TableBody>
</Table>
