<script lang="ts" module>
  export const title = 'Scrollable table';
  export const description =
    'Hand-composed cells inside the public horizontal scroll wrapper for dense tables.';
</script>

<script lang="ts">
  import { Table } from '@lostgradient/cinder/table';
  const people = [
    {
      name: 'Ada Lovelace',
      role: 'Mathematician and analytical engine collaborator',
      commits: 142,
    },
    {
      name: 'Grace Hopper',
      role: 'Computer scientist, compiler builder, and systems educator',
      commits: 98,
    },
    {
      name: 'Alan Turing',
      role: 'Cryptanalyst, logician, and theoretical computer scientist',
      commits: 76,
    },
  ];
</script>

<Table caption="Recent contributors" scrollable>
  <Table.Header>
    <Table.Row>
      <Table.HeaderCell>Name</Table.HeaderCell>
      <Table.HeaderCell>Role</Table.HeaderCell>
      <Table.HeaderCell align="right">Commits</Table.HeaderCell>
    </Table.Row>
  </Table.Header>
  <Table.Body>
    {#each people as person (person.name)}
      <Table.Row>
        <Table.Cell>{person.name}</Table.Cell>
        <Table.Cell>{person.role}</Table.Cell>
        <Table.Cell align="right">{person.commits}</Table.Cell>
      </Table.Row>
    {/each}
  </Table.Body>
</Table>
