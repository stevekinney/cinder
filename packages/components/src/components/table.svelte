<script lang="ts" module>
  import type { Snippet } from 'svelte';

  /** Symbol key for the table Svelte context. */
  export const TABLE_CONTEXT_KEY = Symbol('cinder-table');

  /** Sort direction. */
  export type SortDirection = 'ascending' | 'descending';

  /** Bound sort state shape. */
  export type TableSort = {
    /** Column key currently sorted by. */
    column: string;
    /** Direction of the active sort. */
    direction: SortDirection;
  };

  /**
   * Shape of the table context provided to header cells. Header cells call
   * `onSortChange` with their column key when activated; the table propagates
   * the new sort state to its bindable `sort` prop.
   */
  export type TableContext = {
    readonly sort: TableSort | undefined;
    onSortChange: (column: string) => void;
  };

  /**
   * Props for the Table component.
   *
   * Cinder's Table is **deliberately small**: semantic markup, controlled sort
   * state, optional sticky header. It does NOT virtualize, sort, paginate,
   * select rows, edit cells, pin columns, resize columns, or aggregate. The
   * consumer owns data ordering and dispatches sort intents through the
   * `sort` bindable.
   */
  export type TableProps = {
    /**
     * Bound sort state. When the user activates a sortable header, this prop
     * is updated to reflect the new column / direction.
     *
     * Pass `undefined` initially when no column is sorted; the component will
     * never write back `undefined` itself (sort always toggles to a column).
     */
    sort?: TableSort | undefined;
    /** Visual caption rendered as a `<caption>` element. */
    caption?: string;
    /** When true, the header sticks to the top of the scrolling container. */
    stickyHeader?: boolean;
    /** Additional class names merged with `.cinder-table`. */
    class?: string;
    /** TableHeader, TableBody, etc. */
    children: Snippet;
  };
</script>

<script lang="ts">
  import { setContext } from 'svelte';

  import { cn } from '../utilities/class-names.ts';

  let {
    sort = $bindable(),
    caption,
    stickyHeader = false,
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
    onSortChange,
  });
</script>

<table class={cn('cinder-table', className)} data-cinder-sticky-header={stickyHeader || undefined}>
  {#if caption}
    <caption class="cinder-table__caption">{caption}</caption>
  {/if}
  {@render children()}
</table>
