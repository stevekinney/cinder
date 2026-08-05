<script lang="ts" module>
  /**
   * Test-only fixture that reaches the two TableRow selection guards the
   * shared `table-fixture.svelte` cannot: it always supplies the
   * selected/onSelectedChange/selectionLabel trio together (or sets
   * `selectionDisabled`), and always wraps rows in TableHeader/TableBody.
   *
   * This fixture composes a bare, minimal Table so a test can pass a
   * partial selection-prop trio, or omit the TableHeader/TableBody section
   * wrapper entirely, to exercise TableRow's mount-time validation guards.
   */
  export type TableRowInvalidSelectionFixtureProps = {
    /** Renders a selectable body row with only `selected` set (omits onSelectedChange/selectionLabel). */
    partialTrio?: boolean;
    /** Renders a selectable TableRow directly under Table, with no TableHeader/TableBody wrapper. */
    noSectionWrapper?: boolean;
  };
</script>

<script lang="ts">
  import Table from '../../components/table/table.svelte';
  import TableBody from '../../components/table-body/table-body.svelte';
  import TableCell from '../../components/table-cell/table-cell.svelte';
  import TableRow from '../../components/table-row/table-row.svelte';

  let { partialTrio = false, noSectionWrapper = false }: TableRowInvalidSelectionFixtureProps =
    $props();

  // The whole point of `partialTrio` is to construct the invalid-at-the-type-level
  // state (a partial selection-prop trio) that TableRow's own runtime guard exists
  // to reject. TableRowProps' discriminated union forbids this shape statically —
  // svelte-check can't suppress a whole-component prop error with an inline
  // type-expect-error directive (same limitation documented in
  // select.type-test.svelte), so this spreads from a deliberately `any`-typed
  // object to reach the runtime path.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const partialSelectionProps: any = { selected: false };
</script>

<Table selectable>
  {#if noSectionWrapper}
    <TableRow selected={false} onSelectedChange={() => {}} selectionLabel="Select row">
      <TableCell>Alice</TableCell>
    </TableRow>
  {:else if partialTrio}
    <TableBody>
      <TableRow {...partialSelectionProps}>
        <TableCell>Alice</TableCell>
      </TableRow>
    </TableBody>
  {:else}
    <TableBody>
      <TableRow selected={false} onSelectedChange={() => {}} selectionLabel="Select row">
        <TableCell>Alice</TableCell>
      </TableRow>
    </TableBody>
  {/if}
</Table>
