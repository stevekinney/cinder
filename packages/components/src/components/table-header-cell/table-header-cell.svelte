<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status stable
   * @purpose Column header cell within a table-header that labels a column and optionally triggers sort changes when sortable.
   * @tag table
   * @tag header
   * @useWhen Labeling a column inside a table-header row.
   * @useWhen Making a column user-sortable by setting the sortable prop and supplying a column identifier.
   * @avoidWhen Rendering a body data cell — use table-cell instead.
   * @related table-header, table-cell
   */
  export type { TableHeaderCellProps } from './table-header-cell.types.ts';
</script>

<script lang="ts">
  import type { TableHeaderCellProps } from './table-header-cell.types.ts';

  import { getTableContext } from '../table/table.context.ts';
  import { cn } from '../../utilities/class-names.ts';

  let {
    column,
    sortable = false,
    scope = 'col',
    align = 'left',
    class: className,
    children,
    ...rest
  }: TableHeaderCellProps = $props();

  const table = getTableContext();

  // A column is only actually sortable when both `sortable` is set and a `column`
  // identifier is supplied — the inner <button> renders under that same guard.
  // Without it we would advertise a sortable-but-unsorted column to assistive
  // technology (`aria-sort="none"`, `data-cinder-sortable`) with no operable
  // control behind it.
  const isSortable = $derived(sortable && !!column);

  // aria-sort lives on the <th> per WAI-ARIA. The accessible name and
  // keyboard activation live on the inner <button> when sortable.
  const ariaSort = $derived(
    isSortable && table.sort?.column === column
      ? table.sort?.direction
      : isSortable
        ? 'none'
        : undefined,
  );

  function handleClick(): void {
    if (!sortable || !column) return;
    table.onSortChange(column);
  }
</script>

<th
  {...rest}
  {scope}
  class={cn('cinder-table__header-cell', className)}
  data-cinder-align={align}
  data-cinder-sortable={isSortable || undefined}
  aria-sort={ariaSort}
>
  {#if isSortable}
    <button type="button" class="cinder-table__sort-button" onclick={handleClick}>
      {@render children()}
      <span
        class="cinder-table__sort-indicator"
        aria-hidden="true"
        data-cinder-direction={ariaSort}
      >
        <svg
          viewBox="0 0 16 16"
          width="12"
          height="12"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline class="cinder-table__sort-chevron-up" points="4 7 8 4 12 7" />
          <polyline class="cinder-table__sort-chevron-down" points="4 9 8 12 12 9" />
        </svg>
      </span>
    </button>
  {:else}
    {@render children()}
  {/if}
</th>
