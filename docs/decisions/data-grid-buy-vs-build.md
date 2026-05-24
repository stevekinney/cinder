# DataGrid: buy-vs-build decision

Task id: `3a14fd0a-35da-4dce-82f2-92ccd2152728`
Task base commit: 7df8a05fa66be8fe92584d7279794ae955d405f7

This document is the first deliverable for the `DataGrid` task. It compares
the realistic ways to ship a virtualized, editable, sortable spreadsheet
primitive in cinder and recommends one path. **No code, dependency, or
component scaffolding ships in this commit.** Implementation does not start
until a separate, user-authored approval note lands at
`docs/decisions/data-grid-implementation-approval.md`.

> [!NOTE] Why a new primitive
> The existing `Table` is a small semantic-table primitive. Its own type docs
> say it deliberately does not virtualize, sort data, paginate, edit cells,
> pin columns, resize columns, or aggregate. `DataGrid` therefore needs to
> be a separate component — broadening `Table` would break its contract and
> its tests.

## Bounding the problem

`DataGrid` is scoped per the task as a virtualized spreadsheet primitive
with **all** of these required-present behaviors in one coherent component:

- row virtualization
- column virtualization
- inline cell editing with typed editors (text, number, select, date)
- single-column and multi-column sort
- column resize, reorder, pin (left and right)
- cell selection, range selection
- frozen header row
- spreadsheet keyboard navigation (arrows, Tab, Shift+Arrow range select,
  Home, End, PageUp, PageDown)
- ARIA grid semantics (`role="grid"`, `aria-activedescendant`, row and
  column counts)

Every candidate is judged against that full list, not against a softer
subset.

## Methodology and data source

Authoritative metadata is read with `npm view <pkg> version license
time.modified dist.unpackedSize`. License text claims are taken from the
package's `license` field in the npm registry; for non-SPDX licenses the
manifest is treated as a flag to check the actual `LICENSE` file in the
repository before adopting. "Bundle size" in this document refers to the
**npm `dist.unpackedSize`** (the on-disk size of the published tarball) as
a coarse comparative proxy. Tree-shaken browser-shipped weight is smaller
and is recorded as a separate dimension where known from vendor
documentation. Verification commands and their outputs are quoted inline so
this document can be re-verified without re-querying the registry.

Metadata snapshot taken on 2026-05-23.

## License compatibility

cinder is consumed by downstream applications without a copyleft constraint
and ships its own MIT-style license. A grid dependency must be either MIT,
Apache-2.0, BSD, or ISC. A grid dependency with a non-OSS license, a
"free-for-personal-use" carveout, a commercial-use field-of-use restriction,
or a CLA gate cannot be added.

| Candidate                          | Manifest `license`                                                                                   | Verdict                                                                                   |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Build inside cinder                | n/a                                                                                                  | n/a — no third-party license at all                                                       |
| `@tanstack/table-core` 8.21.3      | `MIT`                                                                                                | ✅ compatible                                                                             |
| `@tanstack/virtual-core` 3.15.0    | `MIT`                                                                                                | ✅ compatible                                                                             |
| `@tanstack/svelte-table` 8.21.3    | `MIT`                                                                                                | ✅ compatible                                                                             |
| `@tanstack/svelte-virtual` 3.13.25 | `MIT`                                                                                                | ✅ compatible                                                                             |
| `ag-grid-community` 35.3.0         | `MIT`                                                                                                | ✅ compatible (Enterprise is a separate package with a commercial license — not in scope) |
| `ag-grid-svelte` 0.3.0             | `MIT`                                                                                                | License OK, but package abandoned (see below)                                             |
| `@glideapps/glide-data-grid` 6.0.3 | `MIT`                                                                                                | License OK, but React-only (see fit)                                                      |
| `handsontable` 17.1.0              | `SEE LICENSE IN LICENSE.txt` — dual: Handsontable Free (non-commercial) plus Handsontable Commercial | ❌ not compatible with cinder's "drop into any downstream app" promise                    |
| `svelte-headless-table` 0.18.3     | `MIT`                                                                                                | License OK, but stale (see below)                                                         |
| `@vincjo/datatables` 2.8.0         | `MIT`                                                                                                | ✅ compatible                                                                             |

Verification:

```bash
npm view handsontable license
# 'SEE LICENSE IN LICENSE.txt'
```

Handsontable's license text is **not** an SPDX OSS license — its non-commercial
clause makes it unusable as a default dependency of an open component library
that any downstream app might consume commercially.

