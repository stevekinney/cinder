---
'@lostgradient/editor': patch
---

Give DiffViewer's shortcut keycaps a meaning, record the copy-format decision, and make
MarkdownEditor's toolbar overflow width-driven.

DiffViewer's `[` and `]` keycaps now annotate the Previous/Next buttons they duplicate: each
button's accessible name carries its shortcut, and the keycaps themselves are decorative. They
were previously a floating pair with no label, tooltip, or association to anything. Their
narrow-width hiding also moves from a viewport `@media` to a `@container` query, since it
responds to the toolbar's own width rather than the window's.

DiffViewer's copy button already emitted correct unified format; what was missing was the
recorded decision that copying is always a full unified diff regardless of the active view
mode. That is now documented at the handler, in the README, and in the accessibility notes,
and pinned by a test.

MarkdownEditor's toolbar overflow becomes width-measured instead of a fixed split. Every
group after History and BlockType previously lived behind the "More formatting" popover no
matter how much room the toolbar had; groups now move into the popover only when they stop
fitting, keeping each group's `role="group"` and label as it relocates.

ReviewEditor's diff-view control cluster gains `Toolbar` semantics. Its outer bar deliberately
remains a `group`, because it hosts a `tablist` alongside a nested `toolbar` and WAI-ARIA
forbids both as children of a `toolbar`.
