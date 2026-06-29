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

  const resolvedColumns = $derived.by(() => {
    if (typeof columns === 'number') {
      if (!Number.isInteger(columns) || columns < 1) return undefined;
      return `repeat(${columns}, 1fr)`;
    }
    if (typeof columns === 'string' && columns.length > 0) return columns;
    return undefined;
  });
</script>

<svelte:element
  this={as}
  {...rest}
  class={classNames('cinder-bento-grid', customClassName)}
  data-cinder-collapse={collapse ? 'true' : undefined}
  style:--cinder-bento-grid-columns={resolvedColumns}
  style:--cinder-bento-grid-row-gap={rowGap ?? gap}
  style:--cinder-bento-grid-column-gap={columnGap ?? gap}
>
  {@render children?.()}
</svelte:element>
