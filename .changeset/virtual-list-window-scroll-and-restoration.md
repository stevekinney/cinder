---
'@lostgradient/cinder': minor
---

VirtualList: add `windowScroll` for virtualizing against the page, and
`scrollRestoration` for remembering the reader's position across navigation.

`windowScroll` drops the internal scroll container: the list becomes a plain block,
`height` is ignored, and the viewport comes from the window. Progress is derived from
where the list's box sits relative to the viewport, and windowing uses the overlap
between the two rather than the full viewport, so a list beginning halfway down the
page does not mount rows below the fold. `stickToBottom`, `reverse`, and `scrollRestoration` are all ignored in this mode.
The first two pin a scroll position the component no longer owns; the third cannot
represent one, since a saved offset measures from the list's start edge and clamps at
zero. The browser's own document scroll restoration already covers this mode.

`scrollRestoration` persists the position to `sessionStorage` under a required
`scrollRestorationId` — there is no implicit key, because one would hand a remembered
offset to the wrong list after a refactor. Under `dynamicSize` the position restores
by index rather than pixel offset, since the saved offset points at a different row
once measurement begins. A saved position whose row no longer exists is dropped
rather than clamped. Storage access is fully guarded: some browsers throw on reading
`sessionStorage`, not only on writing.
