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
  import { classNames } from '../../utilities/class-names.ts';

  let {
    column,
    sortable = false,
    scope = 'col',
    align = 'left',
    class: className,
    children,
    actions,
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
  const nextSortDescription = $derived(
    ariaSort === 'ascending' ? 'Activate to sort descending' : 'Activate to sort ascending',
  );
  const sortButtonDescriptionAttributes = $derived({
    'aria-description': nextSortDescription,
  });

  function handleClick(): void {
    if (!sortable || !column) return;
    table.onSortChange(column);
  }
</script>

<th
  {...rest}
  {scope}
  class={classNames('cinder-table__header-cell', className)}
  data-cinder-align={align}
  data-cinder-sortable={isSortable || undefined}
  aria-sort={ariaSort}
>
  <div class="cinder-table__header-content">
    {#if isSortable}
      <button
        {...sortButtonDescriptionAttributes}
        type="button"
        class="cinder-table__sort-button"
        onclick={handleClick}
      >
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
            <!--
              CIN-127: the two chevrons' flat ends sit 6 viewBox units apart, not 4.
              Round caps at stroke-width 2 grow each polyline by 1 unit past its
              endpoints, so a 4-unit endpoint gap left only 2 units of visible ink
              gap — about 1.5px at the 12px render size, which read as one smudge
              rather than two marks. 6 units leaves 4 units of gap (~3px).
              Ink now spans y=0..16, flush with the viewBox but inside it.
            -->
            <polyline class="cinder-table__sort-chevron-up" points="4 5 8 1 12 5" />
            <polyline class="cinder-table__sort-chevron-down" points="4 11 8 15 12 11" />
          </svg>
        </span>
      </button>
    {:else}
      {@render children()}
    {/if}
    {#if actions}
      <div class="cinder-table__header-actions">{@render actions()}</div>
    {/if}
  </div>
</th>
