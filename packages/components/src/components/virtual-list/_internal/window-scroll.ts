/**
 * Pure offset arithmetic for `windowScroll`: virtualizing against the
 * window's own scroll position and viewport instead of an internal scrolling
 * container.
 *
 * Kept separate from `virtual-list.svelte`, like the rest of `_internal`, so
 * the arithmetic is unit-testable without mounting Svelte or touching a real
 * `window`. `virtual-list.svelte` owns everything DOM-facing — reading
 * `window.scrollY`, calling `getBoundingClientRect`, calling
 * `window.scrollTo` — and hands this module only the numbers those reads
 * produce.
 */

/**
 * The list's own scroll offset under `windowScroll`: how far the window has
 * scrolled past the list's top edge in the document.
 *
 * Floored at 0 rather than allowed to go negative. A `windowScroll` list can
 * start below other page content — a header, a hero section — and the
 * window's scroll position stays below `documentOffset` until the reader
 * reaches the list at all; nothing before that point counts as having
 * scrolled INTO the list.
 */
export function resolveWindowScrollOffset(
  windowScrollPosition: number,
  documentOffset: number,
): number {
  return Math.max(0, windowScrollPosition - documentOffset);
}

/**
 * Where `window.scrollTo` must send the window so the list's own scroll
 * offset `target` lands at the top of the viewport.
 *
 * The inverse of {@link resolveWindowScrollOffset}: the window scrolls the
 * whole document, so reaching a position WITHIN the list means first
 * scrolling past everything the list starts below.
 */
export function resolveWindowScrollTarget(target: number, documentOffset: number): number {
  return Math.max(0, documentOffset + target);
}

/**
 * The list's top edge in document coordinates, from a viewport-relative rect
 * and however far the window has already scrolled.
 *
 * Takes the raw numbers rather than an element so this stays synchronous and
 * DOM-free — the caller is the one that knows which reads are genuinely
 * layout-forcing (`getBoundingClientRect`) and must be kept off the scroll
 * handler's hot path; this function just adds two numbers together.
 */
export function resolveDocumentOffset(rectTop: number, windowScrollPosition: number): number {
  return rectTop + windowScrollPosition;
}
