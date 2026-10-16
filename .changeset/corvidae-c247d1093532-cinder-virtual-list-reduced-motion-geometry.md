---
'@lostgradient/cinder': patch
---

`VirtualList` no longer draws its rows a frame late under reduced motion, and a `windowScroll` list with `stickyItems` keeps the page's native scroll anchoring again.

Reduced motion shortens every transition to 0.01ms without narrowing which properties transition, so the list's window offset, pinned row offset, and spacer size each held their previous value for a frame after every scroll. Each time the window advanced, the rows painted one row off for that frame. When a sticky header pinned, it left flow at once while the window offset lagged, so the rows shifted up by the header's height and the page's scroll anchoring scrolled back to compensate. The list's own geometry no longer transitions, so neither happens, and the `windowScroll` opt-out from page anchoring for sticky rows is gone.
