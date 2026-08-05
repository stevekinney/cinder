---
'@lostgradient/cinder': patch
---

Fix a set of real interaction and accessibility defects: Meter silently dropping a
consumer's forwarded `aria-label`; MultiSelect's listbox being clipped by an
overflow-hidden ancestor instead of portaling; Popover/HoverCard arrow placement being
overridden by a hardcoded shared inset; asymmetric overlay open/close motion on Modal,
Drawer, Sheet, and HoverCard (missing `@starting-style`/`allow-discrete`, no real exit
transition); SelectionPopover dismissing itself immediately when opened via a
drag-selection gesture that triggers page autoscroll; and menu-open latency from the
shared anchored-overlay layer's first `@floating-ui/dom` import no longer being prefetched
ahead of the first open. Also fixes a `_sortable-item.svelte` DOM query
(`:scope >` → `.children`-based) that silently matched zero rows under happy-dom — a
test-environment compatibility fix with no change to real-browser drag behavior, which
was already correct; no runtime change to KanbanBoard.
