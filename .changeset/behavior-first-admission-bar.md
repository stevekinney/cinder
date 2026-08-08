---
'@lostgradient/cinder': patch
---

chore(tooling): behavior-first admission bar for new components (decision 8)

- The rule — a new component requires behavior, state, or accessibility
  semantics its parts don't already provide; layout/presentation variations
  become props, variants, or documented example presets — is now checklist
  entry `behavior-first-admission` in `component-conventions.ts`, mirrored to
  all four authoring-checklist copies, spelled out in `packages/components/
AGENTS.md` § Adding a new component, and recorded in
  `docs/decisions/component-admission-bar.md`.
- New `check:css-duplication` gate (a `lint:invariants` member, registered in
  the pipeline-coverage table): compares every component sidecar pairwise on
  a normalized declaration multiset (selectors dropped, private/component-
  scoped custom properties collapsed, at-rule context kept, compound
  families exempt) and fails on any ≥80% pair not recorded with a written
  reason in `css-duplication-baseline.json`. The baseline ships empty — the
  pre-merge Drawer/Sheet pair was exactly what it exists to catch.
- Still-open questions are recorded as `**Status:** Open` decision stubs so
  they aren't mistaken for settled: ColorField/ColorPicker output format,
  the `*Group`-vs-plural convention, and SideNavigation vs Sidebar.
  (Table/DataTable/DataGrid is NOT open — `docs/decisions/
tabular-families.md` already decides it.)
