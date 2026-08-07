# Component admission bar

**Status:** Accepted 2026-08-05.

Decision: a new public component requires **behavior, state, or accessibility
semantics its parts do not already provide**. Pure layout or presentation
variations become props, variants, or documented example presets on the
primitive they wrap — not new components.

Chosen over a hard component-count ceiling (arbitrary; punishes genuinely
novel behavior) and over documentation with no gate — this repository's own
2026-08 review evidence is that documented conventions without tooling drift
(the marketing-section family reimplemented Card and Grid while the
composition guidance said not to).

## Enforcement

The bar is half-mechanical, half-human:

- **Mechanical**: `check:css-duplication` (a `lint:invariants` member) flags
  a component whose sidecar CSS closely duplicates another component's —
  the strongest cheap signal that a "new component" is a presentation
  variation. Known-similar pairs live in
  `packages/components/scripts/css-duplication-baseline.json` with a written
  reason each; a brand-new near-duplicate cannot be in the checked-in
  baseline, so it fails at PR time.
- **Human**: the behavior/state/accessibility-semantics half is decided in
  the required design review, recorded in the component's `*.a11y.md`
  (checklist items `human-design-review` and
  `novel-interaction-accessibility-review`).

The rule itself is entry `behavior-first-admission` in
`packages/components/scripts/component-conventions.ts` — the machine-readable
source the four authoring-checklist mirrors sync from.

## Precedents applying the bar

- 2026-08: ten marketing sections demoted to documented compositions
  (decision 3); `EventTimeline` deleted and `EventStreamViewer` folded into
  `Feed` (decision 4); `Sheet` merged into `Drawer` behind a `placement`
  prop (decision 6). `Feed.Boundary` was admitted under the bar — it owns
  `role="separator"` semantics its parts did not provide.
