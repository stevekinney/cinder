# KanbanBoard accessibility

KanbanBoard is a controlled component. The `columns` prop is the committed source of truth, and every card move, column move, or collapse toggle is reported through `onchange(nextColumns, change)`.

Card handles use the same keyboard model as SortableList: Space or Enter lifts and drops, ArrowUp and ArrowDown move within a column, ArrowLeft and ArrowRight move across visible non-collapsed columns, Home and End move within the current column, Escape cancels, and Tab cancels while allowing native focus movement.

Column handles are keyboard reorder controls. Space or Enter lifts and drops a column, ArrowLeft and ArrowRight move the lifted column, Home and End jump to the first or last column, and Escape cancels.

Collapsed columns keep their headers, column handles, and collapse controls reachable. Their cards are not rendered, so card handles inside collapsed columns are removed from focus order and assistive technology traversal.

The component does not use deprecated `aria-grabbed` or `aria-dropeffect`. Announcements are sent through one live region and include the moved card or column, destination, position, drop, cancellation, and collapse or expand state.

Pointer dragging uses the shared cinder sortable handle implementation and recomputes board column geometry during the gesture. Nested scroll-container auto-scroll is out of scope for this version; window-edge auto-scroll is inherited from the shared sortable handle behavior.

Column ids and card keys must be unique. Duplicate keys trigger a `[cinder-kanban-board]` warning, set `data-cinder-invalid-keys` on the root, and disable card and column lift operations until keys are unique.
