<script lang="ts" module>
  import Header from './component-page-table-header-mock.svelte';
  import HeaderCell from './component-page-table-header-cell-mock.svelte';
  import Row from './component-page-table-row-mock.svelte';
  import Body from './component-page-table-body-mock.svelte';
  import Cell from './component-page-table-cell-mock.svelte';

  export { Body, Cell, Header, HeaderCell, Row };
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';

  let { caption, children }: { caption?: string; children?: Snippet } = $props();
</script>

<table>
  {#if caption !== undefined}
    <caption>{caption}</caption>
  {/if}
  {#if children !== undefined}
    {@render children()}
  {/if}
</table>
