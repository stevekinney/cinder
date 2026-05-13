<script lang="ts" module>
  export const title = 'Selectable rows';
  export const description =
    'Table with a select-all checkbox in the header and per-row selection. One row is explicitly disabled from selection.';
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
  <TableHeader
    {allSelected}
    {someSelected}
    {onSelectAll}
    selectAllLabel="Select all selectable rows"
  >
    <TableRow>
      <TableHeaderCell>Name</TableHeaderCell>
      <TableHeaderCell>Role</TableHeaderCell>
      <TableHeaderCell>Commits</TableHeaderCell>
    </TableRow>
  </TableHeader>
  <TableBody>
    {#each people as person (person.id)}
      {#if person.selectionDisabled}
        <TableRow selectionDisabled={true}>
          <TableCell>{person.name}</TableCell>
          <TableCell>{person.role}</TableCell>
          <TableCell align="right">{person.commits}</TableCell>
        </TableRow>
      {:else}
        <TableRow
          selected={selectedIds.has(person.id)}
          onSelectedChange={(next) => onRowChange(person.id, next)}
          selectionLabel={`Select ${person.name}`}
        >
          <TableCell>{person.name}</TableCell>
          <TableCell>{person.role}</TableCell>
          <TableCell align="right">{person.commits}</TableCell>
        </TableRow>
      {/if}
    {/each}
  </TableBody>
</Table>

{#if selectedIds.size > 0}
  <p style="margin-top: 0.75rem; font-size: 0.875rem; color: var(--cinder-text-muted)">
    {selectedIds.size} row{selectedIds.size !== 1 ? 's' : ''} selected
  </p>
{/if}
