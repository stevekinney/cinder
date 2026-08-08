# SideNavigation versus Sidebar

**Status:** Open (raised 2026-08-05).

Question: do `SideNavigation` and `Sidebar` reconcile into one component, or
stay distinct?

What the tree currently has: both exist, and their `@purpose` metadata
already differentiates them — `sidebar` is a "responsive layout shell that
anchors a collapsible column" (it composes `Drawer` for its mobile arm),
while `side-navigation` is a "vertical navigation column that hosts grouped
side-navigation-item entries". The overlap is real at the naming level even
though the responsibilities differ.

Open: whether two public entries survive the behavior-first admission bar
(`docs/decisions/component-admission-bar.md`), and if they do, whether the
names can stop implying they are the same thing.

Closing this requires a boundary decision recorded here (choose-one-or-keep-
both plus naming), and `@related`/`@avoidWhen` metadata on both components
pointing at it.
