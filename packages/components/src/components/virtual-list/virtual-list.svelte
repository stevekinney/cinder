<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status beta
   * @purpose Windowing primitive for long vertical lists that renders only the visible rows plus overscan in a native scroll container, with fixed-height rows by default and opt-in measured rows.
   * @tag list
   * @tag virtualization
   * @tag performance
   * @useWhen Rendering thousands of same-height append-only rows such as logs, event streams, or activity feeds.
   * @useWhen Rows vary in height because they wrap, embed media, or hold user content — enable dynamicSize to measure and cache each row.
   * @useWhen You need a reusable primitive that owns native vertical scrolling but leaves row markup to a snippet.
   * @avoidWhen Rendering columns or two-dimensional grids — use data-grid for grid semantics and column virtualization.
   * @related data-list, data-table, data-grid, load-more
   */
  export type {
    VirtualListProps,
    VirtualListRef,
    VirtualListRowContext,
    VirtualListScrollAlign,
    VirtualListScrollToIndexOptions,
  } from './virtual-list.types.ts';
  export type {
    FixedVirtualWindow,
    FixedVirtualWindowItem,
  } from '../../utilities/fixed-virtual-window.ts';
  export {
    getFixedVirtualWindow,
    parsePixelLength,
    resolveVirtualItemHeight,
    resolveVirtualOverscan,
  } from '../../utilities/fixed-virtual-window.ts';
</script>

