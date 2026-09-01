---
'@lostgradient/cinder': minor
---

VirtualList: add `dynamicSize` for measured, variable-height rows, and a typed `ref` handle.

`dynamicSize` opts a list into measuring each rendered row with `ResizeObserver` and caching the
result, using `itemHeight` as the initial estimate for rows that have not been measured yet. When a
measurement differs from the estimate, the scroll offset is corrected before paint so the viewport
does not visibly jump. The fixed-height path remains the default and is untouched: with `dynamicSize`
off, no measurement, caching, correction, or `ResizeObserver` construction occurs anywhere in the
component.

`bind:ref` now exposes a typed `VirtualListRef` with `scrollToIndex(index, options)`, which accounts
for the measured sizes of every row before the target and accepts `align` and `behavior` options.
