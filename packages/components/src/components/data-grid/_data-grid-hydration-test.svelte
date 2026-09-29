<script lang="ts">
  import DataGrid from './data-grid.svelte';
  import { makeRows, makeMetricColumns } from './data-grid-hydration-data.ts';
  import type { DataGridColumnDef } from './data-grid.types.ts';

  let { mode }: { mode: 'logs' | 'issues' } = $props();
  type Issue = { id: string; title: string; owner: string };
  const issueColumns: DataGridColumnDef<Issue>[] = [
    { key: 'title', header: 'Title' },
    { key: 'owner', header: 'Owner' },
  ];
</script>

{#if mode === 'logs'}
  <DataGrid
    rows={makeRows(100)}
    columns={makeMetricColumns(4)}
    getRowId={(row) => row.id}
    virtualizeRows
    virtualizeColumns
    rowHeight={20}
    aria-label="Logs"
  />
{:else}
  <DataGrid rows={[]} columns={issueColumns} getRowId={(row) => row.id} aria-label="Issues" />
{/if}
