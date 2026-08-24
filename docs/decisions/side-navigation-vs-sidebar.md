# SideNavigation versus Sidebar

**Status:** Accepted (2026-08-24).

Question: do `SideNavigation` and `Sidebar` reconcile into one component, or
stay distinct?

What the tree currently has: both exist, and their `@purpose` metadata
already differentiates them — `sidebar` is a "responsive layout shell that
anchors a collapsible column" (it composes `Drawer` for its mobile arm),
while `side-navigation` is a "vertical navigation column that hosts grouped
side-navigation-item entries". The overlap is real at the naming level even
though the responsibilities differ.

Ruling: keep both components. Neither is renamed or removed. `Sidebar` is
behavior — a responsive shell that composes `Drawer` and swaps to a mobile
drawer below a configurable breakpoint. `SideNavigation` is accessibility
semantics — a `<nav>` landmark with a required accessible label that can be
used inside any container, including inside a `Sidebar`, a page body, or a
custom shell. They compose (`SideNavigation` is the typical child of
`Sidebar`'s navigation slot) rather than compete, so collapsing them into one
component would force every consumer that only needs the nav landmark to also
take on responsive-shell behavior, and vice versa.

Both components carry reciprocal `@related`/`@avoidWhen` metadata pointing at
each other and at this document, so the boundary is discoverable from either
component's JSDoc.
