/**
 * Geometry for virtualizing against the document scroller rather than an
 * internal one.
 *
 * With `windowScroll`, the list has no scroll container of its own: it is a plain
 * block in the page, and the reader moves through it by scrolling the document.
 * Everything the windowing math needs — how far into the list the reader is, and
 * how much of the list is on screen — has to be derived from where the list's box
 * currently sits relative to the viewport, rather than read off an element.
 *
 * These are pure so they can be tested without a layout engine, which the unit
 * harness does not have.
 */

/** Where the scroll position being virtualized against actually lives. */
export type ScrollSourceMode = 'container' | 'window';

export type WindowScrollGeometry = {
  /**
   * How far the reader has travelled into the list's own content, measured from
   * the list's start edge. Zero while the list's start is still at or below the
   * viewport's start edge.
   */
  scrollOffset: number;
  /**
   * How much of the list is actually on screen. This is NOT the viewport size: a
   * list that begins halfway down the page, or ends above the viewport's bottom,
   * occupies only part of it, and windowing against the full viewport would mount
   * rows that are nowhere near visible.
   */
  visibleSize: number;
};

/**
 * Resolves the scroll offset and visible extent of a list positioned at
 * `listStartInViewport` — the main-axis distance from the viewport's start edge
 * to the list's start edge, which is exactly what `getBoundingClientRect()`
 * reports and goes negative once the reader scrolls past the list's beginning.
 */
export function resolveWindowScrollGeometry(options: {
  listStartInViewport: number;
  viewportSize: number;
  totalSize: number;
}): WindowScrollGeometry {
  const viewportSize = Math.max(0, options.viewportSize);
  const totalSize = Math.max(0, options.totalSize);
  const listStart = Number.isFinite(options.listStartInViewport) ? options.listStartInViewport : 0;

  // A negative `listStart` means the list's beginning has scrolled off the start
  // edge, and that distance is precisely how far into the content the reader is.
  // While it is still positive the list has not been reached, so the offset is 0.
  const rawOffset = Math.max(0, -listStart);
  // The reader cannot be further into the list than its content allows, however
  // far the document itself has scrolled past it.
  const maximumOffset = Math.max(0, totalSize - viewportSize);
  const scrollOffset = Math.min(rawOffset, maximumOffset);

  // The on-screen slice is the overlap between the list's box and the viewport.
  const overlapStart = Math.max(0, listStart);
  const overlapEnd = Math.min(viewportSize, listStart + totalSize);
  const visibleSize = Math.max(0, overlapEnd - overlapStart);

  return { scrollOffset, visibleSize };
}

/**
 * The main-axis size of the visual viewport.
 *
 * Reads `innerHeight`/`innerWidth` rather than the documentElement's client box:
 * on mobile browsers the two disagree while the address bar is collapsing, and
 * the inner dimensions are the ones that track what the reader can actually see.
 * Returns 0 without a window so a server render falls back to its own estimate
 * instead of throwing.
 */
export function resolveWindowViewportSize(
  view: { innerHeight: number; innerWidth: number } | undefined,
  axis: 'vertical' | 'horizontal',
): number {
  if (!view) return 0;
  const size = axis === 'horizontal' ? view.innerWidth : view.innerHeight;
  return Number.isFinite(size) && size > 0 ? size : 0;
}
