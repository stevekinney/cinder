<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status stable
   * @purpose Composite root that establishes table semantics, density, and sort context for nested header, body, row, and cell parts.
   * @tag table
   * @tag grid
   * @useWhen Comparing rows of structured records across consistent columns.
   * @useWhen Coordinating column sort state across header cells via the sort prop.
   * @avoidWhen Rendering a responsive card grid — use grid-list instead.
   * @avoidWhen Listing key-value attributes of one entity — use description-list instead.
   * @related table-header, table-body, table-row, table-cell, table-header-cell
   */
  export {
    TABLE_CONTEXT_KEY,
    TABLE_HEADER_SELECTION_CONTEXT_KEY,
    TABLE_SECTION_CONTEXT_KEY,
  } from './table.context.ts';
  export type {
    SortDirection,
    TableContext,
    TableDensity,
    TableHeaderSelectionContext,
    TableProps,
    TableSectionContext,
    TableSort,
  } from './table.types.ts';
</script>

<script lang="ts">
  import { TABLE_CONTEXT_KEY } from './table.context.ts';
  import type { TableContext, TableProps } from './table.types.ts';
  import { setContext } from 'svelte';

  import { cn } from '../../utilities/class-names.ts';

  let {
    sort = $bindable(),
    caption,
    stickyHeader = false,
    density = 'comfortable',
    selectable = false,
    class: className,
    children,
  }: TableProps = $props();

  function onSortChange(column: string): void {
    if (!sort || sort.column !== column) {
      sort = { column, direction: 'ascending' };
      return;
    }
    // Same column — toggle direction.
    sort = {
      column,
      direction: sort.direction === 'ascending' ? 'descending' : 'ascending',
    };
  }

  setContext<TableContext>(TABLE_CONTEXT_KEY, {
    get sort() {
      return sort;
    },
    get selectionEnabled() {
      return selectable;
    },
    onSortChange,
  });
</script>

<table
  class={cn('cinder-table', className)}
  data-cinder-sticky-header={stickyHeader || undefined}
  data-cinder-density={density}
  data-cinder-selectable={selectable || undefined}
>
  {#if caption}
    <caption class="cinder-table__caption">{caption}</caption>
  {/if}
  {@render children()}
</table>
