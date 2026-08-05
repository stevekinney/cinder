---
'@lostgradient/cinder': patch
---

Fix a set of real interaction and accessibility defects: Meter silently dropping a
consumer's forwarded `aria-label`; SortableList/KanbanBoard drag targeting measuring
against stale post-reorder layout on multi-position drags; MultiSelect's listbox being
clipped by an overflow-hidden ancestor instead of portaling; Popover/HoverCard arrow
placement being overridden by a hardcoded shared inset; asymmetric overlay open/close
motion on Modal, Drawer, Sheet, and HoverCard (missing `@starting-style`/`allow-discrete`,
no real exit transition); SelectionPopover dismissing itself immediately when opened via a
drag-selection gesture that triggers page autoscroll; and menu-open latency from the
shared anchored-overlay layer's first `@floating-ui/dom` import no longer being prefetched
ahead of the first open.
