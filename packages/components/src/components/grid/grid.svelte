<script lang="ts" module>
  /**
   * @cinder
   * @category layout
   * @status beta
   * @purpose CSS grid container for explicit columns, intrinsic auto-fill layouts, and two-dimensional placement.
   * @tag layout
   * @tag grid
   * @useWhen Building form layouts, card grids, or dashboards that need two-dimensional placement.
   * @useWhen Creating intrinsic responsive grids by passing minItemWidth.
   * @avoidWhen Presenting homogeneous gallery tiles - use grid-list instead. | grid-list
   * @avoidWhen Packing variable-height content into waterfall columns - use masonry instead. | masonry
   * @related grid-item, grid-list, masonry
   */
  export type { GridColumns, GridProps } from './grid.types.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import type { GridProps } from './grid.types.ts';

  let {
    columns,
    gap,
    rowGap,
    columnGap,
    minItemWidth,
    as = 'div',
    class: customClassName,
    children,
    ...rest
  }: GridProps = $props();

  const resolvedMinItemWidth = $derived(
    typeof minItemWidth === 'string' && minItemWidth.length > 0 ? minItemWidth : undefined,
  );

  const resolvedColumns = $derived.by(() => {
    if (resolvedMinItemWidth) {
      return 'repeat(auto-fill, minmax(min(var(--cinder-grid-min-item-width), 100%), 1fr))';
    }

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
  class={classNames('cinder-grid', customClassName)}
  style:--cinder-grid-columns={resolvedColumns}
  style:--cinder-grid-row-gap={rowGap ?? gap}
  style:--cinder-grid-column-gap={columnGap ?? gap}
  style:--cinder-grid-min-item-width={resolvedMinItemWidth}
>
  {@render children?.()}
</svelte:element>
