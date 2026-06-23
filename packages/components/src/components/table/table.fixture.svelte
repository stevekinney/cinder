<script lang="ts">
  import { SvelteSet } from 'svelte/reactivity';

  import { Table, type TableSort } from './index.ts';

  type Person = {
    id: string;
    name: string;
    role: string;
    commits: number;
  };

  const people: Person[] = [
    { id: 'ada', name: 'Ada Lovelace', role: 'Mathematician', commits: 142 },
    { id: 'grace', name: 'Grace Hopper', role: 'Computer Scientist', commits: 98 },
    { id: 'alan', name: 'Alan Turing', role: 'Cryptanalyst', commits: 76 },
  ];

  let sort: TableSort | undefined = $state();
  const selectedIds = new SvelteSet<string>();

  const sortedPeople = $derived.by(() => {
    const activeSort = sort;
    if (!activeSort) return people;
    return [...people].sort((a, b) => {
      const key = activeSort.column as keyof Person;
      const aValue = a[key];
      const bValue = b[key];
      const comparison =
        typeof aValue === 'number' && typeof bValue === 'number'
          ? aValue - bValue
          : String(aValue).localeCompare(String(bValue));
      return activeSort.direction === 'ascending' ? comparison : -comparison;
    });
  });

  const allSelected = $derived(people.every((person) => selectedIds.has(person.id)));
  const someSelected = $derived(people.some((person) => selectedIds.has(person.id)));

  function setAllSelected(next: boolean): void {
    selectedIds.clear();
    if (next) {
      for (const person of people) selectedIds.add(person.id);
    }
  }

  function setRowSelected(id: string, next: boolean): void {
    if (next) selectedIds.add(id);
    else selectedIds.delete(id);
  }
</script>

<div class="table-fixture">
  <Table caption="Recent contributors" selectable bind:sort>
    <Table.Header
      {allSelected}
      {someSelected}
      onselectall={setAllSelected}
      selectAllLabel="Select all contributors"
    >
      <Table.Row>
        <Table.HeaderCell column="name" sortable>Name</Table.HeaderCell>
        <Table.HeaderCell>Role</Table.HeaderCell>
        <Table.HeaderCell column="commits" sortable align="right">Commits</Table.HeaderCell>
      </Table.Row>
    </Table.Header>
    <Table.Body>
      {#each sortedPeople as person (person.id)}
        <Table.Row
          selected={selectedIds.has(person.id)}
          onselectedchange={(next) => setRowSelected(person.id, next)}
          selectionLabel={`Select ${person.name}`}
        >
          <Table.Cell>{person.name}</Table.Cell>
          <Table.Cell>{person.role}</Table.Cell>
          <Table.Cell align="right">{person.commits}</Table.Cell>
        </Table.Row>
      {/each}
    </Table.Body>
  </Table>
</div>

<style>
  .table-fixture {
    max-inline-size: 42rem;
  }
</style>
