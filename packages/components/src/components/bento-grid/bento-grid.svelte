<script lang="ts" module>
  /**
   * @cinder
   * @category layout
   * @status beta
   * @purpose CSS grid container for deliberate asymmetric bento mosaics with optional single-column collapse at narrow widths.
   * @tag layout
   * @tag grid
   * @tag bento
   * @useWhen Building feature mosaics where highlight tiles span rows or columns in a controlled layout.
   * @useWhen Keeping bento placement declarative by pairing BentoGrid with BentoGrid.Cell or BentoCell children.
   * @avoidWhen Packing variable-height content automatically - use masonry instead. | masonry
   * @avoidWhen You only need uniform tracks without feature-tile spans - use grid instead. | grid
   * @related bento-cell, grid, masonry
   */
  export type { BentoGridProps } from './bento-grid.types.ts';
</script>

<script lang="ts">
  import Grid from '@lostgradient/cinder/grid';
  import { classNames } from '../../utilities/class-names.ts';
  import type { BentoGridProps } from './bento-grid.types.ts';

  let {
    columns,
    gap,
    rowGap,
    columnGap,
    collapse = true,
    as = 'div',
    class: customClassName,
    children,
    ...rest
  }: BentoGridProps = $props();

  const defaultColumns = 'repeat(4, minmax(0, 1fr))';
  const resolvedColumns = $derived.by(() => {
    if (typeof columns === 'number') {
      if (!Number.isInteger(columns) || columns < 1) return undefined;
      return `repeat(${columns}, minmax(0, 1fr))`;
    }
    if (typeof columns === 'string' && columns.length > 0) return columns;
    return defaultColumns;
  });
</script>

<Grid
  {...rest}
  {as}
  columns={resolvedColumns}
  {gap}
  {rowGap}
  {columnGap}
  narrowCollapseEnabled={collapse}
  class={classNames('cinder-bento-grid', customClassName)}
>
  {#snippet children()}
    {@render children?.()}
  {/snippet}
</Grid>
