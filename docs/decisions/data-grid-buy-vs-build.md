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
subset. The scope is mandated by the task: Requirement 21 in the plan
forces a single coherent grid component, not a stack of smaller primitives.
A smaller scope (for example, row-only virtual table) would unlock simpler
dependencies — but the user can revisit that only by editing the task,
not by relaxing this decision.

## Methodology and data source

Package metadata in this document was collected on **2026-05-23** with:

```bash
npm view <package> version license time.modified dist.unpackedSize \
                  peerDependencies dependencies repository.url
```

For every non-SPDX `license` field, the actual `LICENSE` (or `license.txt`)
file inside the published npm tarball was extracted with `npm pack <pkg>` and
read directly. Quoting the registry without checking the file is not enough
when the license value is `"SEE LICENSE IN LICENSE.txt"`.

The candidate pool came from:

- the four packages named directly in the task description and plan
  Requirement 5 (TanStack core, TanStack svelte adapters, AG Grid
  Community + Svelte binding, Glide DataGrid, Handsontable),
- an npm search pass with the queries `svelte datagrid`,
  `svelte data-grid`, `svelte spreadsheet`, `svelte virtual table`, and
  `svelte table virtualized`,
- a follow-up search for any Svelte-5-compatible candidate published in
  the last 18 months.

Every package surfaced by those searches and not excluded for clear cause
appears in this document either as a viable candidate, an excluded
candidate (with the reason), or a clearly-out-of-scope library (logged
once in the "Considered but excluded" section).

"Bundle size" in this document refers to `dist.unpackedSize` — the on-disk
size of the published tarball — as a **coarse comparative proxy**.
Browser-shipped weight must be measured from cinder's implementation bundle
after the approved path exists.

## License compatibility

cinder is consumed by downstream applications without a copyleft constraint
and ships its own MIT-style license. A grid dependency must be either MIT,
Apache-2.0, BSD, or ISC. A dependency with a non-OSS license, a
"free-for-personal-use" carveout, a commercial-use field-of-use restriction,
or a CLA gate cannot be added.

