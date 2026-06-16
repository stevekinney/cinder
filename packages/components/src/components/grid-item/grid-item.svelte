<script lang="ts" module>
  /**
   * @cinder
   * @category layout
   * @status beta
   * @purpose Optional placement child for Grid that controls column and row spans or explicit track placement.
   * @tag layout
   * @tag grid
   * @useWhen A child in a grid needs to span tracks or start at a specific track.
   * @avoidWhen Every child can use default grid auto-placement - render plain children inside Grid instead. | grid
   * @related grid
   */
  export type { GridItemProps } from './grid-item.types.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import type { GridItemProps } from './grid-item.types.ts';

  let {
    span,
    columnStart,
    columnEnd,
    rowSpan,
    rowStart,
    as = 'div',
    class: customClassName,
    children,
    ...rest
  }: GridItemProps = $props();

  const columnSpan = $derived(span !== undefined ? String(span) : undefined);
  const resolvedColumnStart = $derived(columnStart !== undefined ? String(columnStart) : undefined);
  const resolvedColumnEnd = $derived(columnEnd !== undefined ? String(columnEnd) : undefined);
  const resolvedRowSpan = $derived(rowSpan !== undefined ? String(rowSpan) : undefined);
  const resolvedRowStart = $derived(rowStart !== undefined ? String(rowStart) : undefined);
</script>

<svelte:element
  this={as}
  {...rest}
  class={classNames('cinder-grid-item', customClassName)}
  data-cinder-column-span={columnSpan !== undefined ? 'true' : undefined}
  data-cinder-row-span={resolvedRowSpan !== undefined ? 'true' : undefined}
  style:--cinder-grid-item-column-span={columnSpan}
  style:--cinder-grid-item-column-start={resolvedColumnStart}
  style:--cinder-grid-item-column-end={resolvedColumnEnd}
  style:--cinder-grid-item-row-span={resolvedRowSpan}
  style:--cinder-grid-item-row-start={resolvedRowStart}
>
  {@render children?.()}
</svelte:element>
