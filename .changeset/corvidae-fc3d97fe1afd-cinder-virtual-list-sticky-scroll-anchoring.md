---
'@lostgradient/cinder': patch
---

`VirtualList` with `stickyItems` no longer scrolls itself back a row, and no longer fights a scroll it did not make after an arrow key.

When the active sticky row's index left the rendered window, the row pinned and left flow, and the browser's native scroll anchoring pulled the scroll offset back by the row's size. A keyboard step that had just landed was undone, so a held arrow key dropped rows. A list that scrolls its own container now sets `overflow-anchor: none`, not only under `dynamicSize`, because it positions its rows from that container's scroll offset itself. A `windowScroll` list with `stickyItems` opts out of the page's anchoring for the same reason, as a `dynamicSize` list already did. A `windowScroll` list without sticky rows leaves the page's anchoring as it was.

A keyboard workaround for that jump is gone as well. It re-issued an arrow press whenever the position settled back where the press began, so a consumer setting `scrollTop`, or a fragment link, that returned the list to that offset within a few frames was overwritten. An instant write to fixed-height rows (no `smoothScroll`, or reduced motion) also no longer keeps its destination pending once it lands, so a press right after another scroll steps from the live position instead of a stale row.