| Candidate                                                                                      | Manifest `license`           | Verdict                                                                                  |
| ---------------------------------------------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------- |
| Build inside cinder                                                                            | n/a                          | n/a — no third-party license                                                             |
| [`@tanstack/table-core`](https://www.npmjs.com/package/@tanstack/table-core) 8.21.3            | `MIT`                        | ✅ compatible                                                                            |
| [`@tanstack/virtual-core`](https://www.npmjs.com/package/@tanstack/virtual-core) 3.15.0        | `MIT`                        | ✅ compatible                                                                            |
| [`@tanstack/svelte-table`](https://www.npmjs.com/package/@tanstack/svelte-table) 8.21.3        | `MIT`                        | ✅ compatible                                                                            |
| [`@tanstack/svelte-virtual`](https://www.npmjs.com/package/@tanstack/svelte-virtual) 3.13.25   | `MIT`                        | ✅ compatible                                                                            |
| [`ag-grid-community`](https://www.npmjs.com/package/ag-grid-community) 35.3.0                  | `MIT`                        | ✅ compatible (Enterprise is a separate commercial package — feature gaps covered below) |
| [`ag-grid-svelte`](https://www.npmjs.com/package/ag-grid-svelte) 0.3.0                         | `MIT`                        | License OK, but binding abandoned (see freshness section)                                |
| [`@glideapps/glide-data-grid`](https://www.npmjs.com/package/@glideapps/glide-data-grid) 6.0.3 | `MIT`                        | License OK, but React-only (see fit)                                                     |
| [`handsontable`](https://www.npmjs.com/package/handsontable) 17.1.0                            | `SEE LICENSE IN LICENSE.txt` | ❌ non-OSS dual license with non-commercial-use clause (text quoted below)               |
| [`svelte-headless-table`](https://www.npmjs.com/package/svelte-headless-table) 0.18.3          | `MIT`                        | License OK, but >18 months stale and pre-Svelte-5                                        |
| [`@vincjo/datatables`](https://www.npmjs.com/package/@vincjo/datatables) 2.8.0                 | `MIT`                        | ✅ compatible (scope mismatch, see effort section)                                       |
| [`@revolist/svelte-datagrid`](https://www.npmjs.com/package/@revolist/svelte-datagrid) 4.21.11 | `MIT`                        | ✅ compatible (Svelte wrapper over a Stencil web component)                              |
| [`@svar-ui/svelte-grid`](https://www.npmjs.com/package/@svar-ui/svelte-grid) 2.6.2             | `MIT`                        | ✅ compatible (pulls in nine `@svar-ui/*` peer packages)                                 |

### Handsontable — exact license text

Confirmed by `npm pack handsontable@17.1.0` and reading `package/LICENSE.txt`
directly. The relevant blocking clauses, quoted verbatim:

> "This software is protected by applicable copyright laws, including
> international treaties, and dual-licensed - depending on whether your use
> for commercial purposes, meaning intended for or resulting in commercial
> advantage or monetary compensation, or not."
>
> "If your use is strictly personal or solely for evaluation purposes …
> you agree to be bound by the terms included in the
> `handsontable-non-commercial-license.pdf` file."
>
> "Your use of this software for commercial purposes is subject to the
> terms included in an applicable license agreement."
>
> "In any case, you must not make any such use of this software as to
> develop software which may be considered competitive with this software."

This is not an SPDX OSS license. Two clauses each independently rule it
out for cinder: (1) the non-commercial / commercial split means cinder
cannot promise downstream commercial apps a single license; (2) the
"competitive software" clause is incompatible with shipping a generic
data-grid component as part of an open design system, since cinder's
`DataGrid` could plausibly be characterized as competitive with
Handsontable.

### AG Grid Community vs Enterprise feature coverage

`ag-grid-community` 35.3.0 is MIT-licensed. `ag-grid-enterprise` is a
separately-licensed commercial package and is intentionally out of scope —
cinder cannot make any consumer install a commercial license. The
**Community** package covers the following Requirement 21 behaviors:

| Required behavior             | AG Grid Community                                                |
| ----------------------------- | ---------------------------------------------------------------- |
| Row virtualization            | ✅ Built-in (client-side row model)                              |
| Column virtualization         | ✅ Built-in                                                      |
| Inline cell editing (typed)   | ✅ Built-in (text, number, select editors; date via Date editor) |
| Single-column sort            | ✅ Built-in                                                      |
| Multi-column sort             | ✅ Built-in (Shift+click)                                        |
| Column resize                 | ✅ Built-in                                                      |
| Column reorder                | ✅ Built-in (drag reorder)                                       |
| Column pin (left/right)       | ✅ Built-in                                                      |
| Cell selection (single)       | ✅ Built-in                                                      |
| Range selection (rectangular) | ❌ **Enterprise-only** (Range Selection module)                  |
| Frozen header                 | ✅ Built-in                                                      |
| Spreadsheet keyboard nav      | ✅ Arrows, Home, End, PageUp/Down, Tab, Shift+Tab                |
| Shift+Arrow range extension   | ❌ **Enterprise-only** (depends on Range Selection)              |
| ARIA grid semantics           | ✅ `role="grid"` and `aria-*` attributes                         |

Range selection — both rectangular range and Shift+Arrow extension — is
an Enterprise feature in AG Grid. That is a hard block: cinder cannot
satisfy Requirement 21 on the Community license alone, and pulling in
Enterprise would force every cinder consumer to acquire an AG Grid
Enterprise license. AG Grid is therefore disqualified regardless of the
abandoned Svelte binding.

## Bundle-size impact

`dist.unpackedSize` values are **unpacked tarball size**, intentionally
larger than browser-shipped JS. Use only for relative comparison.

| Candidate                                                                                                                     | `dist.unpackedSize` (bytes) | Rough scale                                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------- |
| Build inside cinder (no dependency)                                                                                           | 0                           | shipped weight = cinder's implementation only                                                        |
| Build inside cinder + [`@tanstack/virtual-core`](https://www.npmjs.com/package/@tanstack/virtual-core) (**recommended path**) | 336,756 (virtual-core)      | ~330 KB unpacked; browser weight to measure in implementation gate                                   |
| [`@tanstack/table-core`](https://www.npmjs.com/package/@tanstack/table-core) 8.21.3                                           | 3,296,952                   | ~3.3 MB unpacked                                                                                     |
| [`@tanstack/virtual-core`](https://www.npmjs.com/package/@tanstack/virtual-core) 3.15.0                                       | 336,756                     | ~330 KB unpacked                                                                                     |
| [`@tanstack/svelte-table`](https://www.npmjs.com/package/@tanstack/svelte-table) 8.21.3                                       | 818,422                     | ~800 KB unpacked (types and ESM/CJS variants)                                                        |
| [`ag-grid-community`](https://www.npmjs.com/package/ag-grid-community) 35.3.0                                                 | 20,012,579                  | ~20 MB unpacked                                                                                      |
| [`@glideapps/glide-data-grid`](https://www.npmjs.com/package/@glideapps/glide-data-grid) 6.0.3                                | 3,662,455                   | ~3.7 MB unpacked                                                                                     |
| [`handsontable`](https://www.npmjs.com/package/handsontable) 17.1.0                                                           | 26,956,584                  | ~27 MB unpacked                                                                                      |
| [`@vincjo/datatables`](https://www.npmjs.com/package/@vincjo/datatables) 2.8.0                                                | 226,327                     | ~225 KB unpacked                                                                                     |
| [`@revolist/svelte-datagrid`](https://www.npmjs.com/package/@revolist/svelte-datagrid) 4.21.11                                | 84,582 (wrapper)            | wrapper only — plus [`@revolist/revogrid`](https://www.npmjs.com/package/@revolist/revogrid) runtime |
| [`@svar-ui/svelte-grid`](https://www.npmjs.com/package/@svar-ui/svelte-grid) 2.6.2                                            | 103,964 (wrapper)           | wrapper only — plus 9 [`@svar-ui/*`](https://www.npmjs.com/org/svar-ui) runtime packages             |

This decision intentionally does **not** compare vendor-advertised
minified browser weights. Those numbers vary by bundler, tree-shaking,
feature modules, and CSS inclusion. The only mechanically reproduced size
measurement in this decision is `dist.unpackedSize` from npm metadata; the
implementation checkpoint must measure the final cinder bundle delta from
the actual code path.

### Cinder shipped-weight target (unvalidated)

If the build path is approved, the **target budget** for cinder's grid
code (virtualization integration + selection + editing UI + keyboard
model + column ops + ARIA glue) is roughly **18–28 KB minified** before
any dependency contribution. This estimate is **not yet measured** — it is
a budget for the implementation gate, not a promise. The final design
checkpoint (`data-grid-implementation-design.md`) will record the measured
size and either confirm or surface the overrun.

## Headless-vs-styled fit

cinder is opinionated about its design system: every component has a CSS
sidecar consuming `--cinder-*` tokens, a generated schema, a generated
variables file, a generated README, generated examples, and a playground
example set that imports only from `cinder` and `cinder/<subpath>`. The
grid must fit that pattern without an asterisk.

| Candidate                                                                                                                                                                  | Styling model                                                                        | Fit                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build inside cinder                                                                                                                                                        | Native cinder CSS sidecar + tokens                                                   | ✅ Native — no adapter                                                                                                                                      |
| [`@tanstack/table-core`](https://www.npmjs.com/package/@tanstack/table-core) + [`@tanstack/virtual-core`](https://www.npmjs.com/package/@tanstack/virtual-core) (headless) | None — math and state only, you render                                               | ✅ Headless: render with cinder CSS, tokens, data attributes                                                                                                |
| [`@tanstack/svelte-table`](https://www.npmjs.com/package/@tanstack/svelte-table) + [`@tanstack/svelte-virtual`](https://www.npmjs.com/package/@tanstack/svelte-virtual)    | None — Svelte runes wrappers around the headless core                                | ✅ Same fit as core, idiomatic Svelte access                                                                                                                |
| [`ag-grid-community`](https://www.npmjs.com/package/ag-grid-community)                                                                                                     | Ships its own theme system (Quartz, Alpine) with AG-controlled CSS vars              | ⚠️ Two parallel theming systems. Disqualified above by Enterprise-only range selection.                                                                     |
| [`@glideapps/glide-data-grid`](https://www.npmjs.com/package/@glideapps/glide-data-grid)                                                                                   | Canvas rendering with a JS theme object, not CSS                                     | ❌ Bypasses cinder's CSS pipeline entirely — tokens, dark mode, density, focus rings, reduced motion all skipped                                            |
| [`handsontable`](https://www.npmjs.com/package/handsontable)                                                                                                               | Ships its own LESS-derived CSS                                                       | ❌ Even setting licensing aside, the styling model is its own world                                                                                         |
| [`@vincjo/datatables`](https://www.npmjs.com/package/@vincjo/datatables)                                                                                                   | Headless logic, BYO markup                                                           | ✅ Fit OK, but scope is far narrower than the task (see effort)                                                                                             |
| [`@revolist/svelte-datagrid`](https://www.npmjs.com/package/@revolist/svelte-datagrid)                                                                                     | Stencil web component (renders into shadow DOM), themed by CSS variables it controls | ❌ Shadow-DOM-rendered web component does not participate in cinder's CSS sidecar pipeline; styling is via the vendor's CSS-variable API, not cinder tokens |
| [`@svar-ui/svelte-grid`](https://www.npmjs.com/package/@svar-ui/svelte-grid)                                                                                               | Svelte components shipping their own SCSS and theme system                           | ⚠️ Vendor theme; nine transitive runtime packages would all need their CSS suppressed and re-skinned to cinder tokens                                       |

### Build inside cinder

cinder writes its own virtualization, column model, selection model,
editing model, and keyboard model. Composes from existing cinder primitives
(`focus-trap`, the planned `Portal`) where applicable. No vendor styling,
no vendor API on the public surface.

### Wrap headless primitives

cinder depends on `@tanstack/table-core` (column model, sort state, row
model) and `@tanstack/virtual-core` (row/column virtualization math), and
writes the rendered Svelte component, CSS sidecar, ARIA semantics, focus
model, editing UI, and keyboard handling. The vendor APIs stay internal;
consumers see only cinder props.

### Wrap styled grid package

cinder depends on a fully styled vendor grid (AG Grid, Glide, Handsontable,
revogrid, or `@svar-ui/svelte-grid`) and re-skins it to cinder tokens.
Consumers may still see vendor concepts depending on how much bleeds
through.

## Effort to wrap vs build

This compares the realistic engineering effort to deliver the **full
Requirement-21 feature set** under each path. "Risk" calls out the failure
modes that have to be designed around. The recommended path is bolded.

| Path                                                             | Up-front effort                                                                                                                                                                    | Ongoing effort                                                                       | Risk                                                                                                                                                                                                                                |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pure build inside cinder (no dependency)                         | High — virtualization math written from scratch alongside everything else. 6–9 focused PRs after the design checkpoint.                                                            | Medium                                                                               | Virtualization math edge cases (variable row heights, scroll snapping) are notoriously fiddly to get right.                                                                                                                         |
| **Build inside cinder + `@tanstack/virtual-core`** (recommended) | Medium-high — cinder writes the rendered grid, ARIA, selection, editing UI, column-ops UI, keyboard handling, CSS sidecar. Virtualization math is delegated. 5–8 focused PRs.      | Low-medium — virtual-core is headless, tightly scoped, MIT, and actively maintained. | One narrow vendor dependency. virtual-core's API shape will influence cinder's internal virtualization state — see "Trade-off" section below.                                                                                       |
| Wrap `@tanstack/table-core` + `@tanstack/virtual-core`           | Medium — vendor handles column/sort/row model and virtualization math. cinder writes rendering, ARIA, selection model, editing UI, column-ops UI, keyboard handling, CSS. 3–5 PRs. | Low-medium                                                                           | Vendor API surface bleeding into cinder types unless carefully isolated. Selection and editing aren't TanStack's strength — cinder writes them.                                                                                     |
| Wrap `@tanstack/svelte-table` + `@tanstack/svelte-virtual`       | Medium-low — as above plus idiomatic Svelte access                                                                                                                                 | Same as above plus dependency on adapter package velocity.                           | Svelte adapter packages historically lag the core; pin both each upgrade.                                                                                                                                                           |
| Wrap `ag-grid-community`                                         | n/a                                                                                                                                                                                | n/a                                                                                  | Disqualified — range selection is Enterprise-only. Adopting Enterprise forces a commercial license on every consumer.                                                                                                               |
| Wrap `@glideapps/glide-data-grid`                                | n/a                                                                                                                                                                                | n/a                                                                                  | Disqualified — React-only; cinder is Svelte 5. Would require a React runtime inside cinder.                                                                                                                                         |
| Wrap `handsontable`                                              | n/a                                                                                                                                                                                | n/a                                                                                  | Disqualified — non-OSS dual license + competitive-software clause.                                                                                                                                                                  |
| Wrap `@vincjo/datatables`                                        | Medium for what it covers                                                                                                                                                          | Low                                                                                  | **Scope mismatch**: does not virtualize columns, no spreadsheet keyboard, no range selection, no column pin/reorder/resize, no cell editing. Roughly 25% of Requirement 21.                                                         |
| Wrap `@revolist/svelte-datagrid` (over Stencil `revogrid`)       | Medium                                                                                                                                                                             | High                                                                                 | Shadow-DOM-rendered web component does not honor cinder's CSS sidecar; theming via vendor CSS variables. Cinder cannot reach into the shadow root to style cells with `--cinder-*` tokens. Vendor controls keyboard model and ARIA. |
| Wrap `@svar-ui/svelte-grid`                                      | Medium-low                                                                                                                                                                         | High                                                                                 | Pulls in 9 transitive `@svar-ui/*` packages and a vendor theme. Re-skinning to cinder tokens would mean overriding the vendor's SCSS-generated CSS for every cell state and fighting it on every minor release.                     |

### TanStack Table requirements-coverage matrix

Codex specifically asked: does TanStack Table reduce enough implementation
risk to be worth the API coupling? Here is what `@tanstack/table-core`
8.21.3 provides for each Requirement 21 behavior:

| Required behavior           | `@tanstack/table-core` provides                                             |
| --------------------------- | --------------------------------------------------------------------------- |
| Row virtualization          | ❌ (separate library — `virtual-core`)                                      |
| Column virtualization       | ❌ (separate library — `virtual-core`)                                      |
| Inline cell editing (typed) | ❌ (you write the editing model and UI)                                     |
| Single-column sort          | ✅ (sort state, sort comparators)                                           |
| Multi-column sort           | ✅ (multi-sort state, configurable sort comparators)                        |
| Column resize               | ⚠️ Partial — `columnSizing` state exists; you write the drag UI             |
| Column reorder              | ⚠️ Partial — `columnOrder` state exists; you write the drag UI              |
| Column pin (left/right)     | ⚠️ Partial — `columnPinning` state exists; you write the styling and layout |
| Cell selection              | ❌ (you write the cell-selection model)                                     |
| Range selection             | ❌ (you write range geometry, anchor, focus)                                |
| Frozen header               | ❌ (sticky layout is a render concern)                                      |
| Spreadsheet keyboard nav    | ❌ (you write the entire keyboard model)                                    |
| ARIA grid semantics         | ❌ (you write the rendering, so you write the ARIA)                         |

What `@tanstack/table-core` would actually save is sort state + sort
comparators (small) and three pieces of column state machinery
(`columnSizing`, `columnOrder`, `columnPinning`) where cinder would still
write the drag UI, the CSS layout, and the keyboard handlers. The
behaviors that drive most of the complexity (virtualization, selection,
range, editing, keyboard, ARIA) are not covered.

Conclusion: TanStack Table would save a few hundred lines of state
management in exchange for a ~3.3 MB unpacked dependency and a vendor
API surface to defend forever. Not worth it. virtual-core is a different
calculation — it solves the one piece of the build that genuinely
benefits from a tested library.

## Considered but excluded

Other packages that surfaced during the npm search and were ruled out
quickly with the reason:

| Package                                                                                    | Last published                | Reason                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------ | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`@mediakular/gridcraft`](https://www.npmjs.com/package/@mediakular/gridcraft) 0.2.9       | 2024-09-02                    | Stale (>20 months); Svelte 4 era                                                                                                                                        |
| [`another-svelte-data-grid`](https://www.npmjs.com/package/another-svelte-data-grid) 4.0.1 | 2023-12-09                    | Abandoned (>2 years)                                                                                                                                                    |
| [`sv-data-grid`](https://www.npmjs.com/package/sv-data-grid) 0.6.1                         | 2020-04-05                    | Abandoned (>5 years)                                                                                                                                                    |
| [`svelte-virtual-table`](https://www.npmjs.com/package/svelte-virtual-table) 2.0.3         | 2025-04-28                    | Virtualized table only — no editing, no range selection, no column ops; same scope-mismatch as [`@vincjo/datatables`](https://www.npmjs.com/package/@vincjo/datatables) |
| [`svelte-tiny-virtual-list`](https://www.npmjs.com/package/svelte-tiny-virtual-list) 3.0.1 | 2025-07-05                    | List virtualization only — not a grid                                                                                                                                   |
| [`svelte-virtual`](https://www.npmjs.com/package/svelte-virtual) 0.6.3                     | 2024-11-11 (~18.3 months old) | Just over the freshness threshold; superseded by TanStack virtual-core for our use                                                                                      |
| [`svelte-headless-table`](https://www.npmjs.com/package/svelte-headless-table) 0.18.3      | 2024-10-28 (~18.8 months old) | Just over the freshness threshold and pinned to Svelte 4 store APIs                                                                                                     |
| [`ag-grid-svelte`](https://www.npmjs.com/package/ag-grid-svelte) 0.3.0                     | 2023-07-06 (~35 months old)   | Abandoned; predates Svelte 5; no maintained successor                                                                                                                   |

### Svelte-native freshness rule

A Svelte-native package was treated as viable only if all of these held:

- license present in the manifest,
- Svelte 5 compatible (Svelte 5 listed as peer or proven by current usage),
- published within the last 18 months **or** repository activity within
  the last 12 months,
- no abandonment notice.

The day-precise deltas as of **2026-05-23**:
[`svelte-headless-table`](https://www.npmjs.com/package/svelte-headless-table)
572 days (~18.8 months),
[`svelte-virtual`](https://www.npmjs.com/package/svelte-virtual) 558 days
(~18.3 months),
[`ag-grid-svelte`](https://www.npmjs.com/package/ag-grid-svelte) 1052 days
(~34.6 months), [`@vincjo/datatables`](https://www.npmjs.com/package/@vincjo/datatables)
157 days (~5.2 months). Only
[`@vincjo/datatables`](https://www.npmjs.com/package/@vincjo/datatables),
[`@revolist/svelte-datagrid`](https://www.npmjs.com/package/@revolist/svelte-datagrid),
and [`@svar-ui/svelte-grid`](https://www.npmjs.com/package/@svar-ui/svelte-grid)
cleared the freshness bar; the first is scope-mismatched, the second
renders into shadow DOM, the third drags in a vendor theme + 9 transitive
packages.

## Recommendation

**Build inside cinder, with `@tanstack/virtual-core` as the one runtime
dependency for virtualization math.**

The reasoning, in order of weight:

1. **Every styled-grid wrap is blocked by something concrete, not just
   taste.** AG Grid needs Enterprise for range selection (commercial
   license cinder cannot impose); Glide is React-only; Handsontable is
   non-OSS with a competitive-software clause; revogrid renders into
   shadow DOM and bypasses cinder's CSS sidecar; `@svar-ui/svelte-grid`
   brings a vendor theme + 9 transitive packages to re-skin.
2. **No Svelte-native candidate covers Requirement 21.** The healthy ones
   (`@vincjo/datatables`, revogrid, svar-grid) each fail for a different
   reason above. The stale ones are stale.
3. **TanStack Table is a near-fit but only solves the small half.** The
   coverage matrix above shows it provides sort and partial column state
   — useful, but most of the work (virtualization, selection, range,
   editing, keyboard, ARIA, layout) is cinder's regardless. The dependency
   would cost more in defended API surface than it saves in code.
4. **`@tanstack/virtual-core` is the one piece of the build that genuinely
   benefits from reuse.** Virtualization math (visible-range computation,
   scroll-offset tracking, dynamic sizing) is the one piece where a
   battle-tested library reduces both up-front and ongoing risk
   significantly. It is headless (no rendering), MIT, ~330 KB unpacked, and
   actively maintained; the implementation gate must measure the actual
   browser bundle contribution from cinder's build.
5. **Single component, one dependency.** One sharp dependency is cheaper
   to defend than several vendor APIs.

### Trade-off: depending on virtual-core

Picking the recommended path is not free — it commits cinder to TanStack's
roadmap for the virtualization layer. Specifically:

- virtual-core's API shape (visible-item range, scroll behavior, item
  metrics) will influence cinder's internal virtualization state shape.
- For edge cases (dynamic row heights, scroll snapping, overscan tuning),
  the implementation will reflect virtual-core's assumptions.
- A future maintainer debugging virtualization will need virtual-core's
  documentation as well as cinder's source.
- A breaking change in virtual-core forces cinder to write the migration
  or fork.

This is acceptable because virtualization math is conceptually stable,
virtual-core is the de-facto standard in the React/Vue/Svelte ecosystem,
and the vendor surface stays internal to one folder of cinder's grid code.
But it is a commitment, not a free lunch.

### Why a single component instead of factoring

Requirement 21 mandates one component with virtualization, column ops,
editing, selection, and keyboard navigation. A smaller-scope path
(row-only virtual table; spreadsheet built separately) would unlock
`@vincjo/datatables` or even just `svelte-virtual` plus a handwritten
selection model. That smaller scope is a different ticket; this decision
does not relitigate it.

### Proposed shape if the user approves `build`

- `DataGrid` is a cinder component under
  `packages/components/src/components/data-grid/` with `role="grid"`,
  `aria-activedescendant` focus model, three column partitions
  (pinned-left, virtual center, pinned-right), controlled single-column
  sort with multi-sort opt-in, typed editor descriptors plus a custom
  editor snippet, spreadsheet keyboard model, and the standard cinder
  styling-state attributes (`data-cinder-active`, `-selected`, `-range`,
  `-editing`, `-invalid`, `-pinned`, `-frozen-header`, `-resizing`).
- The single new runtime dependency is `@tanstack/virtual-core`,
  consumed internally only — no vendor type, vendor event, or vendor
  configuration object on `DataGrid`'s public surface.
- All other Requirement-21 behavior is cinder code under cinder's tests
  and cinder's design tokens.

### Fallback if the user rejects `build`

If the user prefers to wrap instead, the only candidate this document
considers viable without further investigation is
**`@tanstack/table-core` + `@tanstack/virtual-core`** (headless wrap).
Every other wrap candidate is disqualified above. Picking the headless
wrap would also need a separate analysis pass on whether the column-state
savings justify the additional ~3.3 MB unpacked surface.

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

If wrapping is preferred instead, the approval format is
`APPROVED DATA GRID PATH: wrap` plus an `Approved package:` line naming
the headless-wrap pair.
