/**
 * Pure measurement/window engine for `dynamicSize` virtual-list mode.
 *
 * Everything in this module is dependency-free arithmetic: no DOM, no runes,
 * no `ResizeObserver`. It is deliberately held to a 100%-lines/100%-functions
 * coverage floor (see `coverage-ratchet.json`) because none of it needs a
 * live browser to exercise every branch.
 */

import type {
  FixedVirtualWindow,
  FixedVirtualWindowItem,
  VirtualListKey,
} from '../../../utilities/fixed-virtual-window.ts';
import { resolveVirtualOverscan } from '../../../utilities/fixed-virtual-window.ts';

/**
 * A cumulative offsets table for the dynamic-size engine, plus the total
 * pixel size it sums to.
 */
export type VirtualOffsets = {
  /** offsets[i] = cumulative size of slots [0, i). Length itemCount + 1; offsets[itemCount] = totalSize. */
  readonly offsets: readonly number[];
  readonly totalSize: number;
};

/**
 * Builds a fresh cumulative offsets table from the current item count and
 * measurement cache. Rebuilds in full every call — `O(itemCount)` — rather
 * than patching a dirty suffix, because a single measurement invalidates
 * every later offset regardless, so an incremental patch's worst case is no
 * better than a full rebuild. Callers are expected to memoize this behind a
 * derived value keyed on item count and the measurement cache's version.
 */
export function buildVirtualOffsets(options: {
  itemCount: number;
  estimateSize: number;
  getKey: (index: number) => VirtualListKey;
  measuredSizes: ReadonlyMap<VirtualListKey, number>;
}): VirtualOffsets {
  const count = Math.max(0, Math.floor(options.itemCount));
  const estimate = Math.max(1, options.estimateSize);
  const offsets = Array.from({ length: count + 1 }, () => 0);
  offsets[0] = 0;
  for (let index = 0; index < count; index += 1) {
    const size = options.measuredSizes.get(options.getKey(index)) ?? estimate;
    offsets[index + 1] = offsets[index]! + size;
  }
  return { offsets, totalSize: offsets[count] ?? 0 };
}

/**
 * Largest `i` such that `offsets[i] <= target`, found by binary search over
 * an offsets table assumed sorted ascending (true by construction for any
 * table `buildVirtualOffsets` produced). Returns 0 for an empty table.
 */
