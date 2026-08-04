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
    const ownerDocument = observedNode?.ownerDocument;
    const ownerWindow = ownerDocument?.defaultView;
    if (!ownerDocument || !ownerWindow) {
      return COLLAPSE_MAX_WIDTH_REM * FALLBACK_ROOT_FONT_SIZE_PX;
    }

    const rootFontSize = Number.parseFloat(
      ownerWindow.getComputedStyle(ownerDocument.documentElement).fontSize,
    );
    const baseFontSize =
      Number.isFinite(rootFontSize) && rootFontSize > 0 ? rootFontSize : FALLBACK_ROOT_FONT_SIZE_PX;
    return COLLAPSE_MAX_WIDTH_REM * baseFontSize;
  }

  function updateNarrowState(width: number, collapseMaxWidthPx = getCollapseMaxWidthPx()): void {
    if (!Number.isFinite(width) || width < 0) return;
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
      const writingMode =
        entry.target.ownerDocument.defaultView?.getComputedStyle(entry.target).writingMode ?? '';
      const usesVerticalInlineAxis = /^(?:vertical|sideways)-/i.test(writingMode);
      return usesVerticalInlineAxis ? borderBoxSize.blockSize : borderBoxSize.inlineSize;
    }

    const targetWindow = entry.target.ownerDocument.defaultView;
    if (targetWindow && entry.target instanceof targetWindow.HTMLElement) {
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
    if (!narrowCollapseEnabled || !observedNode) return;
    const node = observedNode;
    const ownerDocument = node.ownerDocument;
    const ownerWindow = ownerDocument.defaultView;
    if (!ownerWindow) return;

    const remeasureWidth = () => {
      updateNarrowState(getElementBorderBoxWidth(node));
    };
    const stylesheetLinks = new Set<HTMLLinkElement>();
    const usesStylesheetFallback = typeof ResizeObserver === 'undefined';
    const observeStylesheetLinks = () => {
      for (const link of stylesheetLinks) {
        if (!link.isConnected || !link.relList.contains('stylesheet')) {
          link.removeEventListener('load', remeasureWidth);
          stylesheetLinks.delete(link);
        }
      }

      for (const link of ownerDocument.head?.querySelectorAll<HTMLLinkElement>(
        'link[rel~="stylesheet"]',
      ) ?? []) {
        if (!stylesheetLinks.has(link)) {
          stylesheetLinks.add(link);
          link.addEventListener('load', remeasureWidth);
        }
      }
    };
    const observer =
      typeof MutationObserver === 'undefined' || !usesStylesheetFallback
        ? null
        : new MutationObserver(() => {
            remeasureWidth();
            observeStylesheetLinks();
          });
    observer?.observe(ownerDocument.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style'],
    });
    if (ownerDocument.head && usesStylesheetFallback) {
      observer?.observe(ownerDocument.head, {
        attributes: true,
        attributeFilter: ['disabled', 'href', 'media', 'rel'],
        characterData: true,
        childList: true,
        subtree: true,
      });
      observeStylesheetLinks();
    }
    if (usesStylesheetFallback) {
      ownerWindow.addEventListener('resize', remeasureWidth);
    }

    return () => {
      observer?.disconnect();
      for (const link of stylesheetLinks) {
        link.removeEventListener('load', remeasureWidth);
      }
      if (usesStylesheetFallback) {
        ownerWindow.removeEventListener('resize', remeasureWidth);
      }
    };
  });

  $effect(() => {
    if (
      !narrowCollapseEnabled ||
      !observedNode ||
      typeof ResizeObserver === 'undefined' ||
      !observedNode.ownerDocument.body
    )
      return;

    const ownerDocument = observedNode.ownerDocument;

    const probe = ownerDocument.createElement('span');
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
    ownerDocument.body.append(probe);

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
