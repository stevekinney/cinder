# `*Group` versus plural naming

**Status:** Open (raised 2026-08-05). Decide once across the family, not per
component.

Question: what does "Group" mean in a component name, and should pure-layout
collections use a plural instead (`AvatarGroup` → `Avatars`)?

What the tree currently has: `avatar-group`, `button-group`,
`checkbox-group`, `dropdown-group`, `radio-group`, `side-navigation-group`,
and `statistic-group` all exist, each with a different grouping semantic —
shared accessible label, fieldset/legend semantics, layout grid, or a
collapsible bucket (see their `@purpose` metadata). `statistic-group` was
deliberately retained in the 2026-08 marketing demotion as the compound
parent of the compose-only `statistic` leaf.

Open: whether "Group" may only mean _semantic_ grouping (a `role="group"` /
fieldset contract), and what pure-layout collections must be called instead.

Closing this requires one convention entry in
`docs/component-api-conventions.md` and a single coordinated rename wave for
whichever components fall on the wrong side of it.
