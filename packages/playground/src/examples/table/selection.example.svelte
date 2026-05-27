<script lang="ts" module>
  export const title = 'Selectable rows';
  export const description =
    'Table with a select-all checkbox in the header and per-row selection. One row is explicitly disabled from selection.';
</script>

<script lang="ts">
  import { Table } from 'cinder/table';
  const people = [
    {
      id: '1',
      name: 'Ada Lovelace',
      role: 'Mathematician',
      commits: 142,
      selectionDisabled: false,
    },
    {
      id: '2',
      name: 'Grace Hopper',
      role: 'Computer Scientist',
      commits: 98,
      selectionDisabled: false,
    },
    { id: '3', name: 'Alan Turing', role: 'Cryptanalyst', commits: 76, selectionDisabled: true },
  ];

  let selectedIds = $state(new Set<string>());

  const selectableRows = $derived(people.filter((p) => !p.selectionDisabled));
  const allSelected = $derived(
    selectableRows.length > 0 && selectableRows.every((p) => selectedIds.has(p.id)),
  );
  const someSelected = $derived(selectableRows.some((p) => selectedIds.has(p.id)));

  function onSelectAll(next: boolean): void {
    if (next) {
      selectedIds = new Set(selectableRows.map((p) => p.id));
    } else {
      selectedIds = new Set();
    }
  }

  function onRowChange(id: string, next: boolean): void {
    const updated = new Set(selectedIds);
    if (next) {
      updated.add(id);
    } else {
      updated.delete(id);
    }
    selectedIds = updated;
  }
</script>

<Table caption="Recent contributors" selectable>
  <Table.Header
    {allSelected}
    {someSelected}
    {onSelectAll}
    selectAllLabel="Select all selectable rows"
  >
    <Table.Row>
      <Table.HeaderCell>Name</Table.HeaderCell>
      <Table.HeaderCell>Role</Table.HeaderCell>
      <Table.HeaderCell align="right">Commits</Table.HeaderCell>
    </Table.Row>
  </Table.Header>
  <Table.Body>
    {#each people as person (person.id)}
      {#if person.selectionDisabled}
        <Table.Row selectionDisabled={true}>
          <Table.Cell>{person.name}</Table.Cell>
          <Table.Cell>{person.role}</Table.Cell>
          <Table.Cell align="right">{person.commits}</Table.Cell>
        </Table.Row>
      {:else}
        <Table.Row
          selected={selectedIds.has(person.id)}
          onSelectedChange={(next) => onRowChange(person.id, next)}
          selectionLabel={`Select ${person.name}`}
        >
          <Table.Cell>{person.name}</Table.Cell>
          <Table.Cell>{person.role}</Table.Cell>
          <Table.Cell align="right">{person.commits}</Table.Cell>
        </Table.Row>
      {/if}
    {/each}
  </Table.Body>
</Table>

{#if selectedIds.size > 0}
  <p style="margin-top: 0.75rem; font-size: 0.875rem; color: var(--cinder-text-muted)">
    {selectedIds.size} row{selectedIds.size !== 1 ? 's' : ''} selected
  </p>
{/if}