<script lang="ts" generics="Item">
  import { tick } from 'svelte';

  import { classNames } from '../../utilities/class-names.ts';
  import { useResizeObserver } from '../../utilities/use-resize-observer.svelte.ts';
  import type {
    VirtualListProps,
    VirtualListRef,
    VirtualListScrollToIndexOptions,
  } from './virtual-list.types.ts';
  import type { VirtualListKey } from '../../utilities/fixed-virtual-window.ts';
  import {
    getFixedVirtualWindow,
    parsePixelLength,
    resolveVirtualItemHeight,
    resolveVirtualOverscan,
  } from '../../utilities/fixed-virtual-window.ts';
  import {
    buildVirtualOffsets,
    computeScrollToIndexOffset,
    findOffsetIndex,
    getDynamicVirtualWindow,
    resolveMeasurementCorrectionDelta,
    type VirtualItemLocator,
  } from './_internal/measurement-window.ts';
  import { VirtualListMeasurementStore } from './_internal/virtual-list-measurement-store.svelte.ts';

  let {
    items,
    itemHeight,
    dynamicSize = false,
    overscan = 5,
    height = '20rem',
    stickToBottom = false,
    tabindex = 0,
    getKey,
    row,
    role = 'list',
    onscroll: onScroll,
    class: className,
    ref = $bindable<VirtualListRef | undefined>(),
    ...rest
  }: VirtualListProps<Item> = $props();

  const SCROLL_TO_INDEX_MAX_ATTEMPTS = 3;
  const SCROLL_TO_INDEX_SETTLED_EPSILON = 1;

  let scrollElement: HTMLElement | undefined = $state();
  let scrollOffset = $state(0);
  let measuredViewportHeight = $state(0);
  let previousItemCount = 0;
  let hasObservedItemCount = false;
  let shouldStickAfterAppend = false;

  // Dynamic-size mode only. Never read or written while `dynamicSize` is false.
  const measurementStore = new VirtualListMeasurementStore();
  let rowResizeObserver: ResizeObserver | undefined;
  let previousOffsets: readonly number[] | undefined;
  let previousDynamicTotalSize = 0;
  let pendingScrollTarget: number | null = $state(null);
  let isDestroyed = false;

  const resolvedItemHeight = $derived(resolveVirtualItemHeight(itemHeight));
  const resolvedOverscan = $derived(resolveVirtualOverscan(overscan));
  const viewportHeight = $derived(
    measuredViewportHeight || estimateViewportHeight(height, resolvedItemHeight),
  );

  const offsets = $derived(
    dynamicSize
      ? buildVirtualOffsets({
          itemCount: items.length,
          estimateSize: resolvedItemHeight,
          getKey: keyAt,
          measuredSizes: measurementStore.sizes,
        })
      : undefined,
  );

  const virtualWindow = $derived(
    dynamicSize && offsets !== undefined
      ? getDynamicVirtualWindow({
          offsets,
          getKey: keyAt,
          scrollOffset,
          viewportSize: viewportHeight,
          overscan: resolvedOverscan,
        })
      : getFixedVirtualWindow({
          itemCount: items.length,
          itemHeight: resolvedItemHeight,
          scrollOffset,
          viewportHeight,
          overscan: resolvedOverscan,
          getKey: keyAt,
        }),
  );
  const renderedItems = $derived(
    virtualWindow.items.flatMap((virtualItem) => {
      const item = items[virtualItem.index];
      return item === undefined ? [] : [{ ...virtualItem, item }];
    }),
  );

  $effect(() => {
    const element = scrollElement;
    if (!element) return;
    syncViewport(element);
  });

  const observeResize = useResizeObserver(() => {
    if (scrollElement) syncViewport(scrollElement);
  });

  $effect.pre(() => {
    const itemCount = items.length;
    const element = scrollElement;

    if (!hasObservedItemCount) {
      previousItemCount = itemCount;
      previousDynamicTotalSize = offsets?.totalSize ?? 0;
      hasObservedItemCount = true;
      shouldStickAfterAppend = false;
      return;
    }

    shouldStickAfterAppend =
      stickToBottom &&
      element !== undefined &&
      itemCount > previousItemCount &&
      isAtBottom(
        element,
        dynamicSize ? previousDynamicTotalSize : previousItemCount * resolvedItemHeight,
        viewportHeight,
      );

    previousItemCount = itemCount;
    previousDynamicTotalSize = offsets?.totalSize ?? 0;
  });

  $effect(() => {
    const itemCount = items.length;
    const element = scrollElement;
    if (!stickToBottom || !shouldStickAfterAppend || !element) return;

    void tick().then(() => {
      element.scrollTop = maxScrollOffset(
        dynamicSize ? (offsets?.totalSize ?? 0) : itemCount * resolvedItemHeight,
        viewportHeight,
      );
      syncViewport(element);
      shouldStickAfterAppend = false;
    });
  });

  /**
   * Resolves the scroll correction a batch of measurements implies, against the
   * offsets table as it stood BEFORE those measurements landed.
   *
   * `offsets` is derived off the same version counter `record()` bumps, so by the
   * time this runs it has already rebuilt to include the very measurements being
   * corrected for. Binary-searching it would find the anchor against
   * post-mutation geometry and mis-identify it, so the pre-mutation snapshot in
   * `previousOffsets` is the only correct table to search.
   *
   * The correction is computed here, pre-patch, but written in the paired
   * `$effect` below — after Svelte patches the DOM, still before paint. A
   * relative `scrollTop += delta` written here instead would be clamped by the
   * browser against the stale, pre-patch content size and partially lost.
   */
  $effect.pre(() => {
    if (!dynamicSize) return;
    void measurementStore.pendingCorrectionsVersion;
    const corrections = measurementStore.consumePendingCorrections();
    const currentOffsets = offsets?.offsets;

    if (corrections.length > 0 && scrollElement && previousOffsets) {
      const anchorIndex = findOffsetIndex(previousOffsets, scrollOffset);
      const delta = resolveMeasurementCorrectionDelta(corrections, anchorIndex);
      if (delta !== 0) pendingScrollTarget = scrollOffset + delta;
    }

    previousOffsets = currentOffsets;
  });

  $effect(() => {
    if (pendingScrollTarget === null) return;
    const element = scrollElement;
    const target = pendingScrollTarget;
    pendingScrollTarget = null;
    if (!element) return;
    // Never animated: a smooth correction would visibly show the jump it exists to hide.
    element.scrollTop = Math.max(0, target);
    scrollOffset = Math.max(0, element.scrollTop);
  });

  const virtualListRef: VirtualListRef = { scrollToIndex };

  $effect(() => {
    ref = virtualListRef;
    return () => {
      ref = undefined;
    };
  });

  // No dependencies, so this cleanup runs exactly once, at teardown. The
  // scroll-to-index settle loop awaits across frames and must not read derived
  // state belonging to an effect that has since been destroyed.
  $effect(() => () => {
    isDestroyed = true;
  });

  $effect(() => {
    if (!dynamicSize) return;
    return () => {
      rowResizeObserver?.disconnect();
      rowResizeObserver = undefined;
      measurementStore.reset();
      previousOffsets = undefined;
    };
  });

  function keyAt(index: number): VirtualListKey {
    const item = items[index];
    return item === undefined ? index : (getKey?.(item, index) ?? index);
  }

  function estimateViewportHeight(value: string | undefined, resolvedRowHeight: number): number {
    return parsePixelLength(value) ?? resolvedRowHeight * 10;
  }

  function syncViewport(element: HTMLElement): void {
    const rect = element.getBoundingClientRect();
    measuredViewportHeight =
      rect.height || element.clientHeight || parsePixelLength(height) || resolvedItemHeight * 10;
    scrollOffset = Math.max(0, element.scrollTop);
  }

  function handleScroll(event: UIEvent & { currentTarget: EventTarget & HTMLDivElement }): void {
    if (typeof onScroll === 'function') onScroll(event);
    const element = event.currentTarget as HTMLElement;
    scrollOffset = Math.max(0, element.scrollTop);
  }

  function maxScrollOffset(totalSize: number, height: number): number {
    return Math.max(0, totalSize - height);
  }

  function isAtBottom(element: HTMLElement, totalSize: number, height: number): boolean {
    return element.scrollTop >= maxScrollOffset(totalSize, height) - 1;
  }

  /**
   * Reads each measured row and folds its real size into the measurement cache.
   * The row's index comes from the `data-cinder-virtual-index` attribute the
   * template already sets, so no per-row attachment identity has to be tracked;
   * the key is re-derived from that index against the current `items`.
   */
  function handleRowResize(entries: readonly ResizeObserverEntry[]): void {
    for (const entry of entries) {
      const element = entry.target as HTMLElement;
      const rawIndex = element.dataset['cinderVirtualIndex'];
      if (rawIndex === undefined) continue;
      const index = Number.parseInt(rawIndex, 10);
      if (!Number.isInteger(index) || index < 0 || index >= items.length) continue;
      const blockSize = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
      if (!Number.isFinite(blockSize) || blockSize <= 0) continue;
      measurementStore.record(keyAt(index), index, blockSize, resolvedItemHeight);
    }
  }

  /**
   * Observes one mounted row. A single component-owned `ResizeObserver` watches
   * every row rather than one observer per row, and this attachment is a stable
   * function reference so rows are not re-observed on every render.
   *
   * Constructed lazily and only here, which is what keeps the fixed-height path
   * free of any `ResizeObserver` at all, and keeps the module importable during
   * server rendering — Svelte never runs attachments there.
   */
  function observeRow(node: HTMLElement): (() => void) | undefined {
    if (!dynamicSize) return undefined;
    if (!rowResizeObserver) {
      const ResizeObserverConstructor = globalThis.ResizeObserver;
      if (typeof ResizeObserverConstructor !== 'function') return undefined;
      rowResizeObserver = new ResizeObserverConstructor(handleRowResize);
    }
    const observer = rowResizeObserver;
    observer.observe(node, { box: 'border-box' });
    return () => {
      observer.unobserve(node);
    };
  }

  function currentLocator(): VirtualItemLocator {
    const table = offsets?.offsets;
    if (dynamicSize && table) {
      return {
        getStart: (index) => table[index] ?? 0,
        getSize: (index) => (table[index + 1] ?? 0) - (table[index] ?? 0),
      };
    }
    return {
      getStart: (index) => index * resolvedItemHeight,
      getSize: () => resolvedItemHeight,
    };
  }

  function currentTotalSize(): number {
    return dynamicSize ? (offsets?.totalSize ?? 0) : items.length * resolvedItemHeight;
  }

  function nextAnimationFrame(): Promise<void> {
    return new Promise((resolve) => {
      const request = globalThis.requestAnimationFrame;
      if (typeof request !== 'function') {
        resolve();
        return;
      }
      request(() => {
        resolve();
      });
    });
  }

  function scrollToIndex(index: number, options?: VirtualListScrollToIndexOptions): void {
    void runScrollToIndex(index, options);
  }

  /**
   * Under `dynamicSize` a scroll target can move while the scroll is happening:
   * rows that were only estimated get mounted, measured, and resized, shifting
   * everything after them. Each pass re-derives the target from the freshly
   * measured table and re-issues the scroll, capped so this can never spin.
   */
  async function runScrollToIndex(
    index: number,
    options?: VirtualListScrollToIndexOptions,
  ): Promise<void> {
    if (isDestroyed || items.length === 0) return;
    const align = options?.align ?? 'auto';
    const behavior = options?.behavior ?? 'auto';

    for (let attempt = 0; attempt < SCROLL_TO_INDEX_MAX_ATTEMPTS; attempt += 1) {
      const element = scrollElement;
      if (!element) return;

      const target = computeScrollToIndexOffset({
        index,
        itemCount: items.length,
        locator: currentLocator(),
        totalSize: currentTotalSize(),
        viewportSize: viewportHeight,
        currentScrollOffset: scrollOffset,
        align,
      });

      if (behavior === 'smooth' && typeof element.scrollTo === 'function') {
        element.scrollTo({ top: target, behavior: 'smooth' });
      } else {
        element.scrollTop = target;
      }
      scrollOffset = Math.max(0, element.scrollTop);

      // Fixed rows never change size, so the first write always lands exactly.
      if (!dynamicSize) return;

      await tick();
      await nextAnimationFrame();
      // The component can be torn down while those frames were pending. Reading
      // any derived state past that point would be reading a destroyed effect's.
      if (isDestroyed) return;

      const settled = computeScrollToIndexOffset({
        index,
        itemCount: items.length,
        locator: currentLocator(),
        totalSize: currentTotalSize(),
        viewportSize: viewportHeight,
        currentScrollOffset: scrollOffset,
        align,
      });
      if (Math.abs(settled - scrollOffset) <= SCROLL_TO_INDEX_SETTLED_EPSILON) return;
    }
  }
