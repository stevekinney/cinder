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
  import { useResizeObserver } from '../../utilities/use-resize-observer.svelte.ts';
  import type { BentoGridProps } from './bento-grid.types.ts';

  const COLLAPSE_MAX_WIDTH_REM = 48;
  const FALLBACK_ROOT_FONT_SIZE_PX = 16;

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

  let isNarrow = $state(false);
  let hasMeasuredWidth = $state(false);

  const resolvedColumns = $derived.by(() => {
    if (typeof columns === 'number') {
      if (!Number.isInteger(columns) || columns < 1) return undefined;
      return `repeat(${columns}, minmax(0, 1fr))`;
    }
    if (typeof columns === 'string' && columns.length > 0) return columns;
    return undefined;
  });

  function getCollapseMaxWidthPx(): number {
    if (typeof window === 'undefined') return COLLAPSE_MAX_WIDTH_REM * FALLBACK_ROOT_FONT_SIZE_PX;

    const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    const baseFontSize =
      Number.isFinite(rootFontSize) && rootFontSize > 0 ? rootFontSize : FALLBACK_ROOT_FONT_SIZE_PX;
    return COLLAPSE_MAX_WIDTH_REM * baseFontSize;
  }

  function updateNarrowState(width: number): void {
    if (!Number.isFinite(width) || width <= 0) {
      return;
    }

    hasMeasuredWidth = true;
    isNarrow = width <= getCollapseMaxWidthPx();
  }

  function getObservedWidth(entry: ResizeObserverEntry): number {
    const borderBoxSize = Array.isArray(entry.borderBoxSize)
      ? entry.borderBoxSize[0]
      : entry.borderBoxSize;

    return borderBoxSize?.inlineSize ?? entry.contentRect.width;
  }

  const observeResize = useResizeObserver(
    (entries) => {
      const entry = entries[0];
      if (entry) updateNarrowState(getObservedWidth(entry));
    },
    { box: 'border-box', enabled: () => collapse },
  );

  const observeGrid = (node: HTMLElement) => {
    updateNarrowState(node.getBoundingClientRect().width);
    return observeResize(node);
  };
</script>

<svelte:element
  this={as}
  {...rest}
  {@attach observeGrid}
  class={classNames('cinder-bento-grid', customClassName)}
  data-cinder-collapse={collapse ? '' : undefined}
  data-cinder-narrow={collapse && isNarrow ? '' : undefined}
  data-cinder-wide={collapse && hasMeasuredWidth && !isNarrow ? '' : undefined}
  style:--cinder-bento-grid-columns={resolvedColumns}
  style:--cinder-bento-grid-row-gap={rowGap ?? gap}
  style:--cinder-bento-grid-column-gap={columnGap ?? gap}
>
  {@render children?.()}
</svelte:element>
