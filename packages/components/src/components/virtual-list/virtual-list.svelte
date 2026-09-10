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
  /**
   * Cached for the lifetime of the document: the convention cannot change, and the
   * probe forces layout, so it must not run per instance.
   */
  let detectedRtlScrollType: import('./_internal/geometry.ts').RtlScrollType | null = null;
</script>

<script lang="ts" generics="Item">
  import { tick, untrack } from 'svelte';

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
  import {
    resolveWindowScrollGeometry,
    resolveWindowViewportSize,
  } from './_internal/window-scroll.ts';
  import {
    clearScrollPosition,
    loadScrollPosition,
    saveScrollPosition,
    type ScrollRestorationPosition,
    type ScrollRestorationStorage,
  } from './_internal/scroll-restoration.ts';
  import {
    createEdgeLatch,
    resolveEdgeFireDecision,
    resolveEdgeProximity,
    type EdgeLatch,
  } from './_internal/edge-proximity.ts';
  import {
    classifyItemGrowth,
    shouldPinToEnd,
    type ItemGrowth,
  } from './_internal/reverse-order.ts';
  import {
    classifyRtlScrollType,
    domWritingDirectionReader,
    normalizeInlineScrollOffset,
    resolveObservedMainAxisSize,
    resolveRowLayoutDescriptor,
    resolveWritingDirection,
    type RtlScrollType,
    type WritingDirection,
  } from './_internal/geometry.ts';

  let {
    items,
    itemHeight,
    dynamicSize = false,
    horizontal = false,
    overscan = 5,
    height = '20rem',
    stickToBottom = false,
    reverse = false,
    onEndReached,
    onStartReached,
    windowScroll = false,
    scrollRestoration = false,
    scrollRestorationId,
    tabindex = 0,
    getKey,
    row,
    role = 'list',
    onscroll: onScroll,
    onwheel: onWheel,
    onpointerdown: onPointerDown,
    ontouchstart: onTouchStart,
    onkeydown: onKeyDown,
    class: className,
    ref = $bindable<VirtualListRef | undefined>(),
    ...rest
  }: VirtualListProps<Item> = $props();

  const SCROLL_TO_INDEX_MAX_ATTEMPTS = 3;
  const SCROLL_TO_INDEX_SETTLED_EPSILON = 1;
  /** Keys that scroll a native container. A letter keypress is not a viewport takeover. */
  const SCROLLING_KEYS = new Set([
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'PageUp',
    'PageDown',
    'Home',
    'End',
    ' ',
  ]);
  /** ~0.5s at 60fps: long enough for a smooth scroll to land, short enough to never hang. */
  const SCROLL_SETTLE_MAX_FRAMES = 30;

  let scrollElement: HTMLElement | undefined = $state();
  let scrollOffset = $state(0);
  let measuredViewportHeight = $state(0);
  let hasObservedItemCount = false;
  let shouldStickAfterAppend = false;
  /**
   * Keys as of the last `items` change, so growth can be told apart by WHICH end
   * grew rather than by the count alone. An append and a prepend both raise the
   * count, and they call for opposite handling: one pins to the end, the other
   * must leave the reader exactly where they were.
   *
   * Recomputed whenever `items` changes, which is O(n) — the same order as the
   * work the caller just did building that array, and the same order as the
   * cache-prune pass that already runs on this dependency.
   */
  let previousKeys: readonly VirtualListKey[] = [];
  /** Identity of the array the keys were last derived from, so measurements skip the walk. */
  let previousItems: readonly Item[] | undefined;
  /** Set once on mount under `reverse`, which starts at the end rather than the start. */
  let needsInitialReversePin = false;
  let edgeLatch: EdgeLatch = createEdgeLatch();
  /**
   * Under `windowScroll` the component has no scroll container of its own, so the
   * visible extent is the overlap of the list's box with the viewport rather than
   * the element's own size. Held separately because `measuredViewportHeight`
   * doubles as the container measurement everywhere else.
   */
  let windowVisibleSize = $state(0);
  let windowScrollOffset = $state(0);
  /** True while a window-scrolled list sits entirely outside the viewport. */
  let isWindowListOffscreen = $state(false);
  /** The position as of the last render, so a teardown never has to re-derive it. */
  let latestPosition: ScrollRestorationPosition | undefined;
  /**
   * The id restoration last ran for, rather than a bare flag: a parent that reuses
   * this component for a different collection changes the id, and that is a new
   * position to restore — not the same one already handled.
   */
  let restoredId: string | undefined;

  // Dynamic-size machinery. The store is also reset when `dynamicSize` goes
  // false, so it is not strictly untouched in fixed mode — but nothing in fixed
  // mode ever reads a measured size or queues a correction.
  const measurementStore = new VirtualListMeasurementStore();
  let rowResizeObserver: ResizeObserver | undefined;
  let previousOffsets: readonly number[] | undefined;
  let previousTotalSize = 0;
  /** Cross-axis extent at the last measurement: the width when vertical, the height when horizontal. */
  let previousCrossExtent = 0;

  /**
   * Logical property names for the axis in play. Logical rather than physical so
   * the inline axis flips correctly under RTL with no separate branch: the browser
   * resolves `inset-inline-start` to the right edge on its own.
   */
  const rowLayout = $derived(resolveRowLayoutDescriptor(horizontal ? 'horizontal' : 'vertical'));
  let writingDirection: WritingDirection = $state('ltr');
  let previousEstimate = 0;
  let pendingReanchor: { index: number; offsetWithinRow: number } | null = null;
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
    // Resolved here rather than in a $derived: getComputedStyle does not exist during
    // server rendering, and an effect never runs there.
    writingDirection = resolveWritingDirection(element, domWritingDirectionReader);
    const measuredHeight = syncViewport(element);

    if (needsInitialReversePin) {
      needsInitialReversePin = false;
      // Written here rather than by arming `shouldStickAfterAppend`: that flag is a
      // plain binding, so the append-pin effect does not re-run when it changes —
      // it works only because an `$effect.pre` sets it in the same items-driven
      // pass. Nothing would pick it up from here.
      writeScrollOffset(element, maxScrollOffset(currentTotalSize(), measuredHeight), 'auto');
      scrollOffset = readScrollOffset(element);
      // Under `dynamicSize` the total at mount is only an estimate, so this first
      // write lands short. Marking the list pinned hands it to the re-pin effect,
      // which follows the total as rows measure.
      isPinnedToBottom = true;
    }
  });

  /**
   * Fires the infinite-scroll callbacks as the reader approaches either end.
   *
   * Depends on the window AND the item count: an append can bring the end into
   * range with no scroll event at all, and the count is what re-arms the latch so
   * a second page can be requested after the first arrives.
   */
  $effect(() => {
    const currentWindow = virtualWindow;
    const itemCount = items.length;
    const currentViewportHeight = viewportHeight;
    // Read before the guards below so the effect re-runs when the correction is
    // applied and this clears.
    const hasQueuedCorrection = pendingScrollTarget !== null;
    if (!onEndReached && !onStartReached) {
      // Drop the latch with the callbacks. Left set, re-enabling a callback while
      // still near the same edge and at the same item count would find it already
      // latched and never fire the approach the consumer just asked to hear about.
      edgeLatch = createEdgeLatch();
      return;
    }
    if (isDestroyed) return;

    // A correction is queued, so the reader is about to move and any proximity
    // reading now is stale. Firing on it asks for another page before the last one
    // has been placed — which is exactly what a prepend does, since holding the
    // reader's row is what moves them away from the start edge in the first place.
    // `pendingReanchor` covers the same window under `dynamicSize`; it is a plain
    // binding rather than state, so it does not re-trigger this effect on its own,
    // but the scroll write that consumes it updates `scrollOffset`, which does.
    if (hasQueuedCorrection || pendingReanchor !== null) return;

    // `startIndex`/`endIndex` describe the RENDERED range, which already carries
    // overscan on both sides, and `endIndex` is exclusive. Undo both so the
    // "within overscan items of the end" test is applied once rather than twice.
    // `resolvedOverscan`, not the raw prop: the window was built with the clamped,
    // floored value, so undoing it with a negative, fractional, or non-finite prop
    // would drift from the real window — or resolve to NaN, which compares false
    // against everything and silently reports both edges as out of range.
    const lastRenderedIndex = Math.max(0, itemCount - 1);
    const firstVisibleIndex = Math.min(
      currentWindow.startIndex + resolvedOverscan,
      lastRenderedIndex,
    );
    const lastVisibleIndex = Math.max(
      0,
      Math.min(currentWindow.endIndex - 1 - resolvedOverscan, lastRenderedIndex),
    );

    const proximity = resolveEdgeProximity({
      scrollOffset,
      viewportSize: currentViewportHeight,
      totalSize: currentWindow.totalSize,
      firstVisibleIndex,
      lastVisibleIndex,
      itemCount,
      overscan: resolvedOverscan,
    });
    // Masked per edge, not just when BOTH callbacks are gone. An edge without a
    // callback has nothing to fire, and reporting it as near would leave its own
    // latch set — so re-enabling that one callback at the same position and item
    // count would find it already latched and stay silent.
    const isReachable = !windowScroll || !isWindowListOffscreen;
    const maskedProximity = {
      isNearStart: onStartReached && isReachable ? proximity.isNearStart : false,
      isNearEnd: onEndReached && isReachable ? proximity.isNearEnd : false,
    };
    const decision = resolveEdgeFireDecision({
      proximity: maskedProximity,
      previous: edgeLatch,
      itemCount,
    });
    edgeLatch = decision.next;

    // Untracked: a consumer that appends inside the callback would otherwise write
    // `items` while this effect is still reading it, and Svelte would treat that as
    // this effect depending on its own output.
    untrack(() => {
      if (decision.fireStart) onStartReached?.();
      if (decision.fireEnd) onEndReached?.();
    });
  });

  const observeResize = useResizeObserver(() => {
    if (scrollElement) syncViewport(scrollElement);
  });

  /**
   * Under `windowScroll` the scroll events the component needs are on the document,
   * not on any element it renders — so it subscribes to them, and to resize, since
   * the viewport extent is now the window's.
   *
   * `passive: true` because the handler only measures; declaring so lets the
   * browser scroll without waiting to learn whether the event will be cancelled.
   */
  $effect(() => {
    if (!windowScroll) return;
    const element = scrollElement;
    if (!element || typeof window === 'undefined') return;

    const handleWindowGeometryChange = (event?: Event) => {
      if (isDestroyed) return;
      syncViewport(element);
      // Forwarded, because in this mode the document is the scroller and the
      // element's own `onscroll` never fires — a consumer's handler would otherwise
      // be silently dead. Its `currentTarget` is the window here rather than the
      // list, which the prop documents.
      if (event?.type === 'scroll' && typeof onScroll === 'function') {
        onScroll(event as UIEvent);
      }
    };

    // The takeover handlers live on the element, which the reader never touches in
    // this mode — so a smooth `scrollToIndex` driving the document would keep
    // fighting them for the viewport. Mirror them onto the window.
    const handleWindowTakeover = () => retireSettleLoop();
    const handleWindowKeyTakeover = (event: KeyboardEvent) => {
      if (SCROLLING_KEYS.has(event.key)) retireSettleLoop();
    };

    window.addEventListener('scroll', handleWindowGeometryChange, { passive: true });
    window.addEventListener('resize', handleWindowGeometryChange, { passive: true });
    window.addEventListener('wheel', handleWindowTakeover, { passive: true });
    window.addEventListener('pointerdown', handleWindowTakeover, { passive: true });
    window.addEventListener('touchstart', handleWindowTakeover, { passive: true });
    window.addEventListener('keydown', handleWindowKeyTakeover, { passive: true });
    handleWindowGeometryChange();

    return () => {
      window.removeEventListener('scroll', handleWindowGeometryChange);
      window.removeEventListener('resize', handleWindowGeometryChange);
      window.removeEventListener('wheel', handleWindowTakeover);
      window.removeEventListener('pointerdown', handleWindowTakeover);
      window.removeEventListener('touchstart', handleWindowTakeover);
      window.removeEventListener('keydown', handleWindowKeyTakeover);
    };
  });

  /**
   * The storage scroll restoration writes to, or `undefined` when it should not
   * write at all.
   *
   * Resolved through a guarded read: some privacy modes throw on merely ACCESSING
   * `sessionStorage`, not just on writing to it, so the property access itself has
   * to be inside the try.
   */
  function resolveRestorationStorage(): ScrollRestorationStorage | undefined {
    if (!scrollRestoration) return undefined;
    try {
      return typeof sessionStorage === 'undefined' ? undefined : sessionStorage;
    } catch {
      return undefined;
    }
  }

  /**
   * Restores a remembered position on mount, and remembers the current one on
   * teardown.
   *
   * Deliberately keyed on nothing reactive but the id: re-running this on an
   * unrelated state change would re-apply a stale saved offset over wherever the
   * reader had since scrolled to.
   */
  $effect(() => {
    const id = scrollRestorationId?.trim();
    const element = scrollElement;
    // Tracked deliberately: a list that fetches its own data renders empty first, so
    // there is nothing to restore onto until its items arrive. `hasRestored` is what
    // makes this happen exactly once — without it, re-running on every item change
    // would re-apply the saved position over wherever the reader had scrolled to.
    const itemCount = items.length;
    // Not under `windowScroll`. The saved offset is measured from the list's start
    // edge and clamps at 0, so it cannot represent a reader who left while still
    // ABOVE the list — restoring would scroll them down to it, somewhere they never
    // were. The browser's own document scroll restoration already handles this mode,
    // and handles the whole page rather than one list within it.
    if (windowScroll || !element || !id || restoredId === id || itemCount === 0) return;

    untrack(() => {
      const storage = resolveRestorationStorage();
      const saved = loadScrollPosition(storage, id);
      if (!saved) {
        restoredId = id;
        return;
      }
      restoredId = id;

      if (saved.startIndex >= items.length) {
        // The collection genuinely shrank, so the remembered row no longer exists.
        // Restoring to a clamped index would drop the reader somewhere arbitrary and
        // then re-save that as if it were their place.
        clearScrollPosition(storage, id);
        return;
      }

      // By KEY first. An index stops describing the same row once the collection
      // changes while unmounted, which is exactly what a feed does.
      const anchorIndex = resolveIndexForSavedAnchor(saved);

      if (dynamicSize) {
        // Written directly rather than through `scrollToIndex`, which lands on the
        // row's start edge and would lose where the reader was WITHIN a tall row —
        // the difference between reopening mid-paragraph and at the top of it.
        //
        // The offsets table is all estimates at mount, so this lands on the ESTIMATED
        // position of the right row. That is the correct starting point: the
        // measurement-correction pass then holds this row still as the rows above it
        // are measured, which is precisely the job it already does.
        //
        // The remainder is clamped to the row's CURRENT size. While that size is
        // still an estimate a larger saved remainder would overshoot into the next
        // row, and the correction pass would then hold the wrong row still.
        const rowStart = locateRowStartOffset(anchorIndex);
        const rowSize = Math.max(
          0,
          locateRowStartOffset(anchorIndex + 1) - rowStart || resolvedItemHeight,
        );
        const withinRow = Math.min(Math.max(0, saved.offsetWithinRow ?? 0), rowSize);
        writeScrollOffset(element, rowStart + withinRow, 'auto');
        scrollOffset = readScrollOffset(element);
      } else {
        // From the row anchor, not the raw saved pixel offset. `itemHeight` can differ
        // between visits — a density setting, a responsive breakpoint — and the old
        // offset then points at a different row entirely.
        const withinRow = Math.min(Math.max(0, saved.offsetWithinRow ?? 0), resolvedItemHeight);
        writeScrollOffset(element, anchorIndex * resolvedItemHeight + withinRow, 'auto');
        scrollOffset = readScrollOffset(element);
      }
    });
  });

  /**
   * Saves the position on teardown.
   *
   * Separate from the restore effect, and depending on nothing but the id. An
   * `$effect` cleanup runs on INVALIDATION as well as teardown, so folding this into
   * an effect that tracks the item count meant every append ran the saver and then
   * re-ran the effect — which, already having restored, returned early and registered
   * no new cleanup. After the first append the teardown save was simply gone.
   */
  $effect(() => {
    const id = scrollRestorationId?.trim();
    if (windowScroll || !id) return;

    return () => {
      const storage = resolveRestorationStorage();
      if (!storage) return;
      untrack(() => {
        // Nothing to remember about an empty list, and writing one would overwrite a
        // real position with a placeholder if the component tears down mid-load.
        if (items.length === 0) return;
        // The snapshot, not a fresh read. When a parent swaps BOTH the id and the
        // items at once, this cleanup runs after that state has already changed —
        // computing here would file the incoming collection's position under the
        // outgoing collection's key.
        const snapshot = latestPosition;
        if (!snapshot) return;
        saveScrollPosition(storage, id, snapshot);
      });
    };
  });

  /** Keeps the position saveable at any moment, independent of what changed. */
  $effect(() => {
    const anchorIndex = resolveAnchorIndexAtOffset(scrollOffset);
    latestPosition = {
      scrollOffset,
      // Derived from the live offset, not from the rendered window. The window's
      // first index carries overscan, and adding it back does not recover the
      // anchor either: near the top the leading overscan is clipped against 0,
      // so `startIndex + overscan` points several rows PAST the reader instead
      // of at them. The offset knows where they actually are.
      startIndex: anchorIndex,
      offsetWithinRow: Math.max(0, scrollOffset - locateRowStartOffset(anchorIndex)),
      ...(items.length > 0 ? { anchorKey: keyAt(anchorIndex) } : {}),
    };
  });

  $effect.pre(() => {
    const itemCount = items.length;
    const element = scrollElement;

    // Captured under whichever mode is active RIGHT NOW, so the next run can
    // evaluate the old scroll position against the geometry it was actually
    // scrolled within — even if the mode changes in between.
    const currentTotal = dynamicSize ? (offsets?.totalSize ?? 0) : itemCount * resolvedItemHeight;

    // Only when `items` itself changed. This effect also depends on `offsets`, which
    // is rebuilt on every row measurement under `dynamicSize` — walking the keys
    // there would turn each measurement into an O(n) pass over the whole list, and
    // the growth it would report is always "unchanged" anyway.
    //
    // `Array.from` over the length rather than `items.map`, which skips sparse holes
    // and would leave the key sequence shorter than the list. Through `keyAt`, not a
    // local getKey call: the measurement cache is keyed by exactly what `keyAt`
    // returns, and a second derivation that disagreed on any item would report
    // growth where there is none.
    // Length as well as identity: a consumer that pushes into the same array keeps
    // its reference, and treating that as unchanged would miss the growth entirely.
    const itemsChanged = items !== previousItems || items.length !== previousKeys.length;
    const nextKeys = itemsChanged
      ? Array.from({ length: items.length }, (_unused, index) => keyAt(index))
      : previousKeys;
    previousItems = items;

    if (!hasObservedItemCount) {
      previousTotalSize = currentTotal;
      previousKeys = nextKeys;
      hasObservedItemCount = true;
      shouldStickAfterAppend = false;
      // A reverse list opens at its end. Deferred to the mount effect rather than
      // written here: there is no element yet on the first server-or-client pass,
      // and under `dynamicSize` the total is still only an estimate.
      // Not under `windowScroll`: there is no scroll position of the component's own
      // to pin, and the mount effect would scroll the whole page to the list's end.
      needsInitialReversePin = reverse && !windowScroll;
      return;
    }

    // Skipped outright when the array did not change. `classifyItemGrowth` opens with
    // an O(n) equality walk, so running it on every measurement-driven pass would
    // reintroduce the per-measurement cost this guard exists to remove — to reach
    // the answer this branch already knows.
    const growth: ItemGrowth = itemsChanged
      ? classifyItemGrowth(previousKeys, nextKeys)
      : { kind: 'unchanged' };

    shouldStickAfterAppend =
      element !== undefined &&
      shouldPinToEnd({
        mode: reverse ? 'reverse' : stickToBottom ? 'stick-to-bottom' : 'none',
        growth,
        // Against the PREVIOUS run's total, not a total re-derived under the mode
        // that happens to be active now. Re-deriving reads the dynamic total as 0
        // for as long as fixed mode was active, which yanks a scrolled-up reader to
        // the end; and skipping the check whenever the mode changed — the obvious
        // guard against that — instead drops the pin for a reader who genuinely was
        // at the bottom. Carrying the real previous total is correct in both
        // directions and needs no mode special-case at all.
        isAtEnd: isAtBottom(element, previousTotalSize, viewportHeight),
      });

    // A prepend inserts content ABOVE the reader. Every existing row shifts down by
    // the height of what arrived, so holding `scrollOffset` still would silently
    // move them to a different row — and with native scroll anchoring disabled
    // under `dynamicSize`, nothing puts them back. Anchoring to the row they were
    // actually on is the only thing that reads as "the list grew upward".
    if (growth.kind === 'prepended' && element) {
      const table = offsets?.offsets;
      const liveScrollOffset = readScrollOffset(element);
      if (table) {
        const anchorIndex = findOffsetIndex(table, liveScrollOffset);
        pendingReanchor = {
          // The same row now sits `prependedCount` further along the list.
          index: anchorIndex + growth.prependedCount,
          offsetWithinRow: liveScrollOffset - (table[anchorIndex] ?? 0),
        };
      } else {
        // Fixed-height mode has no offsets table, but every row is the same size,
        // so the shift is exactly arithmetic.
        pendingScrollTarget = Math.max(
          0,
          liveScrollOffset + growth.prependedCount * resolvedItemHeight,
        );
      }
    }

    previousTotalSize = currentTotal;
    previousKeys = nextKeys;
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
    if (!stickToBottom && !reverse) isPinnedToBottom = false;
  });

  $effect(() => {
    const itemCount = items.length;
    const element = scrollElement;
    // `windowScroll` genuinely disables these rather than merely documenting them as
    // disabled: both pin a scroll position, and the component does not own one here.
    if (windowScroll || (!stickToBottom && !reverse) || !shouldStickAfterAppend || !element) return;

    void tick().then(() => {
      // Re-read the prop: it can be disabled between the append and this callback,
      // and the disabled-mode effect will already have cleared the pin. Arming it
      // again here would leave a stale flag that no later scroll clears, so
      // re-enabling the option would jump to the end with no append behind it.
      if (!stickToBottom && !reverse) {
        shouldStickAfterAppend = false;
        return;
      }
      // Measure first. An update that appends AND shrinks `height` in one go would
      // otherwise compute the bottom from the pre-patch viewport and land short —
      // and in fixed mode there is no re-pin effect afterwards to rescue it.
      const currentViewportHeight = syncViewport(element);
      writeScrollOffset(
        element,
        maxScrollOffset(
          dynamicSize ? (offsets?.totalSize ?? 0) : itemCount * resolvedItemHeight,
          currentViewportHeight,
        ),
        'auto',
      );
      scrollOffset = readScrollOffset(element);
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
    // `reverse` routes through the same `isPinnedToBottom` flag rather than
    // bypassing it. Scrolling up clears the flag, so a measurement that grows the
    // total does NOT drag a reader out of history; an append then re-arms it, and
    // the row appended under `dynamicSize` measures after the pin write — which is
    // exactly the window this effect covers.
    if (windowScroll || (!stickToBottom && !reverse) || !dynamicSize || !isPinnedToBottom) return;
    const element = scrollElement;
    if (!element) return;
    const target = maxScrollOffset(totalSize, currentViewportHeight);
    if (Math.abs(readScrollOffset(element) - target) <= 1) return;
    writeScrollOffset(element, target, 'auto');
    scrollOffset = readScrollOffset(element);
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
    const currentEstimate = resolvedItemHeight;
    const element = scrollElement;

    const estimateChanged = previousEstimate > 0 && currentEstimate !== previousEstimate;
    previousEstimate = currentEstimate;

    if (!element || !currentOffsets) {
      previousOffsets = currentOffsets;
      return;
    }

    // Live, not the `scrollOffset` state: during a smooth scroll, after an external
    // write, or before a throttled scroll event lands, the state trails the real
    // position, and every calculation below is relative to where the reader is NOW.
    const liveScrollOffset = readScrollOffset(element);

    // Every wholesale rebuild of the offsets table funnels through one re-anchor.
    // There are three triggers — a width-driven cache reset, an `itemHeight` change,
    // and (historically) each new one someone adds — and each moves the reader
    // unless the row they are on is restored, because this mode turns off the
    // browser's native scroll anchoring in order to own that itself. Handling them
    // as separate branches is what let the third one overwrite the others.
    let anchor = pendingReanchor;
    pendingReanchor = null;
    if (anchor === null && estimateChanged && previousOffsets) {
      // A reset captured its anchor before discarding the cache; an estimate change
      // can still read the pre-change table here.
      const index = findOffsetIndex(previousOffsets, liveScrollOffset);
      anchor = { index, offsetWithinRow: liveScrollOffset - (previousOffsets[index] ?? 0) };
    }

    let target: number | null = null;
    if (anchor !== null) {
      const anchorStart = currentOffsets[anchor.index] ?? 0;
      // Clamp to the row as it exists in the REBUILT table. The reader may have been
      // deep inside a measured row that the rebuild replaced with a small estimate;
      // carrying the raw offset across would land many rows past the anchor, and the
      // anchor row would then unmount and never be remeasured to correct it.
      const anchorSize = Math.max(
        0,
        (currentOffsets[anchor.index + 1] ?? anchorStart) - anchorStart,
      );
      const offsetWithinRow = Math.min(Math.max(0, anchor.offsetWithinRow), anchorSize);
      target = Math.max(0, anchorStart + offsetWithinRow);
    }

    // Measurement corrections apply ONLY when no re-anchor ran. A re-anchor is
    // computed from the rebuilt table, which already contains this flush's
    // measurements, so adding the delta on top would count them twice and overshoot
    // by exactly the measured difference. Previously the correction simply
    // overwrote the re-anchored target, which lost the estimate adjustment instead —
    // both are wrong, and which one wins is not a matter of ordering.
    if (target === null && corrections.length > 0 && previousOffsets) {
      const anchorIndex = findOffsetIndex(previousOffsets, liveScrollOffset);
      const delta = resolveMeasurementCorrectionDelta(corrections, anchorIndex);
      if (delta !== 0) target = liveScrollOffset + delta;
    }

    if (target !== null) pendingScrollTarget = Math.max(0, target);
    previousOffsets = currentOffsets;
  });

  /**
   * The index a saved anchor refers to NOW.
   *
   * The key wins when the list has one and it is still present: the collection may
   * have grown at the front while the list was unmounted, which moves every index
   * without moving any row. Falls back to the saved index, clamped.
   */
  function resolveIndexForSavedAnchor(saved: {
    startIndex: number;
    anchorKey?: string | number;
  }): number {
    const lastIndex = Math.max(0, items.length - 1);
    if (saved.anchorKey !== undefined) {
      for (let index = 0; index < items.length; index += 1) {
        if (keyAt(index) === saved.anchorKey) return index;
      }
    }
    return Math.min(Math.max(0, saved.startIndex), lastIndex);
  }

  /** Where a row begins, from the measured table when there is one. */
  function locateRowStartOffset(index: number): number {
    const table = offsets?.offsets;
    if (table) return table[index] ?? 0;
    return index * resolvedItemHeight;
  }

  /**
   * The index of the row occupying a given scroll offset — the row the reader is
   * looking at, independent of overscan and of any clamping at the list's edges.
   */
  function resolveAnchorIndexAtOffset(offset: number): number {
    const lastIndex = Math.max(0, items.length - 1);
    const table = offsets?.offsets;
    if (table) return Math.min(findOffsetIndex(table, Math.max(0, offset)), lastIndex);
    return Math.min(Math.floor(Math.max(0, offset) / Math.max(1, resolvedItemHeight)), lastIndex);
  }

  $effect(() => {
    if (pendingScrollTarget === null) return;
    const element = scrollElement;
    const target = pendingScrollTarget;
    pendingScrollTarget = null;
    if (!element) return;
    // The bottom pin wins. A batch containing resizes both above and below the
    // anchor makes the two mechanisms disagree: the pin moves to the new total
    // using every delta, while this correction accounts only for the ones before
    // the anchor. Writing it afterwards would land short of the bottom and the
    // resulting scroll event could disarm the pin entirely.
    if (isPinnedToBottom) return;
    // Never animated: a smooth correction would visibly show the jump it exists to hide.
    writeScrollOffset(element, Math.max(0, target), 'auto');
    scrollOffset = readScrollOffset(element);
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

  /**
   * Reads the scroll offset along whichever axis is active, as a distance from the
   * start edge that always grows away from it.
   *
   * Under `horizontal` + RTL that is not simply `scrollLeft`: browsers disagree on
   * its sign and origin, so the raw value is normalized through the convention this
   * browser was measured to use. See `resolveRtlScrollType`.
   */
  function readScrollOffset(element: HTMLElement): number {
    // With no scroll container of its own, the offset is not on the element at
    // all — it is how far the list's box has travelled past the viewport's start
    // edge, which `syncViewport` has already resolved.
    if (windowScroll) return windowScrollOffset;
    if (!horizontal) return Math.max(0, element.scrollTop);
    // Normalization is the identity under ltr, and resolving the convention costs a
    // layout-forcing probe. Short-circuit so a left-to-right page never pays for an
    // answer it would discard.
    if (writingDirection === 'ltr') return Math.max(0, element.scrollLeft);
    return Math.max(
      0,
      normalizeInlineScrollOffset(
        element.scrollLeft,
        element.scrollWidth,
        element.clientWidth,
        writingDirection,
        resolveRtlScrollType(),
      ),
    );
  }

  /**
   * Distance from the viewport's start edge to the list's start edge, along the axis
   * in play. Negative once the list's beginning has scrolled past.
   *
   * The INLINE-START edge under `horizontal`, which is the right one in a
   * right-to-left document — measuring `rect.left` there would report the list's end
   * as its beginning and run the offset backwards. Shared by the read and write
   * paths so the two cannot disagree about where the list begins.
   */
  function resolveListStartInViewport(element: HTMLElement, rect?: DOMRect): number {
    const box = rect ?? element.getBoundingClientRect();
    if (!horizontal) return box.top;
    if (writingDirection !== 'rtl') return box.left;
    const viewportWidth = resolveWindowViewportSize(
      typeof window === 'undefined' ? undefined : window,
      'horizontal',
    );
    return viewportWidth - box.right;
  }

  /**
   * Moves the DOCUMENT so that `offset` pixels of the list sit above the viewport's
   * start edge.
   *
   * Under `windowScroll` the element has no scroll position of its own, so every
   * write has to be translated into a page scroll: the list's current distance from
   * the viewport start plus the current page offset gives where the list begins in
   * document space, and the target is that plus the requested offset.
   *
   * Without this the whole write side of the component — `scrollToIndex`, prepend
   * re-anchoring, measurement corrections, restoration — silently did nothing in
   * this mode, because it was writing to an element that does not scroll.
   */
  function writeWindowScrollOffset(
    element: HTMLElement,
    offset: number,
    behavior: ScrollBehavior,
  ): void {
    if (typeof window === 'undefined') return;
    // Moved as a RELATIVE delta rather than to an absolute coordinate. The read path
    // is normalized — it measures from the inline-START edge, which is the right one
    // under RTL — so an absolute physical target would have to re-derive the page's
    // own RTL scroll convention to match it. The distance between where the reader
    // is and where they should be needs no such conversion; only its sign flips, and
    // only along a right-to-left inline axis.
    // Against the RAW list position, not `readScrollOffset`, which clamps at 0. A
    // window-scrolled list normally begins below the viewport — under a page header —
    // and while it does, the clamped offset reads 0 for every position above it. The
    // delta would then be 0 and the page would never move to the list at all.
    const delta = offset + resolveListStartInViewport(element);
    if (delta === 0) return;
    const inlineDelta = horizontal && writingDirection === 'rtl' ? -delta : delta;
    window.scrollBy(
      horizontal ? { left: inlineDelta, top: 0, behavior } : { top: delta, left: 0, behavior },
    );
  }

  /** Writes a start-edge-relative offset back along the active axis. */
  function writeScrollOffset(element: HTMLElement, offset: number, behavior: ScrollBehavior): void {
    if (windowScroll) {
      writeWindowScrollOffset(element, offset, behavior);
      return;
    }
    if (!horizontal) {
      if (behavior === 'smooth' && typeof element.scrollTo === 'function') {
        element.scrollTo({ top: offset, behavior: 'smooth' });
      } else {
        element.scrollTop = offset;
      }
      return;
    }

    // Convert back out of the normalized space into whatever this browser expects.
    // `normalizeInlineScrollOffset` is its own inverse for every convention here:
    // 'default' is identity, 'negative' negates, and 'reverse' subtracts from the
    // maximum — each of which undoes itself when applied twice.
    const raw =
      writingDirection === 'ltr'
        ? offset
        : normalizeInlineScrollOffset(
            offset,
            element.scrollWidth,
            element.clientWidth,
            writingDirection,
            resolveRtlScrollType(),
          );
    if (behavior === 'smooth' && typeof element.scrollTo === 'function') {
      element.scrollTo({ left: raw, behavior: 'smooth' });
    } else {
      element.scrollLeft = raw;
    }
  }

  /**
   * Measures, once per document, which RTL `scrollLeft` convention this browser
   * implements.
   *
   * Detected rather than assumed. The three conventions are only distinguishable by
   * behaviour, and choosing one by name is how the sign silently inverts —
   * `'default'` reads as the safe choice and is in fact the legacy Edge/IE
   * behaviour, while current browsers use `'negative'`.
   */
  function resolveRtlScrollType(): RtlScrollType {
    if (detectedRtlScrollType !== null) return detectedRtlScrollType;
    if (typeof document === 'undefined') return 'negative';

    const probe = document.createElement('div');
    probe.setAttribute('dir', 'rtl');
    probe.style.position = 'absolute';
    probe.style.insetBlockStart = '-9999px';
    probe.style.inlineSize = '1px';
    probe.style.blockSize = '1px';
    probe.style.overflow = 'scroll';
    const content = document.createElement('div');
    content.style.inlineSize = '2px';
    content.style.blockSize = '1px';
    probe.append(content);
    document.body.append(probe);

    const startScrollLeft = probe.scrollLeft;
    probe.scrollLeft = -1;
    const afterNegativeWrite = probe.scrollLeft;
    probe.remove();

    detectedRtlScrollType = classifyRtlScrollType(startScrollLeft, afterNegativeWrite);
    return detectedRtlScrollType;
  }

  /**
   * Re-reads the container's size and scroll position, and returns the size it
   * measured so a caller acting in the same turn can use the fresh value rather
   * than the `viewportHeight` derived, which still holds the pre-patch number.
   */
  function syncViewport(element: HTMLElement): number {
    const rect = element.getBoundingClientRect();

    if (windowScroll) {
      const viewportSize = resolveWindowViewportSize(
        typeof window === 'undefined' ? undefined : window,
        horizontal ? 'horizontal' : 'vertical',
      );
      const geometry = resolveWindowScrollGeometry({
        listStartInViewport: resolveListStartInViewport(element, rect),
        viewportSize,
        totalSize: currentTotalSize(),
      });
      windowScrollOffset = geometry.scrollOffset;
      // Fall back to the full viewport while the overlap is zero: the list is off
      // screen entirely, and windowing against 0 would mount nothing, so scrolling
      // it back into view would find an empty list. Tracked separately so the edge
      // callbacks can tell "nothing visible" from "a viewport's worth visible" —
      // a list nobody can see has not had either of its edges reached.
      isWindowListOffscreen = geometry.visibleSize <= 0;
      windowVisibleSize = geometry.visibleSize || viewportSize;
      measuredViewportHeight = windowVisibleSize;
      scrollOffset = geometry.scrollOffset;
      // Still invalidate on a cross-axis change. Returning early skipped it, so a
      // window-scrolled `dynamicSize` list kept every row size measured at the old
      // width after a resize re-wrapped them all.
      invalidateOnCrossAxisChange(element, rect);
      return windowVisibleSize;
    }

    // The MAIN axis — the one being scrolled and windowed. Under `horizontal` that
    // is the inline extent: the container's block-size is `auto` and collapses to
    // one row's height, which would badly under-report the viewport and render too
    // few columns. The `height` prop is reinterpreted as the inline size in that
    // mode, so the fallback stays correct without a branch.
    const measured =
      (horizontal ? rect.width || element.clientWidth : rect.height || element.clientHeight) ||
      parsePixelLength(height) ||
      resolvedItemHeight * 10;

    // A CROSS-axis change re-wraps every row, so every cached main-axis size taken
    // at the old cross extent is now wrong. Offscreen rows would keep those stale
    // sizes until they happened to remount, leaving the spacer and every scroll
    // target off by the accumulated difference. Dropping the cache forces
    // re-measurement.
    // The client extent first: it is what is actually available to rows, excluding
    // the scrollbar. A measurement that makes the list start or stop overflowing
    // adds or removes a non-overlay scrollbar and re-wraps every row while the
    // border-box extent never changes — so comparing the rect would miss it
    // entirely and leave offscreen rows holding sizes measured at the other extent.
    invalidateOnCrossAxisChange(element, rect);

    measuredViewportHeight = measured;
    scrollOffset = readScrollOffset(element);
    return measured;
  }

  /**
   * Drops cached row sizes when the CROSS axis changed, because that re-wraps every
   * row and every size measured at the old extent is now wrong.
   */
  function invalidateOnCrossAxisChange(element: HTMLElement, rect: DOMRect): void {
    // The client extent first: it is what is actually available to rows, excluding
    // the scrollbar. A measurement that makes the list start or stop overflowing
    // adds or removes a non-overlay scrollbar and re-wraps every row while the
    // border-box extent never changes — so comparing the rect would miss it
    // entirely and leave offscreen rows holding sizes measured at the other extent.
    const measuredCrossExtent = horizontal
      ? element.clientHeight || rect.height || 0
      : element.clientWidth || rect.width || 0;
    if (
      dynamicSize &&
      measuredCrossExtent > 0 &&
      previousCrossExtent > 0 &&
      measuredCrossExtent !== previousCrossExtent
    ) {
      // Capture where the reader is BEFORE discarding the cache. The reset rebuilds
      // every row from the estimate and drops `previousOffsets`, so the correction
      // effect would have no old geometry to anchor against — and with native
      // anchoring disabled, an unchanged scrollTop then resolves to a different row
      // and stays there until the rows above happen to be measured again, which for
      // offscreen rows may be never.
      const table = offsets?.offsets;
      if (table) {
        const liveScrollOffset = readScrollOffset(element);
        const anchorIndex = findOffsetIndex(table, liveScrollOffset);
        pendingReanchor = {
          index: anchorIndex,
          offsetWithinRow: liveScrollOffset - (table[anchorIndex] ?? 0),
        };
      }
      measurementStore.reset();
      previousOffsets = undefined;
    }
    if (measuredCrossExtent > 0) previousCrossExtent = measuredCrossExtent;
  }

  function handleScroll(event: UIEvent & { currentTarget: EventTarget & HTMLDivElement }): void {
    if (typeof onScroll === 'function') onScroll(event);
    const element = event.currentTarget as HTMLElement;
    scrollOffset = readScrollOffset(element);
    // Scrolling away from the bottom releases the pin; scrolling back re-arms it.
    if (stickToBottom || reverse) {
      isPinnedToBottom = isAtBottom(element, currentTotalSize(), viewportHeight);
    }
  }

  /**
   * Abandons any in-flight `scrollToIndex` settle loop, because the user has taken
   * over the viewport.
   *
   * Keyed on INPUT events rather than on scroll offsets. Inferring takeover by
   * comparing the offset against the last programmatic target cannot work: a smooth
   * scroll emits intermediate events whose offsets differ from the final one by
   * construction, so the first animation step reads as interruption and cancels the
   * settle pass that smooth scrolling most needs. A wheel, pointer, touch, or key
   * event is unambiguous — nothing but the user produces one.
   */
  function retireSettleLoop(): void {
    scrollToIndexGeneration += 1;
  }

  function handleWheel(event: WheelEvent & { currentTarget: EventTarget & HTMLDivElement }): void {
    retireSettleLoop();
    if (typeof onWheel === 'function') onWheel(event);
  }

  function handlePointerDown(
    event: PointerEvent & { currentTarget: EventTarget & HTMLDivElement },
  ): void {
    retireSettleLoop();
    if (typeof onPointerDown === 'function') onPointerDown(event);
  }

  function handleTouchStart(
    event: TouchEvent & { currentTarget: EventTarget & HTMLDivElement },
  ): void {
    retireSettleLoop();
    if (typeof onTouchStart === 'function') onTouchStart(event);
  }

  function handleKeyDown(
    event: KeyboardEvent & { currentTarget: EventTarget & HTMLDivElement },
  ): void {
    if (SCROLLING_KEYS.has(event.key)) retireSettleLoop();
    if (typeof onKeyDown === 'function') onKeyDown(event);
  }

  function maxScrollOffset(totalSize: number, height: number): number {
    return Math.max(0, totalSize - height);
  }

  function isAtBottom(element: HTMLElement, totalSize: number, height: number): boolean {
    // Start-edge-relative, so this reads "at the far end of the scroll axis"
    // regardless of orientation or writing direction.
    return readScrollOffset(element) >= maxScrollOffset(totalSize, height) - 1;
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
      const mainAxisSize = resolveObservedMainAxisSize(
        entry.borderBoxSize?.[0],
        entry.contentRect,
        horizontal ? 'horizontal' : 'vertical',
      );
      // Zero is a legitimate measurement — a row can collapse to nothing. Discarding
      // it would leave the offsets table reserving space the row no longer occupies,
      // shifting every later offset and scroll target until it grew again.
      if (!Number.isFinite(mainAxisSize) || mainAxisSize < 0) continue;
      measurementStore.record(keyAt(index), index, mainAxisSize, resolvedItemHeight);
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
      if (typeof globalThis.requestAnimationFrame !== 'function') {
        resolve();
        return;
      }
      // Called through globalThis so the Window receiver is preserved. Copying the
      // method into a local and invoking it bare throws "Illegal invocation" in
      // browsers that enforce the Web API receiver — which would reject this
      // promise on every dynamic scrollToIndex and silently skip every settle pass.
      globalThis.requestAnimationFrame(() => {
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
      // Axis-aware: reading scrollTop on a horizontal list sees a value that never
      // moves, so the loop would report "settled" after two frames and skip the
      // settle pass entirely.
      const currentOffset = readScrollOffset(element);
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
        currentScrollOffset: readScrollOffset(element),
        align,
      });

      writeScrollOffset(element, target, behavior);
      scrollOffset = readScrollOffset(element);

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
        currentScrollOffset: readScrollOffset(element),
        align,
      });
      // Compared against the element, not the state, for the same reason the target
      // is computed from it: the state lags a smooth or externally-driven scroll,
      // which both wastes retries and can stop retrying while still in flight.
      const settledScrollOffset = readScrollOffset(element);
      if (Math.abs(settled - settledScrollOffset) <= SCROLL_TO_INDEX_SETTLED_EPSILON) return;
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
  data-cinder-orientation={horizontal ? 'horizontal' : undefined}
  data-cinder-scroll-source={windowScroll ? 'window' : undefined}
  style:--cinder-virtual-list-height={height}
  onscroll={handleScroll}
  onwheel={handleWheel}
  onpointerdown={handlePointerDown}
  ontouchstart={handleTouchStart}
  onkeydown={handleKeyDown}
>
  <div
    class="cinder-virtual-list__spacer"
    style={`${rowLayout.sizeProperty}:${virtualWindow.totalSize}px;`}
    aria-hidden={items.length === 0 ? 'true' : undefined}
  >
    <div
      class="cinder-virtual-list__window"
      style={`${rowLayout.offsetProperty}:${virtualWindow.leadingSize}px;`}
    >
      {#each renderedItems as virtualItem (virtualItem.key)}
        <div
          class="cinder-virtual-list__row"
          role={role === 'list' ? 'listitem' : undefined}
          data-cinder-virtual-index={virtualItem.index}
          style={dynamicSize ? undefined : `${rowLayout.sizeProperty}:${virtualItem.size}px;`}
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
