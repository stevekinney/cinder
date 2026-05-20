<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status stable
   * @purpose Responsive grid container that arranges grid-list-item tiles into auto-sized columns.
   * @tag grid
   * @tag gallery
   * @useWhen Presenting a homogenous collection of cards that should reflow into multiple columns.
   * @useWhen Constraining tile minimum widths per breakpoint via the columns prop.
   * @avoidWhen Comparing rows of structured data — use table instead.
   * @avoidWhen Stacking dense list rows vertically — use stacked-list-item instead.
   * @related grid-list-item, table
   */
  export type { GridListProps } from './grid-list.types.ts';
</script>

<script lang="ts">
  import type { GridListProps } from './grid-list.types.ts';
  import { classNames } from '../../utilities/class-names.ts';

  let { columns, class: className, children, ...rest }: GridListProps = $props();

  const minWidth = $derived(columns && columns.length > 0 ? columns : undefined);
</script>

<ul
  {...rest}
  role="list"
  class={classNames('cinder-grid-list', className)}
  style:--cinder-grid-list-min-width={minWidth}
>
  {@render children()}
</ul>
