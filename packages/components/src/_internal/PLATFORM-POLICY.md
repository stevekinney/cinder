# Cinder Platform Feature Policy

**Container width, not viewport width. Native top-layer over hand-rolled
geometry.** Those are the two rules every component author must internalize (the
[full statements](#the-two-rules-every-component-author-must-internalize) are
below). This document is the classification system that backs them: it decides
which modern CSS and HTML feature carries correctness, which is progressive
enhancement, and which Cinder avoids for now — so components and their `.a11y.md`
files don't each re-litigate browser support.

It is the umbrella over three companion policies, which remain authoritative for
their domain: [`OVERLAY-POLICY.md`](./OVERLAY-POLICY.md) (`<dialog>`, Popover API,
CSS Anchor Positioning, `inert`, top-layer, focus, escape, scroll-lock),
[`RESPONSIVE-POLICY.md`](./RESPONSIVE-POLICY.md) (container vs. viewport queries),
[`NATIVE-FORM-POLICY.md`](./NATIVE-FORM-POLICY.md) (`field-sizing`, `accent-color`,
dialog forms, native validation pseudo-classes), and
[`../../../../docs/focus-ring-policy.md`](../../../../docs/focus-ring-policy.md)
(the focus-ring token recipe and forced-colors fallback).

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

`light-dark()` and `color-mix()` are deliberately absent from the table: they are
theming primitives owned by the token system (`tokens-base.css` / `docs/theming.md`),
not component-level feature decisions. A component must never `@supports`-detect or
call them directly — it consumes `--cinder-*` tokens and lets the token layer decide
how those resolve per theme.

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

## Development-only diagnostics

Component contract-misuse warnings — a missing required prop, an `id` that does
not match the wrapping `FormField`, a duplicate key, an unresolved portal target,
a deprecated import path — are diagnostics for the **developer building the app**,
never for the end user. They must route through `devWarn(...)` from
`utilities/dev-warn.ts`, which gates on `DEV` from `esm-env` and is dead-code-
eliminated from production bundles. A bare `console.warn` in component source
ships the warning string (and internal naming) to end users and is forbidden.

- **Rule:** no bare `console.warn` in `src/components/**` (`.svelte` or `.ts`).
  Use `devWarn(message, ...args)` instead. `devWarn` self-gates on `DEV`, so do
  **not** wrap it in `if (DEV) { … }` or add a `!DEV` early-return around it.
- **Don't keep a `$effect` alive solely to warn.** A reactive effect whose only
  job is to log re-subscribes on every state change for no runtime benefit. Warn
  from a plain guard at the point of misuse (e.g. right after the `$props()`
  destructure for a "missing required prop" check) unless the condition is
  genuinely reactive and a test asserts the warning fires on a specific change.
- **Enforcement:** `bun run check:no-bare-console-warn` (a scanned grep with an
  explicit allow-list, in the `lint` chain and CI) fails on any bare
  `console.warn` in component source. oxlint cannot express this rule because
  Svelte files are in its `ignorePatterns`.
