<script lang="ts" module>
  import type { Snippet } from 'svelte';

  export type TableHeaderCellProps = {
    /**
     * Column key. Required when `sortable=true` so the parent Table can
     * track which column the user activated.
     */
    column?: string;
    /**
     * When true, render a button inside the `<th>` and dispatch sort intents
     * to the parent Table. The cell's `aria-sort` reflects the current sort
     * direction (`ascending`, `descending`, or `none`).
     */
    sortable?: boolean;
    /** When set, hint to assistive tech that the column groups multiple rows. */
    scope?: 'col' | 'colgroup';
    /** Additional class names merged with `.cinder-table__header-cell`. */
    class?: string;
    /** Cell content (column label). */
    children: Snippet;
  };
</script>

<script lang="ts">
  import { getContext } from 'svelte';

  import { TABLE_CONTEXT_KEY, type TableContext } from './table.svelte';
  import { cn } from '../utilities/class-names.ts';

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
