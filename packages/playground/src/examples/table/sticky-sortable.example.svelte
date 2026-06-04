<script lang="ts" module>
  export const title = 'Sticky sortable header';
  export const description =
    'Sortable columns with stickyHeader={true}. Scroll the table body to verify the focus ring on the sort button is not clipped by the sticky thead.';
</script>

<script lang="ts">
  import { Table } from '@lostgradient/cinder/table';
  import type { TableSort } from '@lostgradient/cinder/table';
  let sort: TableSort | undefined = $state(undefined);

  const people = [
    { name: 'Ada Lovelace', role: 'Mathematician', commits: 142 },
    { name: 'Grace Hopper', role: 'Computer Scientist', commits: 98 },
    { name: 'Alan Turing', role: 'Cryptanalyst', commits: 76 },
    { name: 'Linus Torvalds', role: 'Engineer', commits: 512 },
    { name: 'Margaret Hamilton', role: 'Software Engineer', commits: 304 },
    { name: 'Dennis Ritchie', role: 'Language Designer', commits: 231 },
    { name: 'Ken Thompson', role: 'Systems Programmer', commits: 189 },
    { name: 'John Backus', role: 'Compiler Pioneer', commits: 67 },
  ];

  const sorted = $derived.by(() => {
    if (!sort) return people;
    return [...people].sort((a, b) => {
      const key = sort!.column as keyof (typeof people)[0];
      const aVal = a[key];
      const bVal = b[key];
      const cmp =
        typeof aVal === 'number' && typeof bVal === 'number'
          ? aVal - bVal
          : String(aVal).localeCompare(String(bVal));
      return sort!.direction === 'ascending' ? cmp : -cmp;
    });
  });
</script>

<div
  style="max-height: 250px; overflow-y: auto; border: 1px solid var(--cinder-border-muted); border-radius: var(--cinder-radius-md);"
>
  <Table caption="Contributors" stickyHeader bind:sort>
    <Table.Header>
      <Table.Row>
        <Table.HeaderCell column="name" sortable>Name</Table.HeaderCell>
        <Table.HeaderCell column="role" sortable>Role</Table.HeaderCell>
        <Table.HeaderCell column="commits" sortable align="right">Commits</Table.HeaderCell>
      </Table.Row>
    </Table.Header>
    <Table.Body>
      {#each sorted as person (person.name)}
        <Table.Row>
          <Table.Cell>{person.name}</Table.Cell>
          <Table.Cell>{person.role}</Table.Cell>
          <Table.Cell align="right">{person.commits}</Table.Cell>
        </Table.Row>
      {/each}
    </Table.Body>
  </Table>
</div>
