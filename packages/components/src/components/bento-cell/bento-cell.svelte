<script lang="ts" module>
  /**
   * @cinder
   * @category layout
   * @status beta
   * @purpose Optional placement child for BentoGrid that controls row and column spans or explicit track placement.
   * @tag layout
   * @tag grid
   * @tag bento
   * @useWhen A tile in BentoGrid needs to span multiple tracks or start at a specific track.
   * @avoidWhen Every tile can use default auto-placement inside BentoGrid. | bento-grid
   * @related bento-grid, grid-item
   */
  export type { BentoCellProps } from './bento-cell.types.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import type { BentoCellProps } from './bento-cell.types.ts';

  let {
    colSpan,
    rowSpan,
    columnStart,
    columnEnd,
    rowStart,
    rowEnd,
    as = 'div',
    class: customClassName,
    children,
    ...rest
  }: BentoCellProps = $props();

  const resolvedColSpan = $derived(colSpan !== undefined ? String(colSpan) : undefined);
  const resolvedRowSpan = $derived(rowSpan !== undefined ? String(rowSpan) : undefined);
  const resolvedColumnStart = $derived(columnStart !== undefined ? String(columnStart) : undefined);
  const resolvedColumnEnd = $derived(columnEnd !== undefined ? String(columnEnd) : undefined);
  const resolvedRowStart = $derived(rowStart !== undefined ? String(rowStart) : undefined);
  const resolvedRowEnd = $derived(rowEnd !== undefined ? String(rowEnd) : undefined);
  const shouldApplyColSpan = $derived(
    resolvedColSpan !== undefined && resolvedColumnEnd === undefined,
  );
  const shouldApplyRowSpan = $derived(
    resolvedRowSpan !== undefined && resolvedRowEnd === undefined,
  );
</script>

<svelte:element
  this={as}
  {...rest}
  class={classNames('cinder-bento-cell', customClassName)}
  data-cinder-col-span={shouldApplyColSpan ? 'true' : undefined}
  data-cinder-row-span={shouldApplyRowSpan ? 'true' : undefined}
  style:--cinder-bento-cell-col-span={resolvedColSpan}
  style:--cinder-bento-cell-row-span={resolvedRowSpan}
  style:--cinder-bento-cell-column-start={resolvedColumnStart}
  style:--cinder-bento-cell-column-end={resolvedColumnEnd}
  style:--cinder-bento-cell-row-start={resolvedRowStart}
  style:--cinder-bento-cell-row-end={resolvedRowEnd}
>
  {@render children?.()}
</svelte:element>
