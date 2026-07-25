<script lang="ts">
  import TableBody from '../../components/table-body/table-body.svelte';
  import TableCell from '../../components/table-cell/table-cell.svelte';
  import TableHeaderCell from '../../components/table-header-cell/table-header-cell.svelte';
  import TableHeader from '../../components/table-header/table-header.svelte';
  import TableRow from '../../components/table-row/table-row.svelte';
  import TableRoot from '../../components/table/table.svelte';
  import { classNames } from '../../utilities/class-names.ts';

  type ChartDataTableRow = { id: string; header: string; cells: string[] };

  let {
    caption,
    headers,
    rows,
    visibilityClass,
    describedBy,
  }: {
    caption: string;
    headers: string[];
    rows: ChartDataTableRow[];
    visibilityClass?: string | undefined;
    describedBy?: string | undefined;
  } = $props();
</script>

<TableRoot {caption} class={classNames(visibilityClass)} aria-describedby={describedBy}>
  <TableHeader>
    <TableRow>
      {#each headers as header, index (index)}
        <TableHeaderCell>{header}</TableHeaderCell>
      {/each}
    </TableRow>
  </TableHeader>
  <TableBody>
    {#each rows as row (row.id)}
      <TableRow>
        <TableCell as="th">{row.header}</TableCell>
        {#each row.cells as cell, index (index)}
          <TableCell>{cell}</TableCell>
        {/each}
      </TableRow>
    {/each}
  </TableBody>
</TableRoot>
