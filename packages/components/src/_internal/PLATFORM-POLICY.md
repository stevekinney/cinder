# Cinder Platform Feature Policy

Cinder already leans on modern CSS and HTML primitives — `@layer`, `<dialog>`,
`inert`, the Popover API, CSS Anchor Positioning, container queries,
`field-sizing`, `accent-color`, `subgrid`, `content-visibility`,
`@starting-style`, and `text-wrap` all appear in the source. What was missing was
a single rule that tells a component author **when a feature is the default, when
it must be guarded as progressive enhancement, and when it must not carry core
behavior**. Without that rule, one overlay reaches for the native Popover API
while another hand-rolls geometry; one component uses container queries while a
sibling repeats viewport breakpoints. This document is the shared answer so
individual components and their `.a11y.md` files don't each re-litigate browser
support.

This policy is the umbrella. Three companion policies already cover slices and
remain authoritative for their domain — this document classifies the features
and points at them:

- [`OVERLAY-POLICY.md`](./OVERLAY-POLICY.md) — `<dialog>`, Popover API, CSS Anchor
  Positioning, `inert`, top-layer, focus, escape, scroll-lock for overlays.
- [`RESPONSIVE-POLICY.md`](./RESPONSIVE-POLICY.md) — container queries vs. viewport
  queries.
- [`NATIVE-FORM-POLICY.md`](./NATIVE-FORM-POLICY.md) — `field-sizing`,
  `accent-color`, dialog forms, native validation pseudo-classes.
- [`../../../../docs/focus-ring-policy.md`](../../../../docs/focus-ring-policy.md) —
  the focus-ring token recipe and forced-colors fallback.

## Support tiers

Every modern feature Cinder uses falls into exactly one tier. The tier decides
whether the feature may carry correctness or only enhancement.

- **Tier 1 — Use directly.** Baseline. Cinder relies on it for correct behavior
  with no `@supports` guard and no JavaScript fallback. A browser without it is
  outside Cinder's support window.
- **Tier 2 — Progressive enhancement.** May improve presentation or ergonomics,
  but a guarded fallback must keep the component correct and usable. Guard with
  `@supports` (CSS) or runtime feature detection (JS). Never the sole path to a
  required state.
- **Tier 3 — Avoid for core.** Not yet dependable enough across Cinder's support
  window to own behavior. Allowed only as a non-essential, fully-optional layer
  that degrades to nothing.

## Feature classification

| Feature                                                               | Tier       | Rule                                                                                                                                                                                                           | Owner doc               |
| --------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `@layer` (cascade layers)                                             | 1          | All component CSS lives in `@layer cinder.*`. Required — the layer order is the cascade contract.                                                                                                              | —                       |
| CSS Nesting                                                           | 1          | Use directly.                                                                                                                                                                                                  | —                       |
| `:has()`                                                              | 1          | Use directly for relational styling.                                                                                                                                                                           | —                       |
| Container queries (`@container`, `container-type`)                    | 1          | **Default** for component-owned responsive behavior. A component that reacts to its own inline size queries its own container.                                                                                 | `RESPONSIVE-POLICY.md`  |
| Viewport queries / `matchMedia`                                       | 1 (scoped) | Reserved for **viewport-owned** behavior only (app shells, drawers, modality switches). Using a viewport breakpoint for what is really a container constraint is a policy violation — the audit reports these. | `RESPONSIVE-POLICY.md`  |
| `<dialog>` + `showModal()`                                            | 1          | The modal baseline. Native top-layer and `inert` behavior, no manual app-wide inerting.                                                                                                                        | `OVERLAY-POLICY.md`     |
| `inert`                                                               | 1          | Use directly for scoped inerting.                                                                                                                                                                              | `OVERLAY-POLICY.md`     |
| `@starting-style`                                                     | 1          | Use directly for enter transitions; pair with a reduced-motion path.                                                                                                                                           | —                       |
| `text-wrap` (`balance`/`pretty`)                                      | 1          | Use directly — purely presentational, degrades to normal wrapping.                                                                                                                                             | —                       |
| `accent-color`                                                        | 1 (scoped) | Keep for native controls that retain native painting. Custom-painted controls (Checkbox, RadioGroup, Toggle) intentionally opt out.                                                                            | `NATIVE-FORM-POLICY.md` |
| `content-visibility`                                                  | 2          | Performance enhancement only; never gate visibility or correctness on it.                                                                                                                                      | —                       |
| `subgrid`                                                             | 2          | Allowed for nested alignment **with a fallback grid/flex layout**. Guard with `@supports (grid-template-columns: subgrid)`.                                                                                    | —                       |
| Popover API (`popover`, `showPopover`, `hidePopover`)                 | 2          | Native path for trigger-owned menus, guarded by runtime `showPopover` detection. Falls back to the shared anchored-overlay helper.                                                                             | `OVERLAY-POLICY.md`     |
| CSS Anchor Positioning (`anchor-name`, `position-anchor`, `anchor()`) | 2          | Progressive enhancement on top of the Popover-API path; guard with `@supports`. Never required for positioning correctness. Not used for virtual (pointer/caret/selection) anchors.                            | `OVERLAY-POLICY.md`     |
| `field-sizing: content`                                               | 2          | Textarea enhancement guarded by `@supports`; rows + resize is the fallback.                                                                                                                                    | `NATIVE-FORM-POLICY.md` |
| Native validation pseudo-classes (`:invalid`, `:user-invalid`)        | 2          | Low-priority fallback only. Explicit Cinder error state + `aria-invalid` always wins.                                                                                                                          | `NATIVE-FORM-POLICY.md` |
| `@scope`                                                              | 3          | Not adopted. `@layer` + class scoping covers our needs; revisit when support broadens.                                                                                                                         | —                       |

`light-dark()` and `color-mix()` are theming primitives governed by the token
system (`tokens-base.css` / `docs/theming.md`), not component-level feature
choices — components consume `--cinder-*` tokens rather than calling these
functions directly.

## The two rules every component author must internalize

1. **Container width, not viewport width.** If a component changes because _its
   own_ box is narrow, it must use a container query, not a viewport media query.
   Viewport queries are only for things the viewport genuinely owns. The
   documented exception is Sidebar's mobile Drawer switch (see
   `RESPONSIVE-POLICY.md`).
2. **Native top-layer over hand-rolled geometry.** Prefer `<dialog>` and the
   Popover API + Anchor Positioning over manual document listeners and Floating
   UI where the native primitive fits — but always behind the Tier-2 guards in
   `OVERLAY-POLICY.md`. Virtual anchors (pointer, caret, text selection) stay on
   the shared anchored-overlay helper with a Floating UI virtual element; CSS
   Anchor Positioning is intentionally not used for those.

## Enforcement

`bun run --filter=cinder platform:audit` reports current usage of every
classified feature and flags hard-coded viewport breakpoints in component CSS so
a reviewer can confirm each is viewport-owned (allowed) rather than a
container-constraint in disguise (a Tier-1 violation). The audit is a **report**,
not a hard gate: deliberate adoption is the goal, so the command surfaces usage
for human judgment rather than banning features outright. It runs in the
`validate` path so the inventory stays visible as the library grows.

When a new modern feature enters the codebase, add a row to the classification
table above (with its tier and rule) in the same change. A feature with no row is
unclassified and will be flagged in review.