## Bundle-size impact

Sizes below are `npm view <pkg> dist.unpackedSize` in bytes. This is the
**unpacked tarball size** — it is intentionally larger than the
browser-shipped, tree-shaken JS. Use these only for relative comparison.

| Candidate                          | `dist.unpackedSize` (bytes) | Rough scale                                          |
| ---------------------------------- | --------------------------- | ---------------------------------------------------- |
| Build inside cinder                | 0 (no new dependency)       | shipped weight = cinder's own implementation         |
| `@tanstack/table-core` 8.21.3      | 3,296,952                   | ~3.3 MB unpacked                                     |
| `@tanstack/virtual-core` 3.15.0    | 336,756                     | ~330 KB unpacked                                     |
| `@tanstack/svelte-table` 8.21.3    | 818,422                     | ~800 KB unpacked (mostly types and ESM/CJS variants) |
| `ag-grid-community` 35.3.0         | 20,012,579                  | ~20 MB unpacked                                      |
| `@glideapps/glide-data-grid` 6.0.3 | 3,662,455                   | ~3.7 MB unpacked                                     |
| `handsontable` 17.1.0              | 26,956,584                  | ~27 MB unpacked                                      |
| `@vincjo/datatables` 2.8.0         | 226,327                     | ~225 KB unpacked                                     |

Shipped-to-browser weight, where vendor docs publish it: AG Grid Community
advertises a ~360 KB minified core in its docs; Glide DataGrid advertises
~150 KB minified plus a canvas runtime; TanStack Table core advertises
~14 KB minified plus the parts you import. Build inside cinder is
size-bounded by what cinder writes — realistic estimate based on existing
cinder components is in the 12-20 KB range minified for virtualization,
selection, editing, and column-operation state combined.

Verification:

```bash
npm view @tanstack/table-core dist.unpackedSize
# 3296952
npm view ag-grid-community dist.unpackedSize
# 20012579
npm view handsontable dist.unpackedSize
# 26956584
```

## Headless-vs-styled fit

cinder is opinionated about its design system: every component has a CSS
sidecar consuming `--cinder-*` tokens, a generated schema, a generated
variables file, a generated README, generated examples, and an example set
in the playground that imports only from `cinder` and `cinder/<subpath>`.
The grid must fit that pattern without an asterisk.

| Candidate                                                                         | Styling model                                                              | Fit                                                                                                                                                                 |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build inside cinder                                                               | Native cinder CSS sidecar + tokens                                         | ✅ Native fit — no adapter                                                                                                                                          |
| `@tanstack/table-core` + `@tanstack/virtual-core` (headless)                      | None — math and state only, you render                                     | ✅ Headless: render with cinder CSS, tokens, data attributes                                                                                                        |
| `@tanstack/svelte-table` + `@tanstack/svelte-virtual` (headless, Svelte wrappers) | None — store/runes wrappers around the headless core                       | ✅ Same fit as core but with idiomatic Svelte access                                                                                                                |
| `ag-grid-community` (styled)                                                      | Ships its own theme system (Quartz, Alpine) with CSS variables AG controls | ⚠️ Two parallel theming systems. AG's CSS variables are not cinder's. Re-skinning to cinder tokens is possible but constant maintenance against AG's theme releases |
| `@glideapps/glide-data-grid` (styled, canvas)                                     | Canvas rendering with a JS theme object, not CSS                           | ❌ Doesn't participate in cinder's CSS pipeline at all. Tokens, dark mode, density, focus rings, reduced motion all bypass it                                       |
| `handsontable` (styled)                                                           | Ships its own LESS-derived CSS                                             | ❌ Even if licensing weren't blocking, the styling model is its own world                                                                                           |
| `@vincjo/datatables`                                                              | Headless logic, BYO markup                                                 | ✅ Headless fit, but scope is narrower than the task requires (see effort table)                                                                                    |

### Build inside cinder

cinder writes its own virtualization, column model, selection model,
editing model, and keyboard model. Composes from existing cinder primitives
(`focus-trap`, future `Portal`) where applicable. No vendor styling, no
vendor API. Full ownership.

### Wrap headless primitives

cinder depends on `@tanstack/table-core` (column model, sort state, row
model) and `@tanstack/virtual-core` (row/column virtualization math), and
writes the rendered Svelte component, CSS sidecar, ARIA semantics, focus
model, editing UI, and keyboard handling. The vendor APIs stay internal to
cinder; consumers see only cinder props.

