---
'@lostgradient/cinder': minor
---

VirtualList: add `scrollRestoration`, which remembers the reader's position across
navigation.

The position is persisted to `sessionStorage` under a required `scrollRestorationId`.
There is deliberately no implicit key: one derived from position or mount order would
hand a remembered offset to the wrong list after an unrelated refactor, and two lists
on a page would overwrite each other.

The anchor is remembered by row KEY as well as index, because an index stops
describing the same row the moment the collection changes while the list is
unmounted — which is exactly what a feed does by growing at the front. It also carries
how far INTO that row the reader was, so a long transcript reopens mid-paragraph
rather than at the top of it.

Restoration waits for the row to exist rather than assuming it is gone: a list that
fetches its own data renders empty first, and one that pages incrementally may need
several pages before the saved row arrives. It keeps trying while the collection
grows, and yields to nothing — a pending restore outranks `reverse`'s opening pin, and
holds the infinite-scroll callbacks so they do not fetch a page merely because the
list rendered at offset zero for one frame. It does not hold them once it is itself
waiting for pagination to deliver the anchor.

Every storage access is guarded, reads included: some browsers throw on merely
touching `sessionStorage` in private mode, not only on writing.
