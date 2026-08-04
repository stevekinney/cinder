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
  let measuredWidth = $state(0);
  let observedNode = $state<HTMLElement | null>(null);

  function getCollapseMaxWidthPx(): number {
    if (typeof window === 'undefined') return COLLAPSE_MAX_WIDTH_REM * FALLBACK_ROOT_FONT_SIZE_PX;

    const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    const baseFontSize =
      Number.isFinite(rootFontSize) && rootFontSize > 0 ? rootFontSize : FALLBACK_ROOT_FONT_SIZE_PX;
    return COLLAPSE_MAX_WIDTH_REM * baseFontSize;
  }

  function updateNarrowState(width: number, collapseMaxWidthPx = getCollapseMaxWidthPx()): void {
    if (!Number.isFinite(width) || width <= 0) return;
    if (!Number.isFinite(collapseMaxWidthPx) || collapseMaxWidthPx <= 0) return;

    measuredWidth = width;
    hasMeasuredWidth = true;
    isNarrow = width <= collapseMaxWidthPx;
  }

  function getElementBorderBoxWidth(node: HTMLElement): number {
    return node.offsetWidth || node.getBoundingClientRect().width;
  }

  function getObservedWidth(entry: ResizeObserverEntry): number {
    const borderBoxSize = Array.isArray(entry.borderBoxSize)
      ? entry.borderBoxSize[0]
      : entry.borderBoxSize;

    if (borderBoxSize) {
      const writingMode = getComputedStyle(entry.target).writingMode;
      const usesVerticalInlineAxis = /^(?:vertical|sideways)-/i.test(writingMode);
      return usesVerticalInlineAxis ? borderBoxSize.blockSize : borderBoxSize.inlineSize;
    }

    if (entry.target instanceof HTMLElement) {
      return getElementBorderBoxWidth(entry.target);
    }

    return entry.contentRect.width;
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
      updateNarrowState(getElementBorderBoxWidth(observedNode));
    }
  });

  $effect(() => {
    if (!narrowCollapseEnabled || !observedNode || typeof window === 'undefined') return;
    const node = observedNode;

    const recomputeNarrowState = () => {
      updateNarrowState(measuredWidth);
    };
    const remeasureWidth = () => {
      updateNarrowState(getElementBorderBoxWidth(node));
    };
    const stylesheetLinks = new Set<HTMLLinkElement>();
    const usesStylesheetFallback = typeof ResizeObserver === 'undefined';
    const observeStylesheetLinks = () => {
      for (const link of stylesheetLinks) {
        if (!link.isConnected || !link.relList.contains('stylesheet')) {
          link.removeEventListener('load', recomputeNarrowState);
          stylesheetLinks.delete(link);
        }
      }

      for (const link of document.head?.querySelectorAll<HTMLLinkElement>(
        'link[rel~="stylesheet"]',
      ) ?? []) {
        if (!stylesheetLinks.has(link)) {
          stylesheetLinks.add(link);
          link.addEventListener('load', recomputeNarrowState);
        }
      }
    };
    const observer =
      typeof MutationObserver === 'undefined' || !usesStylesheetFallback
        ? null
        : new MutationObserver(() => {
            recomputeNarrowState();
            observeStylesheetLinks();
          });
    observer?.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style'],
    });
    if (document.head && usesStylesheetFallback) {
      observer?.observe(document.head, {
        attributes: true,
        attributeFilter: ['disabled', 'href', 'media', 'rel'],
        characterData: true,
        childList: true,
        subtree: true,
      });
      observeStylesheetLinks();
    }
    if (usesStylesheetFallback) {
      window.addEventListener('resize', remeasureWidth);
    }

    return () => {
      observer?.disconnect();
      for (const link of stylesheetLinks) {
        link.removeEventListener('load', recomputeNarrowState);
      }
      if (usesStylesheetFallback) {
        window.removeEventListener('resize', remeasureWidth);
      }
    };
  });

  $effect(() => {
    if (
      !narrowCollapseEnabled ||
      typeof window === 'undefined' ||
      typeof ResizeObserver === 'undefined' ||
      !document.body
    )
      return;

    const probe = document.createElement('span');
    probe.setAttribute('aria-hidden', 'true');
    probe.setAttribute('data-cinder-grid-threshold-probe', '');
    Object.assign(probe.style, {
      all: 'initial',
      contain: 'strict',
      display: 'block',
      height: '0',
      pointerEvents: 'none',
      position: 'fixed',
      visibility: 'hidden',
      width: `${COLLAPSE_MAX_WIDTH_REM}rem`,
    });
    document.body.append(probe);

    const observer = new ResizeObserver(() => {
      updateNarrowState(measuredWidth, getElementBorderBoxWidth(probe));
    });
    observer.observe(probe, { box: 'border-box' });

    return () => {
      observer.disconnect();
      probe.remove();
    };
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
