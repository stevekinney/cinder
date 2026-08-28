---
'@lostgradient/cinder': patch
---

Stabilise CommandMenu's anchoring, restore CommandPalette's standard focus ring, grid-align
FilterBar, and compose Kanban's header buttons from the shared Button.

`createAnchoredOverlay` gains an opt-in `lockPlacement` option. Floating UI re-runs `flip` on
every reposition, so a panel whose height tracks its content can flip across its anchor and back
as that content changes. Locking holds the placement resolved when the overlay opened. Off by
default, so every other anchored overlay keeps continuous flip behaviour.

CommandMenu opts into it, which stops the menu jumping vertically as its filtered list narrows,
and pairs it with `size` so a panel that runs out of room shrinks and scrolls instead of
overflowing the viewport.

CommandPalette's search input now uses the library's standard focus ring on `:focus-visible`
rather than a bespoke full-width `border-block-end` that changed colour.

FilterBar's controls move from `flex-wrap` to a container-query-driven grid, so facets align
across wrap boundaries and the search field stops absorbing all available row space.

KanbanBoard's column-handle and collapse controls render through the shared `Button` (ghost,
small, icon-only) instead of bespoke 32px boxes, inheriting the library's focus, hover, and
disabled treatments.
