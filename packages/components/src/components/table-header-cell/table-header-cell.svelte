<script lang="ts" module>
  export type { TableHeaderCellProps } from './table-header-cell.types.ts';
</script>

<script lang="ts">
  import type { TableHeaderCellProps } from './table-header-cell.types.ts';
  import { getContext } from 'svelte';

  import { TABLE_CONTEXT_KEY } from '../table/table.context.ts';
  import type { TableContext } from '../table/table.types.ts';
  import { cn } from '../../utilities/class-names.ts';

  let {
    column,
    sortable = false,
    scope = 'col',
    class: className,
    children,
  }: TableHeaderCellProps = $props();

  const rawTable = getContext<TableContext | undefined>(TABLE_CONTEXT_KEY);
  if (!rawTable) {
    throw new Error('TableHeaderCell must be used inside a Table component.');
  }
  const table: TableContext = rawTable;

  // aria-sort lives on the <th> per WAI-ARIA. The accessible name and
  // keyboard activation live on the inner <button> when sortable.
  const ariaSort = $derived(
    sortable && column && table.sort?.column === column
      ? table.sort.direction
      : sortable
        ? 'none'
        : undefined,
  );

  function handleClick(): void {
    if (!sortable || !column) return;
    table.onSortChange(column);
  }
</script>

<th
  {scope}
  class={cn('cinder-table__header-cell', className)}
  data-cinder-sortable={sortable || undefined}
  aria-sort={ariaSort}
>
  {#if sortable && column}
    <button type="button" class="cinder-table__sort-button" onclick={handleClick}>
      {@render children()}
      <span
        class="cinder-table__sort-indicator"
        aria-hidden="true"
        data-cinder-direction={ariaSort}
      >
      </span>
    </button>
  {:else}
    {@render children()}
  {/if}
</th>
