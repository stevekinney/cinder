<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status stable
   * @purpose Data cell within a table-row that renders one column value with configurable horizontal alignment.
   * @tag table
   * @tag cell
   * @useWhen Rendering a single value inside a body row of a table.
   * @useWhen Aligning numeric or trailing-action columns via the align prop.
   * @avoidWhen Rendering a column header — use table-header-cell instead.
   * @related table-row, table-header-cell
   */
  export type { TableCellProps } from './table-cell.types.ts';
</script>

<script lang="ts">
  import type { TableCellProps } from './table-cell.types.ts';
  import { classNames } from '../../utilities/class-names.ts';

  let { align = 'left', as = 'td', class: className, children, ...rest }: TableCellProps = $props();
</script>

<svelte:element
  this={as}
  {...rest}
  scope={as === 'th' ? 'row' : undefined}
  class={classNames('cinder-table__cell', className)}
  data-cinder-align={align}
>
  {@render children?.()}
</svelte:element>
