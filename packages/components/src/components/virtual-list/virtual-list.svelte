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
  /** ~0.5s at 60fps: long enough for a smooth scroll to land, short enough to never hang. */
  const SCROLL_SETTLE_MAX_FRAMES = 30;

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
  let previousDynamicSizeMode = false;
  let pendingScrollTarget: number | null = $state(null);
  let isDestroyed = false;
  // $state, not a plain let: arming the pin must itself re-run the re-pin effect.
  let isPinnedToBottom = $state(false);
  let scrollToIndexGeneration = 0;

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
      // A run that both switches sizing mode and appends would be comparing the
      // old scroll position against geometry measured in the other mode. In
      // particular `previousDynamicTotalSize` stays 0 for as long as fixed mode is
      // active, so switching to dynamic mid-append would make isAtBottom(…, 0, …)
      // true for any position and yank a scrolled-up reader to the end.
      dynamicSize === previousDynamicSizeMode &&
      isAtBottom(
        element,
        dynamicSize ? previousDynamicTotalSize : previousItemCount * resolvedItemHeight,
        viewportHeight,
      );

    previousItemCount = itemCount;
    previousDynamicTotalSize = offsets?.totalSize ?? 0;
    previousDynamicSizeMode = dynamicSize;
  });

  /**
   * Drops cached sizes for rows that are no longer in the list.
   *
   * Without this a long-lived feed that filters or rolls over its contents keeps
   * every size it has ever measured, so memory tracks history rather than the
   * current collection — and a key that comes back later would start from stale
   * geometry until its ResizeObserver reported again.
   */
  $effect(() => {
    // Depends on `items` and `dynamicSize` only. Reading the cache through
    // `sizes` would register the version counter and re-run this whole O(n) walk
    // after every measurement; `measuredCount` reads the same Map without
    // subscribing, so the walk happens when the list changes and not before
    // anything has been measured at all.
    const currentItems = items;
    if (!dynamicSize || measurementStore.measuredCount === 0) return;
    const validKeys = new Set<VirtualListKey>();
    for (let index = 0; index < currentItems.length; index += 1) validKeys.add(keyAt(index));
    measurementStore.prune(validKeys);
  });

  /**
   * Drops cached sizes when dynamic mode is switched off.
   *
   * Rows are no longer observed while fixed mode runs, so a row that changes
   * height in the meantime — an offscreen one especially — would otherwise be
   * rebuilt from its stale cached size the moment dynamic mode came back, and an
   * offscreen row may never be re-observed to correct it.
   *
   * Note this deliberately does NOT touch `rowResizeObserver`. Observer lifetime
   * is keyed to component teardown alone; keying it to a prop is what previously
   * let a re-render disconnect it permanently.
   */
  $effect(() => {
    if (dynamicSize) return;
    measurementStore.reset();
    previousOffsets = undefined;
  });

  /**
   * Releases the bottom pin whenever the option is off.
   *
   * `handleScroll` only maintains the flag while `stickToBottom` is true, so a
   * pin taken before the option was disabled would survive scrolling away and
   * re-enabling the option later would jump the viewport to the bottom with no
   * append having happened.
   */
  $effect(() => {
    if (!stickToBottom) isPinnedToBottom = false;
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
      isPinnedToBottom = true;
    });
  });

  /**
   * Holds the viewport at the bottom while an appended row is still being measured.
   *
   * Under `dynamicSize` the append pin above scrolls to the total as it is
   * currently estimated. A row that then measures taller than `itemHeight` — the
   * common case for the wrapping and media rows this mode exists for — grows the
   * total without changing the item count, so nothing re-pins, and the anchor
   * correction deliberately ignores it because it sits below the anchor. The
   * viewport would sit short of the bottom, contradicting what `stickToBottom`
   * promises. Re-pinning on total-size growth closes that window.
   */
  $effect(() => {
    // Both reactive reads happen BEFORE any early return. Guarding first would
    // skip them on the run where the pin is not yet armed, so the effect would
    // never register the total size as a dependency and would never re-run when a
    // measurement changed it — which is the entire case this exists to handle.
    const totalSize = offsets?.totalSize ?? 0;
    const currentViewportHeight = viewportHeight;
    if (!stickToBottom || !dynamicSize || !isPinnedToBottom) return;
    const element = scrollElement;
    if (!element) return;
    const target = maxScrollOffset(totalSize, currentViewportHeight);
    if (Math.abs(element.scrollTop - target) <= 1) return;
    element.scrollTop = target;
    scrollOffset = Math.max(0, element.scrollTop);
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

  /**
   * The component's only teardown hook. Deliberately has NO dependencies, so its
   * cleanup runs exactly once, when the component is actually destroyed.
   *
   * Tying this to `dynamicSize` instead is a trap worth naming: a parent that
   * re-renders with an unchanged `dynamicSize` can still re-run the effect, whose
   * cleanup would disconnect the shared row observer — and because the row
   * attachments themselves did not change, nothing would ever re-observe. Every
   * row then goes silently unmeasured while the component still looks healthy.
   *
   * Mode changes need no teardown here: when `dynamicSize` goes false each row's
   * own attachment re-runs and unobserves itself, and keeping the observer and the
   * size cache alive across a toggle avoids re-measuring rows that never changed.
   */
  $effect(() => () => {
    isDestroyed = true;
    rowResizeObserver?.disconnect();
    rowResizeObserver = undefined;
    measurementStore.reset();
    previousOffsets = undefined;
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
    // Scrolling away from the bottom releases the pin; scrolling back re-arms it.
    if (stickToBottom) isPinnedToBottom = isAtBottom(element, currentTotalSize(), viewportHeight);
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
      // Zero is a legitimate measurement — a row can collapse to nothing. Discarding
      // it would leave the offsets table reserving space the row no longer occupies,
      // shifting every later offset and scroll target until it grew again.
      if (!Number.isFinite(blockSize) || blockSize < 0) continue;
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
      // Resolved from the node's own document, matching `useResizeObserver`. A list
      // mounted inside an iframe has its ResizeObserver on that document's window;
      // the outer `globalThis` one is either absent or bound to the wrong document,
      // either of which leaves every row silently unmeasured.
      const ResizeObserverConstructor =
        typeof document !== 'undefined' && node.ownerDocument === document
          ? globalThis.ResizeObserver
          : node.ownerDocument.defaultView?.ResizeObserver;
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

  /**
   * Waits until the container's scroll position stops moving, bounded.
   *
   * A single frame is not enough: with `behavior: 'smooth'` the browser is still
   * animating a frame later, so every retry would be spent mid-flight and the
   * loop would give up before the destination rows ever mounted and measured.
   * Waiting for the position to hold still covers both that and a late
   * measurement, and the frame cap keeps a continuously-scrolling container
   * (a user dragging, an ongoing animation) from holding the loop open.
   */
  async function waitForScrollSettled(element: HTMLElement): Promise<void> {
    await tick();
    let previousOffset = Number.NaN;
    for (let frame = 0; frame < SCROLL_SETTLE_MAX_FRAMES; frame += 1) {
      await nextAnimationFrame();
      if (isDestroyed) return;
      const currentOffset = element.scrollTop;
      if (currentOffset === previousOffset) return;
      previousOffset = currentOffset;
    }
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
    // Each call supersedes any settle loop still running. Without this, two
    // overlapping loops write competing targets and the older one can land last,
    // finishing rapid navigation on the wrong item.
    scrollToIndexGeneration += 1;
    const generation = scrollToIndexGeneration;

    for (let attempt = 0; attempt < SCROLL_TO_INDEX_MAX_ATTEMPTS; attempt += 1) {
      const element = scrollElement;
      if (!element) return;
      if (generation !== scrollToIndexGeneration) return;

      const target = computeScrollToIndexOffset({
        index,
        itemCount: items.length,
        locator: currentLocator(),
        totalSize: currentTotalSize(),
        viewportSize: viewportHeight,
        // Read live from the element, not from `scrollOffset` state. During a
        // smooth scroll, a throttled scroll event, or an external write, the state
        // lags the real position — and `align: 'auto'` decides whether to move at
        // all by comparing against it.
        currentScrollOffset: Math.max(0, element.scrollTop),
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

      await waitForScrollSettled(element);
      // The component can be torn down, or a newer call issued, while those frames
      // were pending. Reading derived state past teardown would read a destroyed
      // effect's, and continuing past a newer call would fight it.
      if (isDestroyed || generation !== scrollToIndexGeneration) return;

      const settled = computeScrollToIndexOffset({
        index,
        itemCount: items.length,
        locator: currentLocator(),
        totalSize: currentTotalSize(),
        viewportSize: viewportHeight,
        // Read live from the element, not from `scrollOffset` state. During a
        // smooth scroll, a throttled scroll event, or an external write, the state
        // lags the real position — and `align: 'auto'` decides whether to move at
        // all by comparing against it.
        currentScrollOffset: Math.max(0, element.scrollTop),
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
