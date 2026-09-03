---
'@lostgradient/cinder': minor
---

VirtualList: add `reverse` for chat transcripts, and `onEndReached`/`onStartReached`
for bi-directional infinite scroll.

`reverse` opens the list at its newest item and returns there on every append,
regardless of where the reader has scrolled — distinct from `stickToBottom`, which
pins only when the reader is already at the bottom. Items keep their natural order;
`reverse` names the anchoring, not the ordering. Prepending older history anchors to
the row the reader was on instead of moving them.

`onEndReached` and `onStartReached` fire as the reader comes within `overscan` items
of either edge. Each fires once per approach and re-arms when the item count changes,
so appending in response allows the next page while a source that returns nothing
does not spin.

Also repairs two scroll reads left on the block axis by the `horizontal` work: the
dynamic re-pin comparison, and the settle loop in `scrollToIndex`, which saw no
movement on a horizontal list and so skipped its settle pass entirely.
