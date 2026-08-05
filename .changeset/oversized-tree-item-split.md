---
'@lostgradient/cinder': patch
---

Internal restructuring: extract TreeItem's inline-rename state machine into `TreeItemRenameController`, keyboard/pointer drag handling into `TreeItemDragHandlers`, the async `loadChildren` lifecycle into `TreeItemAsyncLoader`, and the filter-highlight splitter into a plain `splitLabelForHighlight` function. Checkbox-selection reconciliation and tree registration stay inline, matching their existing precisely-ordered same-file guarantees. No behavior or public API change; markup is unchanged.