</script>

<svelte:element
  this={'div'}
  {...rest}
  bind:this={scrollElement}
  {@attach observeResize}
  class={classNames('cinder-virtual-list', className)}
  {role}
  {tabindex}
  data-cinder-stick-to-bottom={stickToBottom ? 'true' : undefined}
  data-cinder-dynamic-size={dynamicSize ? 'true' : undefined}
  style:--cinder-virtual-list-height={height}
  onscroll={handleScroll}
>
  <div
    class="cinder-virtual-list__spacer"
    style:height={`${virtualWindow.totalSize}px`}
    aria-hidden={items.length === 0 ? 'true' : undefined}
  >
    <div class="cinder-virtual-list__window" style:top={`${virtualWindow.leadingSize}px`}>
      {#each renderedItems as virtualItem (virtualItem.key)}
        <div
          class="cinder-virtual-list__row"
          role={role === 'list' ? 'listitem' : undefined}
          data-cinder-virtual-index={virtualItem.index}
          style:height={dynamicSize ? undefined : `${virtualItem.size}px`}
          {@attach observeRow}
        >
          {@render row(virtualItem.item, {
            index: virtualItem.index,
            key: virtualItem.key,
            start: virtualItem.start,
            size: virtualItem.size,
          })}
        </div>
      {/each}
    </div>
  </div>
</svelte:element>
