---
'@lostgradient/cinder': minor
---

VirtualList: add `stickyItems`, `smoothScroll`, and `adaptiveOverscan`, and give every
row `aria-posinset` and `aria-setsize`.

`stickyItems` pins the named indexes to the leading edge. The part virtualization
would otherwise break is keeping them mounted: a row whose index leaves the rendered
window is normally unmounted, so the heading would disappear exactly when it is meant
to be pinned. The active sticky row is kept in the DOM past its window, and the
rendered set is re-sorted by index so a keyed each block does not move it behind the
rows that follow it.

Rows now announce their position in the FULL collection rather than the rendered
window, which is what assistive technology needs on a virtualized list — otherwise a
10,000-row list reads as "3 of 12". `aria-posinset` is 1-based per the specification;
`context.index` stays 0-based.

Setting `stickyItems` also makes the list claim the Arrow, Page, Home, and End keys,
which it otherwise leaves to the browser. A pinned header covers the leading edge, so
a destination aligned flush to it lands underneath — in a list where the header and
its rows share a height, completely underneath. Destinations now clear the header, and
that applies to `scrollToIndex` calls of your own as well as to the keys: with
`stickyItems` set, `scrollToIndex(n, { align: 'start' })` stops at the header's height
above row `n` rather than at row `n` exactly. Page keys step by the rows the header
leaves visible rather than by the whole viewport, and Arrow and Page keys pass over
sticky rows themselves, which are on screen already for as long as their section is.
Home and End still go to the collection's true ends.

`smoothScroll` makes `scrollToIndex` animate by default, with an explicit `behavior`
in the call still winning. `adaptiveOverscan` grows `overscan` with scroll velocity
and shrinks it back when the reader slows, treating the configured value as a floor
and clamping the growth so a fling cannot mount thousands of rows. Under `dynamicSize`
it converts that velocity using the rows' measured average rather than the `itemHeight`
estimate, which otherwise widens the window by a fraction of what the reader is
actually outrunning.
