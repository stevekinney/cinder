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
  import { useResizeObserver } from '../../utilities/use-resize-observer.svelte.ts';
  import type { GridProps } from './grid.types.ts';

  const COLLAPSE_MAX_WIDTH_REM = 48;
  const FALLBACK_ROOT_FONT_SIZE_PX = 16;

  let {
    columns,
    gap,
    rowGap,
    columnGap,
    narrowCollapseEnabled = false,
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

  let isNarrow = $state(false);
  let hasMeasuredWidth = $state(false);
  let observedNode = $state<HTMLElement | null>(null);

  function getCollapseMaxWidthPx(): number {
    if (typeof window === 'undefined') return COLLAPSE_MAX_WIDTH_REM * FALLBACK_ROOT_FONT_SIZE_PX;

    const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    const baseFontSize =
      Number.isFinite(rootFontSize) && rootFontSize > 0 ? rootFontSize : FALLBACK_ROOT_FONT_SIZE_PX;
    return COLLAPSE_MAX_WIDTH_REM * baseFontSize;
  }

  function updateNarrowState(width: number): void {
    if (!Number.isFinite(width) || width <= 0) return;

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
    { box: 'border-box', enabled: () => narrowCollapseEnabled },
  );

  const observeGrid = (node: HTMLElement) => {
    observedNode = node;
    return observeResize(node);
  };

  $effect(() => {
    if (narrowCollapseEnabled && observedNode) {
      updateNarrowState(observedNode.getBoundingClientRect().width);
    }
  });
</script>

<svelte:element
  this={as}
  {...rest}
  {@attach observeGrid}
  class={classNames('cinder-grid', customClassName)}
  data-cinder-collapse={narrowCollapseEnabled ? '' : undefined}
  data-cinder-narrow={narrowCollapseEnabled && isNarrow ? '' : undefined}
  data-cinder-wide={narrowCollapseEnabled && hasMeasuredWidth && !isNarrow ? '' : undefined}
  style:--cinder-grid-columns={resolvedColumns}
  style:--cinder-grid-row-gap={rowGap ?? gap}
  style:--cinder-grid-column-gap={columnGap ?? gap}
  style:--cinder-grid-min-item-width={resolvedMinItemWidth}
>
  {@render children?.()}
</svelte:element>
