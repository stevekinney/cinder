/**
 * Pure ARIA row-semantics and keyboard-navigation arithmetic for the virtual
 * list. See CIN-201.
 *
 * A virtualized list only ever mounts a small window of rows, so assistive
 * technology reading `aria-posinset`/`aria-setsize` off the mounted DOM
 * alone would announce something like "3 of 12" for a list of 10,000 items
 * — the window length, not the true list size. `resolveRowSemantics` exists
 * to hand the component the FULL-list numbers to stamp onto each mounted
 * row instead of that.
 *
 * `resolveKeyboardTargetIndex` is the companion arithmetic for arrow/Page/
 * Home/End navigation: it resolves which index a keypress should move focus
 * to, independent of which rows happen to be mounted right now, so
 * navigation keeps working identically across mount and unmount cycles as
 * the window scrolls past a given row.
 *
 * Dependency-free, matching the rest of `_internal/`: no DOM, no runes. The
 * component owns reading the real `KeyboardEvent.key`, moving focus to the
 * resolved index (mounting it first if it currently sits outside the
 * window), and the actual scrolling.
 */

/** `aria-posinset`/`aria-setsize` values for one row of a virtualized list. */
export type RowSemantics = {
  /** 1-based position within the FULL list — never the zero-based `index` passed in. */
  readonly ariaPosInSet: number;
  /** The FULL item count, not the length of the rendered window — see the module doc for why that distinction is the point. */
  readonly ariaSetSize: number;
};

/**
 * Resolves the `aria-posinset`/`aria-setsize` pair for the row at `index`.
 *
 * `aria-posinset` is 1-BASED: `index` is the zero-based array position, so
 * this adds 1 rather than passing `index` straight through — passing the
 * zero-based index through unchanged is the single most common way to get
 * this attribute wrong.
 *
 * `aria-setsize` is `itemCount`, the FULL logical list size, not the number
 * of rows currently mounted in the virtualization window. That distinction
 * is the entire reason a virtualized list needs these attributes in the
 * first place: without it, assistive technology would announce something
 * like "3 of 12" for a list of 10,000 items, reading only what happens to
 * be in the DOM right now.
 */
export function resolveRowSemantics(index: number, itemCount: number): RowSemantics {
  return { ariaPosInSet: index + 1, ariaSetSize: itemCount };
}

/** Which axis `resolveKeyboardTargetIndex` treats as "forward"/"backward" for the Arrow keys. */
export type VirtualListOrientation = 'vertical' | 'horizontal';

/**
 * Resolves the index a navigation keypress should move focus to.
 *
 * Returns `null` when `key` is not one of the keys this list handles, so
 * the component can tell "not a navigation key, leave the event alone"
 * apart from "navigation key, but the move happens to be a no-op." The
 * latter still returns the (unchanged) index rather than `null` — the
 * component still needs to consume the event (stopping it from scrolling
 * the page via the browser's own default handling, for instance) even when
 * the reader is already at the boundary they pressed toward.
 *
 * `Home` resolves to 0 and `End` to `itemCount - 1`. `PageDown`/`PageUp`
 * move by `visibleCount`, guarded to a step of at least 1 — a
 * `visibleCount` of 0 or less would otherwise move by nothing, and the key
 * would do nothing forever. Every result is clamped to `[0, itemCount - 1]`;
 * `itemCount <= 0` has no valid index to move to at all, so every key
 * resolves to `null` in that case, including `Home` and `End`.
 *
 * The horizontal arrow mapping DOES branch on writing direction, and has to.
 * `KeyboardEvent.key` is derived from the physical key and the keyboard layout;
 * it is not remapped by `dir`, so the right arrow reports `'ArrowRight'` in a
 * right-to-left list exactly as it does in a left-to-right one. Meanwhile the
 * component positions horizontal rows with logical properties, so under RTL a
 * higher index sits visually to the LEFT. Mapping `'ArrowRight'` to "forward"
 * there would walk the reader backwards from where they pressed.
 *
 * This is what the WAI-ARIA Authoring Practices mean by "if the direction is
 * RTL, Right Arrow performs as Left Arrow and vice versa" — guidance that exists
 * precisely because the reversal is not automatic. `writingDirection` is ignored
 * for a vertical list, where the block axis does not flip.
 */
export function resolveKeyboardTargetIndex(options: {
  key: string;
  currentIndex: number;
  itemCount: number;
  visibleCount: number;
  orientation: VirtualListOrientation;
  writingDirection?: 'ltr' | 'rtl';
  /**
   * Indexes rendered as sticky headers. Stepping keys move between content rows
   * and pass over these.
   */
  stickyIndexes?: ReadonlySet<number>;
}): number | null {
  if (options.itemCount <= 0) return null;

  const lastIndex = options.itemCount - 1;
  const clampToListRange = (index: number): number => Math.max(0, Math.min(lastIndex, index));

  /**
   * Steps past sticky rows in the direction of travel.
   *
   * A sticky header is held at the leading edge for as long as its section is in
   * view, so it is on screen already and scrolling to it moves nothing. Worse, it
   * is the row a step lands on coming back UP to a section: the destination's
   * inset is zero exactly there, so the target resolves to the position the reader
   * is already at and the key does nothing at all.
   *
   * Running off the end means every row that way is sticky, so there is no content
   * row to reach; the boundary itself is as close as the reader gets.
   */
  const skipStickyRows = (index: number, direction: number): number => {
    const sticky = options.stickyIndexes;
    if (sticky === undefined || sticky.size === 0) return index;
    let candidate = index;
    while (candidate >= 0 && candidate <= lastIndex && sticky.has(candidate)) {
      candidate += direction;
    }
    return candidate < 0 || candidate > lastIndex ? index : candidate;
  };

  // Home and End are absolute: they mean the ends of the list, sticky or not.
  if (options.key === 'Home') return 0;
  if (options.key === 'End') return lastIndex;

  if (options.key === 'PageDown' || options.key === 'PageUp') {
    const pageStep = Math.max(1, Math.floor(options.visibleCount));
    const signedStep = options.key === 'PageDown' ? pageStep : -pageStep;
    const direction = options.key === 'PageDown' ? 1 : -1;
    return skipStickyRows(clampToListRange(options.currentIndex + signedStep), direction);
  }

  if (options.orientation === 'vertical') {
    if (options.key === 'ArrowDown')
      return skipStickyRows(clampToListRange(options.currentIndex + 1), 1);
    if (options.key === 'ArrowUp')
      return skipStickyRows(clampToListRange(options.currentIndex - 1), -1);
    return null;
  }

  // Under RTL the inline axis runs right-to-left, so the arrow that moves the
  // reader visually forward is the left one.
  const isRightToLeft = options.writingDirection === 'rtl';
  const forwardKey = isRightToLeft ? 'ArrowLeft' : 'ArrowRight';
  const backwardKey = isRightToLeft ? 'ArrowRight' : 'ArrowLeft';

  if (options.key === forwardKey)
    return skipStickyRows(clampToListRange(options.currentIndex + 1), 1);
  if (options.key === backwardKey)
    return skipStickyRows(clampToListRange(options.currentIndex - 1), -1);

  return null;
}
