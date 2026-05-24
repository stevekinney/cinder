# KanbanBoard sortable boundary

- `_sortable-item.svelte` owns pointer capture, pointer cancellation, rAF throttling, window auto-scroll, and the physical handle button event listeners.
- `_sortable-item.svelte` owns the generic keyboard lift, drop, cancel, Home, End, ArrowUp, and ArrowDown dispatch. `KanbanBoard` supplies an optional context hook for lifted ArrowLeft and ArrowRight cross-column moves.
- `SortableController` owns the active drag phase, lifted key, lifted label, source index, target index, duplicate-lift prevention, and default announcements.
- `SortableList` owns one-dimensional item indexes for a single list.
- `KanbanBoard` owns board-specific column/card lookup, visible-column filtering, cross-column target calculation, empty-column drop zones, collapse state changes, and board-specific announcement wording.
- One active drag session is enforced by one `SortableController` instance per board for card moves and a separate one for column moves. Each lift checks the opposite controller before starting.
- If this refactor fails, revert `packages/components/src/utilities/sortable-controller.svelte.ts`, `packages/components/src/components/_sortable-item.svelte`, and all files under `packages/components/src/components/kanban-board/`.
