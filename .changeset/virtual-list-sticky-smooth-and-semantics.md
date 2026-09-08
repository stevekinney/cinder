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

`smoothScroll` makes `scrollToIndex` animate by default, with an explicit `behavior`
in the call still winning. `adaptiveOverscan` grows `overscan` with scroll velocity
and shrinks it back when the reader slows, treating the configured value as a floor
and clamping the growth so a fling cannot mount thousands of rows.