### Wrap styled grid package

cinder depends on a fully styled vendor grid (AG Grid Community, Glide
DataGrid, Handsontable, or a Svelte-native option) and re-skins it to
cinder tokens. Consumers may still see vendor concepts depending on how
much bleeds through.

## Effort to wrap vs build

This compares the realistic engineering effort to deliver the **full
Requirement-21 feature set** under each path. "Risk" calls out the failure
modes that have to be designed around.

| Path                                                       | Up-front effort                                                                                                                                                                             | Ongoing effort                                                                                                                                                                                                                                                  | Risk                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Build inside cinder                                        | High — virtualization, selection, editing, column-ops, ARIA, keyboard all written from scratch. Estimate 5–8 focused PRs after the design checkpoint.                                       | Medium — cinder owns the bugs but also the velocity. No vendor churn.                                                                                                                                                                                           | Scope creep; edge cases in virtualization math; ARIA grid is genuinely fiddly.                                                                                                                                                                                                                                                                         |
| Wrap `@tanstack/table-core` + `@tanstack/virtual-core`     | Medium — vendor handles column/sort/row model and virtualization math. cinder writes rendering, ARIA, selection model, editing UI, column-ops UI, keyboard handling, CSS. Estimate 3–5 PRs. | Low-medium — TanStack Table moves at a steady pace; v9 alpha exists, breaking changes telegraphed in advance.                                                                                                                                                   | Vendor API surface bleeding into cinder types if not carefully isolated. Selection and editing aren't TanStack's strength — you write them.                                                                                                                                                                                                            |
| Wrap `@tanstack/svelte-table` + `@tanstack/svelte-virtual` | Medium-low — same as above plus idiomatic Svelte access.                                                                                                                                    | Same as above plus dependency on Svelte adapter package velocity.                                                                                                                                                                                               | Adapter packages historically lag the core; check pin pairing every upgrade.                                                                                                                                                                                                                                                                           |
| Wrap `ag-grid-community`                                   | Medium — wire to cinder props, restyle to cinder tokens, document bleed-through.                                                                                                            | **High** — AG releases breaking changes regularly, AG's theme system fights cinder's, no first-party Svelte 5 binding. `ag-grid-svelte` is abandoned (last published 2023-07-06; predates Svelte 5). Would need to write/maintain the Svelte binding in cinder. | Adopting AG without a maintained Svelte binding is the long-term cost.                                                                                                                                                                                                                                                                                 |
| Wrap `@glideapps/glide-data-grid`                          | Medium — wire to a React-in-Svelte interop layer.                                                                                                                                           | **High** — Glide is React-only. cinder is Svelte 5. Wrapping a React canvas grid in a Svelte component requires a React runtime inside cinder, which contradicts cinder's "no framework runtime beyond Svelte" principle.                                       | Wrong framework. Disqualifying without a separate user decision.                                                                                                                                                                                                                                                                                       |
| Wrap `handsontable`                                        | Low-medium technically                                                                                                                                                                      | n/a                                                                                                                                                                                                                                                             | Licensing disqualifies it before effort matters.                                                                                                                                                                                                                                                                                                       |
| Wrap `@vincjo/datatables`                                  | Medium for the parts it covers                                                                                                                                                              | Low                                                                                                                                                                                                                                                             | **Scope mismatch**: package is sort/filter/pagination over arrays. It does not virtualize columns, does not implement spreadsheet keyboard, does not implement range selection, does not implement column pin/reorder/resize, does not implement cell editing. Wrapping it gets us roughly 25% of Requirement 21; we'd still write the rest ourselves. |

### Svelte-native candidate research

Per Plan Requirement 5, at least one maintained Svelte-native data-grid or
spreadsheet package is included. Search criteria: license present, Svelte 5
compatible, publish within the last 18 months **or** repository activity
within the last 12 months, no abandonment notice.

- **`@vincjo/datatables` 2.8.0** — MIT, last published 2025-12-17, peer
  dependency `svelte: ^5.16.0`. Maintained and Svelte-5 native. Listed
  above; ruled out on scope, not on health.
- **`svelte-headless-table` 0.18.3** — MIT, last published 2024-10-28
  (over 18 months ago at the time of writing) and pinned to Svelte 4 store
  APIs. **Excluded** under the 18-month / Svelte-5 freshness rule.