export function findOffsetIndex(offsets: readonly number[], target: number): number {
  const itemCount = Math.max(0, offsets.length - 1);
  if (itemCount === 0) return 0;
  let low = 0;
  let high = itemCount - 1;
  let result = 0;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (offsets[middle]! <= target) {
      result = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return result;
}

/**
 * Computes the windowed set of rows to mount for `dynamicSize` mode, given a
 * cumulative offsets table.
 *
 * This is deliberately NOT numerically identical to
 * `getFixedVirtualWindow` from `fixed-virtual-window.ts`. The fixed engine's
 * `endIndex = startIndex + visibleCount + overscan * 2` formula effectively
 * redistributes a start-side overscan budget "lost" to clamping at index 0
 * onto the end side — an artifact of that formula, not a general
 * virtualization requirement. This engine instead applies `overscan`
 * symmetrically (subtracted from the visible start, added to the visible
 * end, each independently clamped), which is simpler and independently
 * correct. Do not "fix" this function to match the fixed engine's boundary
 * behavior — the divergence is intentional and tested, not a regression.
 */
export function getDynamicVirtualWindow(options: {
  offsets: VirtualOffsets;
  getKey: (index: number) => VirtualListKey;
  scrollOffset: number;
  viewportSize: number;
  overscan: number;
}): FixedVirtualWindow {
  const count = options.offsets.offsets.length - 1;
  if (count <= 0) {
    return { items: [], totalSize: 0, leadingSize: 0, trailingSize: 0, startIndex: 0, endIndex: 0 };
  }

  const { offsets, totalSize } = options.offsets;
  const resolvedViewportSize =
    Number.isFinite(options.viewportSize) && options.viewportSize > 0
      ? options.viewportSize
      : (totalSize / count) * 10;
  const resolvedOverscan = resolveVirtualOverscan(options.overscan);
  const maxScrollOffset = Math.max(0, totalSize - resolvedViewportSize);
  const scrollOffset = Math.min(Math.max(0, options.scrollOffset), maxScrollOffset);

  const visibleStartIndex = findOffsetIndex(offsets, scrollOffset);
  const viewportEnd = scrollOffset + resolvedViewportSize;
  let visibleEndIndex = visibleStartIndex;
  while (visibleEndIndex < count - 1 && offsets[visibleEndIndex + 1]! < viewportEnd) {
    visibleEndIndex += 1;
  }

  // Zero-height rows share an offset with their neighbour, and findOffsetIndex
  // resolves a tie to the LAST such index — so a collapsed row sitting exactly at
  // the window's leading edge falls outside it. With overscan 0 that row unmounts,
  // loses its ResizeObserver, keeps its cached zero, and can never be remeasured
  // to expand again. Extending the start back over zero-size siblings keeps them
  // mounted and observable.
  let leadingIndex = Math.max(0, visibleStartIndex - resolvedOverscan);
  while (leadingIndex > 0 && offsets[leadingIndex] === offsets[leadingIndex - 1]) {
    leadingIndex -= 1;
  }
  const startIndex = leadingIndex;
  // +1: endIndex is exclusive.
  let trailingIndex = Math.min(count, visibleEndIndex + 1 + resolvedOverscan);
  // The mirror of the leading-edge walk below. A zero-height row sitting exactly at
  // the trailing boundary is otherwise excluded, and with overscan 0 it unmounts,
  // loses its ResizeObserver, and its cached zero keeps it out of every later
  // window — so nothing can ever expand it again.
  while (trailingIndex < count && offsets[trailingIndex] === offsets[trailingIndex + 1]) {
    trailingIndex += 1;
  }
  const endIndex = trailingIndex;

  const items: FixedVirtualWindowItem[] = [];
  for (let index = startIndex; index < endIndex; index += 1) {
    const start = offsets[index]!;
    items.push({ index, key: options.getKey(index), start, size: offsets[index + 1]! - start });
  }
  const firstItem = items[0];
  const lastItem = items.at(-1);

  return {
    items,
    totalSize,
    leadingSize: firstItem?.start ?? 0,
    trailingSize: lastItem ? Math.max(0, totalSize - (lastItem.start + lastItem.size)) : 0,
    startIndex,
    endIndex,
  };
}

/**
 * Reads a single item's pixel `start`/`size` without requiring the caller to
 * hand over an entire offsets table. `virtual-list.svelte` builds one
 * implementation backed by `itemHeight * index` for fixed mode (`O(1)`, no
 * offsets table needed) and one backed by the dynamic offsets table for
 * `dynamicSize` mode (also `O(1)` once the table exists).
 */
export type VirtualItemLocator = {
  readonly getStart: (index: number) => number;
  readonly getSize: (index: number) => number;
};

/** Alignment strategy for `scrollToIndex`. `'auto'` no-ops when the target is already fully within the viewport. */
export type VirtualListScrollAlign = 'start' | 'center' | 'end' | 'auto';

/**
 * Computes the scroll offset that satisfies `scrollToIndex(index, { align })`
 * for the given locator, clamped to `[0, totalSize - viewportSize]`.
 */
export function computeScrollToIndexOffset(options: {
  index: number;
  itemCount: number;
  locator: VirtualItemLocator;
  totalSize: number;
  viewportSize: number;
  currentScrollOffset: number;
  align: VirtualListScrollAlign;
}): number {
  // An empty list has no index to resolve, and clamping would hand the locator -1
  // rounded up to 0 — making this helper depend on every caller's locator tolerating
  // an out-of-range read rather than being safe on its own.
  if (options.itemCount <= 0) return 0;
  const clampedIndex = Math.max(0, Math.min(options.itemCount - 1, Math.floor(options.index)));
  const start = options.locator.getStart(clampedIndex);
  const size = options.locator.getSize(clampedIndex);
  const maxScrollOffset = Math.max(0, options.totalSize - options.viewportSize);

  let target: number;
  switch (options.align) {
    case 'start':
      target = start;
      break;
    case 'end':
      target = start + size - options.viewportSize;
      break;
    case 'center':
      target = start - (options.viewportSize - size) / 2;
      break;
    case 'auto':
    default: {
      const viewportStart = options.currentScrollOffset;
      const viewportEnd = viewportStart + options.viewportSize;
      const overflowsAbove = start < viewportStart;
      const overflowsBelow = start + size > viewportEnd;
      if (size > options.viewportSize) {
        // A row STRICTLY taller than the viewport can never satisfy both edge checks,
        // so edge-preference alternates forever: align its start and the end now
        // overflows, align its end and the start does. The loop would oscillate and
        // the final position would depend on the attempt cap.
        //
        // Keyed on the row's SIZE rather than on both overflow flags, because at the
        // exact boundary reached after scrolling to an initially offscreen row only
        // one flag is true and the earlier both-flags form fell through to edge
        // alignment again. Overlapping means the reader is already inside the row, so
        // hold; otherwise bring its start into view, after which holding takes over.
        // Strictly taller, not >=: a row exactly the viewport's height CAN be fully
        // revealed, so holding it half-visible would break auto's own contract.
        const overlapsViewport = start < viewportEnd && start + size > viewportStart;
        target = overlapsViewport ? options.currentScrollOffset : start;
      } else if (overflowsAbove) target = start;
      else if (overflowsBelow) target = start + size - options.viewportSize;
      else target = options.currentScrollOffset;
      break;
    }
  }
  return Math.min(Math.max(0, target), maxScrollOffset);
}

/** One queued measurement correction: the item at `index` changed size by `delta` pixels. */
export type MeasurementCorrection = { readonly index: number; readonly delta: number };

/**
 * Sums the size deltas of every correction whose index is strictly before
 * `anchorIndex` — these are exactly the deltas that shift the anchor's own
 * pixel position, and therefore exactly what a scroll-offset correction
 * must add back to keep the anchor visually stationary.
 */
export function resolveMeasurementCorrectionDelta(
  corrections: readonly MeasurementCorrection[],
  anchorIndex: number,
): number {
  let delta = 0;
  for (const correction of corrections) {
    if (correction.index < anchorIndex) delta += correction.delta;
  }
  return delta;
}
