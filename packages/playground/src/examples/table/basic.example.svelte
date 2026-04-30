<script lang="ts" module>
  export const title = 'Basic table';
  export const description = 'Header row plus three body rows; semantic <table> markup.';
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
