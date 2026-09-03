---
'@lostgradient/cinder': minor
---

VirtualList: add `horizontal` for inline-axis virtualization, with right-to-left support.

`horizontal` scrolls and lays rows out along the inline axis. `itemHeight` and `height` are
reinterpreted rather than renamed — `itemHeight` becomes each item's width, `height` becomes the
container's inline-size — and `--cinder-virtual-list-height` keeps its name while switching to drive
`inline-size`, so an existing theme override survives turning the prop on.

Right-to-left is handled rather than assumed. The writing direction is resolved from the container's
computed style, and the RTL `scrollLeft` convention is feature-detected once per document: browsers
disagree on both the sign and the origin of `scrollLeft` in a right-to-left container, and current
browsers use the negative convention that older ones did not.