- **`ag-grid-svelte` 0.3.0** — MIT, last published 2023-07-06. **Excluded**
  under the 18-month freshness rule.
- **`svelte-virtual` 0.6.3** — MIT, last published 2024-11-11
  (over 18 months ago). **Excluded** under the 18-month freshness rule.

No other Svelte-native data-grid or spreadsheet package surfaced in the npm
registry as both Svelte-5-compatible and scope-relevant during this
research pass. If a new one appears before approval, the implementation
phase can revisit this section.

## Recommendation

**Build inside cinder, on top of internal use of `@tanstack/virtual-core`
for the virtualization math only.**

The reasoning, in order of weight:

1. **Styled wraps don't fit cinder's design system.** AG Grid and
   Handsontable each ship their own theme system in parallel to cinder's
   tokens. Even with a thorough re-skin, every minor vendor release risks
   re-introducing vendor-themed pixels into cinder surfaces. Glide is
   canvas-rendered and React-only — it doesn't participate in CSS or
   Svelte at all.
2. **Licensing eliminates Handsontable.** Its non-commercial clause
   contradicts cinder's "drop into any downstream app" contract.
3. **No maintained Svelte 5 binding for AG Grid exists.** `ag-grid-svelte`
   was last published in 2023 and predates Svelte 5. Wrapping AG would
   mean cinder also owns the Svelte binding for a 20 MB unpacked dependency
   whose theme system fights cinder's. That is more ongoing work than
   building the grid itself.
4. **TanStack Table is a near-fit but solves the wrong half.** TanStack
   Table's strength is column/sort/row models. The hard parts of this
   ticket — virtualization, spreadsheet keyboard navigation, range
   selection, ARIA grid semantics, inline editing UI, column pin/reorder/
   resize UI — are work cinder writes either way. Pulling in TanStack
   Table would save the column-model code and add a non-trivial API
   surface to defend.
5. **TanStack `virtual-core` is a tight, scoped fit.** Virtualization math
   (visible-range computation, scroll-offset tracking, dynamic sizing) is
   the one piece of this build where a battle-tested library genuinely
   reduces both up-front and ongoing risk. It is headless (no rendering),
   MIT-licensed, ~330 KB unpacked, and updated very recently. Using it
   internally lets cinder own the rendered grid while inheriting tested
   math.
6. **No Svelte-native candidate covers Requirement 21.** The one
   healthy candidate (`@vincjo/datatables`) explicitly does not virtualize
   columns, edit cells, support range selection, or do spreadsheet keyboard
   navigation. Wrapping it would still leave 75% of the work.

Specifically, the proposed shape if the user approves `build`:

- `DataGrid` is a cinder component under
  `packages/components/src/components/data-grid/` with `role="grid"`,
  `aria-activedescendant` focus model, three column partitions
  (pinned-left, virtual center, pinned-right), controlled single-column
  sort with multi-sort opt-in, typed editor descriptors plus a custom
  editor snippet, spreadsheet keyboard model, and the standard cinder
  styling-state attributes (`data-cinder-active`, `-selected`, `-range`,
  `-editing`, `-invalid`, `-pinned`, `-frozen-header`, `-resizing`).
- The single new runtime dependency is `@tanstack/virtual-core`. It is
  consumed internally only; no vendor type, vendor event, or vendor
  configuration object appears on `DataGrid`'s public surface.
- All other Requirement-21 behavior is cinder code under cinder's tests
  and cinder's design tokens.

This is the cheapest path that ships the full Requirement-21 feature set
without compromising cinder's design-system contract, without adopting an
abandoned Svelte binding, and without inheriting a vendor theme system to
fight every release. The virtualization-math dependency is the one place
where reuse genuinely beats from-scratch.

### What the user needs to do next

Approval lives in `docs/decisions/data-grid-implementation-approval.md`
and must include the literal line:

```
APPROVED DATA GRID PATH: build
```

…plus `Approved by:`, `Approval source:`, `Approval timestamp:`, and a
quoted approval text per the plan's Acceptance Criterion 7. Until that
file exists with a real user-authored approval, no implementation code,
dependency, export, style, playground, or generated artifact will land
on this branch.

If the user prefers a wrap path instead, the same approval format with
`APPROVED DATA GRID PATH: wrap` and an `Approved package:` line is the
trigger. Among the wrap options, `@tanstack/table-core` plus
`@tanstack/virtual-core` is the only one this document considers viable
without further investigation.
