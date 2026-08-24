# `*Group` versus plural naming

**Status:** Accepted (2026-08-24, CIN-105). Decided once across the family,
not per component.

Question: what does "Group" mean in a component name, and should pure-layout
collections use a plural instead (`AvatarGroup` → `Avatars`)?

What the tree currently has: `avatar-group`, `button-group`,
`checkbox-group`, `dropdown-group`, `radio-group`, `side-navigation-group`,
and `statistic-group` all exist, each with a different grouping semantic —
shared accessible label, fieldset/legend semantics, layout grid, or a
collapsible bucket (see their `@purpose` metadata). `statistic-group` was
deliberately retained in the 2026-08 marketing demotion as the compound
parent of the compose-only `statistic` leaf.

**Ruling:** `*Group` is not restricted to semantic (`role="group"` / fieldset)
grouping. `*Group` names a curated collection of N instances of its matching
singular component, and the specific grouping contract — semantic, layout, or
collapsible — is left to each family's own `@purpose` documentation rather
than fixed by the name itself. A bare plural is permitted only as a domain
mass noun that composes no matching singular component (e.g. a name for a
kind of thing, not a container of named instances); it is never a legal
collection name. No existing component is renamed by this ruling — every
current `*-group` component already fits the collection definition. See the
convention entry in [`docs/component-api-conventions.md`](../component-api-conventions.md#group-versus-plural-component-names),
which `check:prop-conventions` enforces for new component names going
forward via a directory-name shadow check.
