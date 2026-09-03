/**
 * Pure edge-proximity detection for bi-directional infinite scroll in a
 * virtual list (CIN-195 `onEndReached`, CIN-196 `onStartReached`).
 *
 * Deciding "are we near an edge" is simple index arithmetic. The hard part —
 * and the entire reason this module exists — is deciding WHEN to fire a
 * callback for that proximity, so a reader who scrolls around near the same
 * edge, or who simply triggers a re-render while still sitting there, does
 * not retrigger a data fetch on every frame. `resolveEdgeFireDecision` is
 * the latch that answers that question; `resolveEdgeProximity` only
 * computes the raw boolean state the latch reacts to.
 *
 * Dependency-free by design, matching the rest of `_internal/`: no DOM, no
 * runes, no timers. `virtual-list.svelte` is expected to call
 * `resolveEdgeProximity` once per scroll/measurement update, feed the
 * result into `resolveEdgeFireDecision` alongside the latch state carried
 * from the previous call, and store `next` for the following call.
 */

/** Whether the current window sits close enough to either edge of the list to consider firing a load callback. */
export type EdgeProximity = {
  readonly isNearStart: boolean;
  readonly isNearEnd: boolean;
};

/**
 * Anti-repeat latch state carried between calls to `resolveEdgeFireDecision`.
 * A latched edge has already fired for the CURRENT approach and stays
 * suppressed until either the reader scrolls away (proximity goes false) or
 * `itemCount` moves away from `itemCountAtLatch` — new items arrived in
 * response to whatever fired last time, so the next approach is treated as
 * genuinely new.
 */
export type EdgeLatch = {
  readonly startLatched: boolean;
  readonly endLatched: boolean;
  /** itemCount as of the call that produced the current startLatched/endLatched values. */
  readonly itemCountAtLatch: number;
};

/** The initial, unlatched state — nothing has fired yet. */
export function createEdgeLatch(): EdgeLatch {
  return { startLatched: false, endLatched: false, itemCountAtLatch: 0 };
}

/**
 * Computes raw start/end proximity from the current window and list shape.
 * This is pure index arithmetic with no memory of prior calls — repeat-fire
 * suppression is `resolveEdgeFireDecision`'s job, not this function's.
 */
export function resolveEdgeProximity(options: {
  /**
   * Accepted for parity with the sibling window/geometry helpers' options
   * shape — every one of them takes a scroll offset — but proximity here is
   * decided entirely in item-index space, so this field is not read.
   */
  scrollOffset: number;
  viewportSize: number;
  totalSize: number;
  firstVisibleIndex: number;
  lastVisibleIndex: number;
  itemCount: number;
  overscan: number;
}): EdgeProximity {
  // An empty list has no edges to reach. Reporting proximity here would let a
  // caller fire a load callback against a source that, by definition, just
  // returned nothing — and nothing would ever stop it from firing again.
  if (options.itemCount <= 0) {
    return { isNearStart: false, isNearEnd: false };
  }

  // A negative overscan would make every index comparison below vacuously
  // false; a non-finite one (NaN from a bad measurement, +/-Infinity) would
  // make every comparison vacuously true, or produce NaN comparisons that are
  // always false. Neither is a usable threshold, so both collapse to 0.
  const resolvedOverscan = Number.isFinite(options.overscan) ? Math.max(0, options.overscan) : 0;

  // The whole list is already on screen, so there is no further scroll
  // gesture that could bring either edge "more" into view. Reporting both
  // edges as near lets a short list (e.g. the very first page of a
  // bi-directional feed) still request the next and previous pages, instead
  // of being stuck because it never crosses an overscan threshold it is
  // already past.
  if (options.totalSize <= options.viewportSize) {
    return { isNearStart: true, isNearEnd: true };
  }

  return {
    isNearStart: options.firstVisibleIndex <= resolvedOverscan,
    isNearEnd: options.lastVisibleIndex >= options.itemCount - 1 - resolvedOverscan,
  };
}

/**
 * Turns raw proximity into a fire/no-fire decision via rising-edge
 * detection: an edge fires only on the call where its proximity flips from
 * not-near to near, or where `itemCount` moved since the latch was last set
 * — which counts as a fresh approach even though proximity never dropped to
 * false in between. Never mutates `previous`; callers store the returned
 * `next` for the following call.
 */
export function resolveEdgeFireDecision(options: {
  proximity: EdgeProximity;
  previous: EdgeLatch;
  itemCount: number;
}): { fireStart: boolean; fireEnd: boolean; next: EdgeLatch } {
  // itemCount changing since the latch was set is direct evidence a batch of
  // items landed in response to whatever fired last time, so treat any latch
  // recorded against the old count as already released rather than requiring
  // proximity to first drop to false and back to true. Without this, a list
  // sitting still near one edge while new items keep arriving there would
  // fire exactly once and never again — which is the one case that makes
  // infinite scroll actually work.
  const itemCountChangedSinceLatch = options.itemCount !== options.previous.itemCountAtLatch;
  const startWasLatched = options.previous.startLatched && !itemCountChangedSinceLatch;
  const endWasLatched = options.previous.endLatched && !itemCountChangedSinceLatch;

  const fireStart = options.proximity.isNearStart && !startWasLatched;
  const fireEnd = options.proximity.isNearEnd && !endWasLatched;

  return {
    fireStart,
    fireEnd,
    next: {
      startLatched: options.proximity.isNearStart,
      endLatched: options.proximity.isNearEnd,
      itemCountAtLatch: options.itemCount,
    },
  };
}
