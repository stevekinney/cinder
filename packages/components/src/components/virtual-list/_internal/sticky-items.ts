/**
 * Pure decision logic for `stickyItems` (CIN-199): which item indexes act as
 * sticky headers/rows in a virtual list, which one is currently pinned to
 * the leading edge, and which extra indexes the rendered window must keep
 * mounted so a pinned row never disappears mid-scroll.
 *
 * `virtual-list.svelte` owns the DOM half of sticky positioning — applying
 * sticky positioning to the active row and mounting whatever this module
 * reports. Everything here is index arithmetic only: no DOM, no runes,
 * dependency-free, matching the rest of `_internal/`.
 */

/**
 * Sanitizes a consumer-supplied `stickyItems` array into a sorted,
 * de-duplicated list of valid item indexes in `[0, itemCount - 1]`.
 *
 * `stickyItems` comes straight from a consumer's prop, so it can hold
 * anything: floats, negatives, out-of-range values, duplicates in any
 * order, `NaN`, or `Infinity`. None of that is a reason to throw or to fail
 * rendering — a bad sticky index is a cosmetic problem, not a correctness
 * one — so invalid entries are silently dropped instead.
 */
export function normalizeStickyIndexes(
  stickyItems: readonly number[] | undefined,
  itemCount: number,
): readonly number[] {
  if (stickyItems === undefined || stickyItems.length === 0) return [];

  // A non-finite itemCount (NaN, +/-Infinity) has no meaningful "last valid
  // index" — and NaN specifically is dangerous to fall through on, since
  // EVERY comparison against it is false, which would make the `candidate <
  // 0 || candidate > maximumIndex` guard below vacuously false and let bad
  // candidates through instead of rejecting them. Treat it the same as an
  // itemCount with no valid range at all: nothing normalizes.
  if (!Number.isFinite(itemCount)) return [];

  const maximumIndex = itemCount - 1;

  const validIndexes = new Set<number>();
  for (const candidate of stickyItems) {
    // Number.isInteger rejects NaN, +/-Infinity, and any fractional value in
    // one check — every "not really an index" shape a consumer array can hold.
    if (!Number.isInteger(candidate)) continue;
    if (candidate < 0 || candidate > maximumIndex) continue;
    validIndexes.add(candidate);
  }

  return Array.from(validIndexes).sort((leftIndex, rightIndex) => leftIndex - rightIndex);
}

/**
 * Binary search for the greatest position in `sortedValues` whose value is
 * `<= target`. Returns `-1` when no such value exists — either the array is
 * empty or every value exceeds `target`. Assumes `sortedValues` is sorted
 * ascending, which holds for any array `normalizeStickyIndexes` produced.
 */
function findGreatestIndexAtOrBefore(sortedValues: readonly number[], target: number): number {
  let low = 0;
  let high = sortedValues.length - 1;
  let result = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const value = sortedValues[middle]!;
    if (value <= target) {
      result = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return result;
}
/**
 * The sticky index currently pinned to the leading edge: the greatest entry
 * in `stickyIndexes` that is at or before `firstVisibleIndex`. `null` when
 * no sticky index qualifies — the reader has not yet scrolled to or past the
 * first one.
 *
 * Uses a binary search rather than a linear scan because this runs on every
 * scroll frame, and `stickyIndexes` can be long for a grouped list (one
 * sticky entry per group, with many groups).
 */
export function resolveActiveStickyIndex(
  stickyIndexes: readonly number[],
  firstVisibleIndex: number,
): number | null {
  const position = findGreatestIndexAtOrBefore(stickyIndexes, firstVisibleIndex);
  return position === -1 ? null : stickyIndexes[position]!;
}

/**
 * The sticky header that covers row `index` once that row reaches the leading
 * edge, or `null` when nothing does.
 *
 * A sticky row covers nothing at its own index: it IS the header there, so there
 * is no obstruction above it.
 *
 * This asks a different question from `resolveActiveStickyIndex`, which answers
 * "what is pinned right now" from the current scroll position. Scroll destinations
 * must not be keyed on the current position: the inset would change as the scroll
 * moved, so a settle loop would recompute a different target on each pass and a
 * header taller than a row makes it oscillate between the header's start and the
 * row's, landing wherever the attempt cap happened to stop.
 */
export function resolveObstructingStickyIndex(
  stickyIndexes: readonly number[],
  index: number,
): number | null {
  const header = resolveActiveStickyIndex(stickyIndexes, index);
  return header === null || header === index ? null : header;
}
