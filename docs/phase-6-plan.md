# Plan: Port chat, diff-viewer, review-editor from depict into cinder

## Context

Cinder's Phase 5 deliberately deferred three depict components — `chat`, `diff-viewer`, `review-editor` — because their dependency graphs reach into `@depict/markdown`, `@depict/commentary`, `@depict/editor`, and a small piece of `conversationalist`. The user's directive: port all three. No deferrals.

This forces three things at once:

1. **A boundary policy change.** `COMPONENT-COVERAGE-PLAN.md` currently lists markdown rendering, diff viewer, and review editor as **out of scope**. The user has confirmed we update the boundary doc to admit a new "domain-suite" tier that lives alongside primitives and experimental, exempt from the primitives-only rule.
2. **Four new workspace packages.** `@cinder/markdown` (full port — 18 npm deps inherited), `@cinder/diff` (line-diff facade), `@cinder/editor` (ProseMirror/Milkdown integration), `@cinder/commentary` (threads + anchoring + export). Plus the npm `conversationalist` dep.
3. **Eight new component subpaths in `cinder`.** Three target components (`cinder/chat`, `cinder/diff-viewer`, `cinder/review-editor`) plus five siblings their imports require (`cinder/markdown-editor`, `cinder/selection-popover`, `cinder/view-switcher`, `cinder/diff-statistics`, `cinder/segmented-control`) and one tiny primitive (`cinder/surface`). Every component ships a playground demo in the same phase.

Distribution: subpath imports only. Bundlers tree-shake so consumers using only `cinder/button` don't pay for ProseMirror or remark. Install size grows; runtime cost does not.

---

## Architectural decisions (locked)

- **Boundary update.** Add a third tier to `COMPONENT-COVERAGE-PLAN.md`: `cinder/<name>` domain-suite components, admitted under a separate rule (downstream demand from at least one of the three reference consumers + heavy peer-dep acceptance). Carve-out is **scoped by allowlist**, not blanket: `convention.test.ts` gets a hard-coded set of component names (`chat`, `diff-viewer`, `review-editor`, `markdown-editor`) permitted to carry `<style>` blocks and co-located `.css` files. New domain-suite components added later require an explicit allowlist update. Removal criteria: a component leaves the allowlist when its CSS migrates to a partial under `src/styles/components/`.
- **API parity target.** Each ported component's **public surface** (props, events, slots, snippet contracts, named exports from `index.ts`) is **depict-compatible**: a depict consumer migrating to cinder must be able to swap `import {…} from '@depict/components/<name>'` to `import {…} from 'cinder/<name>'` without changing call sites. Internal renames (`cn` → `classNames`) do not surface publicly. Intentional deviations require an explicit entry in `tmp/port-deviations.md` per phase. CSS variable names exposed as part of the public API are renamed `--depict-*` → `--cinder-*` (this is a public deviation, documented).
- **`@cinder/diff` resolved.** `depict/packages/markdown/src/diff/line-diff.ts` will be read in D-1 inventory. If it depends on `pipeline/` (the unified/remark stack), `@cinder/diff` becomes a re-export facade over `@cinder/markdown/diff/line-diff` — same package boundary, but consumers don't pull `unified` if they only need diff types. If standalone, `@cinder/diff` is a separate package with `diff-match-patch` as its only dep. **The decision is made in D-1 before any package scaffolding starts**, not mid-D1.
- **Build strategy for the four new packages.** `Bun.build` for runtime ESM + `tsc --emitDeclarationOnly` for declarations. Each package `"private": true` and `"sideEffects": false` (CSS files imported by Svelte components are flagged in the components package, not in the libraries). Structure compatible with future publish.
- **Naming pass: scoped codemod, not broad rewrite.** The codemod handles only structurally safe rewrites: `import { cn } from '...'` → `import { classNames } from '...'`, `cn(` callsites → `classNames(`, and `--depict-*` CSS custom properties → `--cinder-*`. Identifier renames like `pkg` → `packageJson` and `repo` → `repository` are **manual per file** with a reviewer pass — they're risky in fixtures, serialized keys, and unrelated local semantics, and the depict source's actual usage of those abbreviations needs to be classified case by case.
- **CSS token mapping is explicit, not assumed.** Before any styled component is ported (D-1 deliverable), build a token mapping table at `tmp/css-token-map.md`: every `--depict-*` token used by the three target components and their five siblings, mapped to either an existing `--cinder-*` token, a new `--cinder-*` token to add, or an explicit "no equivalent — restyle" decision. The codemod consumes this table.
- **Tests migrated from vitest to bun:test by category, not mechanically.** Each test file gets classified: pure unit (port verbatim), DOM-dependent (port + wire happy-dom), SSR (port + adapter-node), interaction (port + verify with bun:test's user-event equivalent or @testing-library/svelte already in cinder), large-input/perf (drop on initial port but keep at least **one representative regression test** per heavy package: large-diff for `@cinder/markdown`, long-chat for `cinder/chat`, long-document for `cinder/review-editor`).
- **SSR strategy is import-time-safe, not just runtime-safe.** Every browser-only import (`@milkdown/kit`, anything touching `document`/`window`/`getBoundingClientRect`) is loaded via dynamic `import()` inside `$effect` or `onMount`, never as top-level static imports. D-1 inventory produces a per-file list of browser-only import sites that the porter must rewrite. The D5 SSR fixture (C8) is _confirmation_, not discovery.
- **Parallelization is disjoint-only, no redundant tracks.** Workers parallelize when their file sets are truly disjoint (e.g., W7 chat ⊥ W8 diff-viewer). Codex-workers handle independent sub-tasks (codemod, demos, fixture tests) — **not duplicate implementations of code another worker is producing**. The D1 dual-implementation of `@cinder/markdown` config (C1) and the D5 dual-implementation of `review-editor-state.svelte.ts` (C7) are removed; reconciliation overhead exceeds the value.
- **review-editor's missing siblings ship as separate top-level cinder components, not inlined.** Four siblings ship in D3 alongside `@cinder/commentary`; `markdown-editor` ships in **D4** (revised from D5 per D-1 inventory: chat's `chat-input.svelte` imports `MarkdownEditor` directly, so D4 cannot ship chat without it).
- **D3 scope widens** to include cinder primitive extensions identified by D-1's compatibility matrix: `Button` adds `'ghost-danger'` variant; `Badge` adds `'accent'` and `'xs'`; `Kbd` adds `label` and `size` props; `Card` verifies `description` on title-variant; **Dropdown compound family** ships as 5 new additive primitives (`DropdownTrigger`, `DropdownMenu`, `DropdownItem`, `DropdownLabel`, `DropdownSeparator`) alongside cinder's existing snippet-based `Dropdown`. Estimated +200–400 LOC. All additive; no breaking change to existing cinder primitives.
- **`@cinder/diff` is standalone** (resolved by D-1 reading line-diff.ts). `line-diff.ts` imports only `diff-match-patch`; no `pipeline/`/`unified` dependency. Standalone package, one dep. `@cinder/markdown/diff/line-diff` becomes a re-export from `@cinder/diff`.
- **`Dropdown` compound API choice**: option (a) — additive primitives in cinder. Cinder's existing snippet-based `Dropdown` stays; the compound parts ship as new sibling primitives matching depict's idiom. Rejected (b) adapter-shim-in-ported-components (heavy at port time, repeated 4× in review-editor's `comment-sidebar.svelte` alone) and (c) replace cinder's existing API (breaking change, ruled out).
- **Test runner delta**: depict tests use `vitest-browser-svelte` (real browser via Playwright); cinder uses `@testing-library/svelte` + happy-dom under `bun:test`. Per-test migration: `page.getByRole(...)` → `screen.getByRole(...)`; `page.locator(...).click()` → `fireEvent.click(...)`; visual/screenshot tests dropped on initial port. Patterns captured in `tmp/port-inventory/test-classification.md`.

---

## Phase decomposition

Seven phases. **D-1 freezes the inventory and architectural decisions before any code lands.** D0 only changes documents (no workspace topology changes — those happen inside D1 once `@cinder/markdown` is proven to build). The dep graph forces three serial bands; everything else parallelizes.

### Phase D-1 — Inventory freeze + decision lock-down (serial, integration owner)

No code, no document changes that affect repository state. Read-only investigation that produces five artifacts under `tmp/port-inventory/`. Half-day to one day.

**Artifacts produced (all under `tmp/port-inventory/`):**

1. **`dependency-graph.md`** — exhaustive transitive depict-local dependency graph for `chat`, `diff-viewer`, `review-editor`. Every imported file, style asset, fixture, and runtime asset (icons, fonts) the three components reach. Output: file-by-file list grouped by ownership (`@depict/components` internal, `@depict/markdown`, `@depict/commentary`, `@depict/editor`, third-party). Closes Issue 1 from review.

2. **`compatibility-matrix.md`** — for every cinder primitive the three components reuse (`button`, `card`, `alert`, `empty-state`, `input`, `dropdown`, `kbd`, `badge`, `spinner`, plus the four `_internal/*` contracts), compare:
   - Depict's call-site usage: props passed, events listened, slots filled, snippet contracts.
   - Cinder's current public surface for that primitive.
   - Delta: missing props, renamed events, contract differences.
   - Resolution: "compatible as-is", "needs cinder primitive extension (in scope, file an additional task)", or "needs adapter shim in the ported component". Closes Issue 2.

3. **`css-token-map.md`** — every `--depict-*` token referenced by the three components and their five siblings, mapped to existing `--cinder-*`, new `--cinder-*` to add, or "restyle". Closes Issue 8.

4. **`browser-only-imports.md`** — per-file list of every import site that touches `document`/`window`/`getBoundingClientRect`/`@milkdown/kit`/`prosemirror-*`. Marks each site as "already deferred via $effect/onMount in depict source", "needs rewrite to dynamic import on port", or "module-level OK (no browser globals)". Closes Issue 10.

5. **`version-matrix.md`** — for every new npm dep (`unified`, `remark-*`, `rehype-*`, `shiki`, `@milkdown/kit`, `prosemirror-view`, `diff-match-patch`, `conversationalist`, `js-yaml`, `comlink`, etc.), record: depict's pinned version, latest stable, peer-range constraints, conflicts with cinder's existing deps. Pin selection is recorded as a `dependencies` map ready to paste into `packages/markdown/package.json` etc. Closes Issue 14.

**Decision lock-down (in this phase, before D0):**

- `@cinder/diff` shape resolved by reading `depict/packages/markdown/src/diff/line-diff.ts`. Result documented in `dependency-graph.md` as "facade over `@cinder/markdown/diff`" or "standalone package".
- API parity target confirmed: depict-compatible public surface; deviations live in `tmp/port-deviations.md`.

**Gate D-1:** All five artifacts written and reviewed by user. No repository state changed.

### Phase D0 — Admission doc + roadmap update (serial, integration owner; doc-only)

Document changes only. **No package.json, no workspaces, no lint-staged, no validate scripts changed.** Those move to D1 (gated on `@cinder/markdown` actually building). This addresses Issue 3: D0 cannot break the repo because it changes no executable contract.

- Update `/Users/stevekinney/Developer/cinder/COMPONENT-COVERAGE-PLAN.md`:
  - Add "domain-suite" admission tier with **scoped allowlist** (`chat`, `diff-viewer`, `review-editor`, `markdown-editor`).
  - Move `Markdown Renderer`, `Diff Viewer`, `Review Editor` rows out of "out of scope" into the new tier.
  - Document the per-component `<style>`/`.css` exemption with the allowlist and removal criteria.
- Add Phases D1–D5 to `/Users/stevekinney/Developer/cinder/ROADMAP.md` referencing this plan's gates, deviations file, and rollback strategy.

**Gate D0:** `bun run validate` still green (only doc changes; nothing to break).

---

### Phase D1 — Foundational packages: `@cinder/markdown` + `@cinder/diff` (parallel) + workspace widening (gated)

No `@cinder/*` deps; no Svelte. Workspace plumbing happens **inside this phase, after the new packages typecheck and build cleanly** — not before. This sequencing means `bun install` and root validate never see a broken intermediate state.

**Sequence within D1 (intra-phase order):**

1. **D1a — Scaffold packages on a feature branch, no root edits yet.** Two parallel leaf workers in worktrees:
   - **W1:** scaffold `packages/markdown/`. Copy `depict/packages/markdown/src/{pipeline,diff,rendering,utilities}` verbatim. Mirror its 10-subpath `exports` map, swap `@depict/markdown` → `@cinder/markdown`. Pin npm deps from `tmp/port-inventory/version-matrix.md`. Migrate tests by category per `tmp/port-inventory/test-classification.md` (kept round-trip + edge-cases as unit; one large-input regression test retained). No `cn` rename needed.
   - **W2:** scaffold `packages/diff/` per the D-1 lock-down decision (facade or standalone — already resolved).
2. **D1b — Build and typecheck in isolation.** Each package's own `bun run validate` (lint + typecheck + test + build) passes against its own `tsconfig`. Run from inside the package directory; root workspace not yet wired.
3. **D1c — Smoke harness build.** A standalone `.ts` file at `tmp/port-smoke/` imports from every `@cinder/markdown` subpath and runs `bun build` against it with no workspace context. Validates that the npm dep set resolves cleanly.
4. **D1d — Integration owner widens workspace.** Only after D1a–D1c pass: edit root `package.json` `workspaces` to add the new paths, regen `bun.lock`, update root `lint-staged` globs, update `scripts.validate` to fan out across `--filter='*'`. Verify `bun run validate` green at root.

- **C1 (codex-worker, low effort):** writes the test-classification document under `tmp/port-inventory/test-classification.md` from the depict source: per-test-file category tag (unit / DOM / SSR / interaction / perf). Used by W1 and later workers. **Replaces the previous redundant config-shape duplicate** (Issue 13).

**Rollback signal D1:** if D1c (smoke harness) fails to resolve the npm dep set, **stop**. Revert: delete `packages/markdown/`, `packages/diff/`, the worktrees. The `bun.lock` and root `package.json` are not yet touched (D1d hasn't run), so revert is local. The plan is paused; user decides whether to re-pin versions, drop scope, or abort.

**Package skeleton template (used here and in D2/D3):**

```
packages/<name>/
  package.json                # exports map mirrors depict; sideEffects:false; private:true
  tsconfig.json               # extends ../../tsconfig.base.json; paths: { "@/*": ["./src/*"] }
  tsconfig.build.json         # declaration:true, emitDeclarationOnly:true, outDir:./dist
  tsconfig.check.json         # noEmit pass mirror
  scripts/build.ts            # Bun.build (esm/browser, external @cinder/* + svelte) + tsc decls
  src/index.ts                # barrel
  src/<feature>/...           # ported source
  src/<feature>/<name>.test.ts # bun:test, colocated
  bunfig.toml                 # only if happy-dom preload needed (commentary/editor)
```

**Gate D1:**

- `bun run --filter='@cinder/markdown' validate` green.
- `bun run --filter='@cinder/diff' validate` green.
- `bun run validate` at root still green (after D1d wires workspaces).
- Smoke harness builds with no missing peer deps.
- One large-input regression test passes per `@cinder/markdown` (large-diff fixture).
- Committee-review + codex-advisor pass on D1 phase branch; sentinel cleanup; merge.

---

### Phase D2 — `@cinder/editor` (serial on D1; small, single worker)

Single leaf worker. ~25 files; depends only on `@cinder/markdown` + `@milkdown/kit`. No internal cinder deps; no UI demoable on its own.

- **W3 (worktree):** port `depict/packages/editor/src/*` → `packages/editor/src/`. Rewrite all `@depict/markdown/*` imports to `@cinder/markdown/*`. Migrate tests per category. Apply the SSR rewrite list from `tmp/port-inventory/browser-only-imports.md` (every `@milkdown/kit` static import becomes a dynamic import inside `$effect` or `onMount`). No `cn` rename needed.
- **C2 (codex-worker, low effort):** writes the import-shape sanity test (one-line import + type assertion per `exports` subpath). This is **independent verification work**, not a duplicate implementation — kept.

**Cross-package dep wiring smoke test** (added to root validate from this phase forward): a smoke test inside `@cinder/editor` that does `import { contentEquals } from '@cinder/markdown/pipeline'` and asserts `typeof contentEquals === 'function'`. Only passes if the workspace symlink, `exports` map, and dist build are all correct. Run **after** root `--filter='*' build`, **before** any UI work.

**Gate D2:** `bun run --filter='@cinder/editor' validate` green; root validate green; smoke import test green; committee-review + codex-advisor pass.

---

### Phase D3 — `@cinder/commentary` + four leaf cinder components (wide parallel)

The wide phase. `@cinder/commentary` is serial-on-D2; the leaf cinder components have no `@cinder/*` deps and parallelize alongside it.

- **W4 (worktree, serial-on-D2):** port `depict/packages/commentary/src/*` → `packages/commentary/src/`. Rewrite `@depict/{markdown,editor}/*` imports to `@cinder/*`. Migrate vitest → bun:test. Wire happy-dom via local `bunfig.toml` (commentary touches DOM in anchoring tests).
- **W5 (worktree):** port three new cinder components — `cinder/segmented-control` + `cinder/diff-statistics` + `cinder/view-switcher` — kebab-case files, named exports from `index.ts`, `cn` → `classNames` rename (codemod from C3), three playground demos. **Plus cinder primitive extensions** (per D-1 compatibility-matrix): add `'ghost-danger'` to `Button.variant`; add `'accent'` and `'xs'` to `Badge.variant`/`Badge.size`; add optional `label` and `size` props to `Kbd`; verify+add `description` on `Card`'s title-variant if absent; ship the **Dropdown compound family** as 5 new primitives (`DropdownTrigger`, `DropdownMenu`, `DropdownItem`, `DropdownLabel`, `DropdownSeparator`) under existing `cinder/dropdown/*` subpaths. Each extension/addition gets a playground demo update. All additive — no breaking change.
- **W6 (worktree):** port `cinder/selection-popover` (~406 LOC, 1 component, no `@cinder/*` deps). Rename pass. Playground demo.
- **C3 (codex-worker, medium effort):** one-shot rename codemod — TS script (ast-grep for structural cases, regex for simple cases) handling **only the safe rewrites**: `import { cn } from '...'` → `import { classNames } from '...'`, `cn(` callsites → `classNames(`, and `--depict-*` CSS custom properties → `--cinder-*` (consuming `tmp/port-inventory/css-token-map.md`). **Excludes** `pkg`/`repo` semantic renames — those happen manually with reviewer per file (Issue 7). Reused by W5/W6/W7/W8/W9.
- **C4 (codex-worker, low effort):** drafts the playground example file template that all eight new domain-suite demos will follow. Reduces D4/D5 per-component overhead.
- **Integration owner serial:** updates `packages/components/package.json` `exports` for the four new leaf components; updates `packages/components/src/index.ts` barrel via `bun run exports:generate`; ensures `cinder.css` includes any new component-styles imports; runs `convention.test.ts`. **Add the domain-suite allowlist to `convention.test.ts`** with the four allowed names hard-coded (`chat`, `diff-viewer`, `review-editor`, `markdown-editor`); any new name attempting `<style>` blocks fails the test.

**Gate D3:**

- `bun run validate` green.
- `bun run --filter='@cinder/commentary' validate` green; commentary's smoke import test green.
- All four new cinder components render in playground (`/c/segmented-control`, `/c/diff-statistics`, `/c/view-switcher`, `/c/selection-popover`).
- **Interaction acceptance per component** (bun:test + @testing-library/svelte): `segmented-control` keyboard arrow navigation + Enter selects; `view-switcher` toggles between view types; `selection-popover` opens on selection, closes on outside-click and ESC, focus restores on close; `diff-statistics` updates ARIA label on stat change.
- Committee-review + codex-advisor pass.

---

### Phase D4 — `cinder/chat` + `cinder/diff-viewer` + `cinder/surface` + `cinder/markdown-editor` (parallel)

Disjoint internal cinder dep sets and disjoint package deps. **Three parallel worktrees** (the original two plus markdown-editor, which moved up from D5 because chat depends on it directly), plus one tiny primitive.

- **W7 (worktree):** `cinder/chat`. Ports `depict/packages/components/src/chat/{artifact,container,export,input,message,scope,utilities}` (~6,800 LOC). Internal cinder deps (`alert`, `button`, `card`, `empty-state`, `input`, `dropdown` compound family from D3) all exist after D3. Package deps: `conversationalist` only. Note: chat's `message-content.svelte` imports `splitStreamingContent` from `@depict/markdown/rendering` — single-symbol cross. Rewire to `@cinder/markdown/rendering`. **Imports `cinder/markdown-editor` from W10's parallel port** — sequence within D4: W10 finishes scaffolding before W7's chat-input port, but both run in parallel until that interlock. Apply rename codemod. Playground demos: `/c/chat` with at least three scenarios (basic, streaming, with tool calls).
- **W8 (worktree):** `cinder/diff-viewer` + `cinder/surface`. Ports the 7-file diff-viewer dir (~1,600 LOC). Internal cinder deps: `badge`, `button`, `kbd`, `segmented-control` (D3), `spinner` — all exist. Two missing: `surface` ports as a tiny new sibling primitive in this phase (it's in cinder's vocabulary, not domain-specific); `front-matter-header` is **shared with `markdown-template-editor`** in depict (per D-1 dependency-graph), so it ships as a private sibling under `diff-viewer/`'s directory and gets re-exported by W8 only if W10 ends up needing it. Package deps: `@cinder/markdown/diff/line-diff` + `@cinder/diff`. Apply rename codemod. Replace `lucide-svelte` icons with inline SVG. Playground demos: `/c/diff-viewer` (basic, with front-matter, large diff), `/c/surface` (minimal).
- **W10 (worktree, new in D4):** `cinder/markdown-editor`. ~1,124 LOC across 9 files including `prosemirror.css`. Subpath export `cinder/markdown-editor`. Depends on `@cinder/editor` (D2) and `@cinder/markdown` (D1). Apply rename codemod + browser-only-imports rewrites from `tmp/port-inventory/browser-only-imports.md` (every `@milkdown/kit` static import becomes dynamic inside `$effect`/`onMount`). Playground demo: `/c/markdown-editor`.
- **C5 (codex-worker, low effort):** writes the chat + diff-viewer + markdown-editor playground demos using the C4 template. Three demos, independent, perfect parallelism.
- **C6 (codex-worker, medium effort):** drafts the **tree-shake fixture test**. A `bun build` of a fixture file that imports only `cinder/button` — assertion: the resulting bundle does _not_ contain `shiki`, `unified`, `@milkdown/kit`, `diff-match-patch`, or `prosemirror`. Verified via bundle metadata (sourcemap-aware) AND string search; AND no `--depict-*` or `--cinder-chat-*`/`--cinder-markdown-editor-*` CSS custom properties leak. User-facing guarantee that subpath imports work.
- **Integration owner serial:** `exports` map updates for the components package; `cinder.css` integration; `exports-drift.test.ts` regen; `api-contract.test.ts` updates; tree-shake test integration into `validate`. Reconcile W10 → W7 sequencing: ensure `cinder/markdown-editor`'s exports land before W7's chat-input commits land.

**Gate D4:**

- `bun run validate` green.
- `/c/chat`, `/c/diff-viewer`, `/c/surface`, `/c/markdown-editor` render in playground without console errors.
- **Interaction acceptance**: chat — streaming-message updates render incrementally without flicker; tool-call pair displays in the right order; ARIA live region announces new assistant turns; scroll auto-pins to bottom on new message and unpins when user scrolls up. Diff-viewer — toolbar collapse/expand, ChevronDown/Up navigates hunks, large diff (>500 lines from D-1's regression fixture) renders without freezing the playground. Markdown-editor — type into editor, apply bold/italic via toolbar, paste an image attachment, undo/redo across paste.
- **Tree-shake contract**: a fixture importing only `cinder/button` produces a bundle that does not contain `shiki`, `unified`, `@milkdown/kit`, `diff-match-patch`, `prosemirror`, **and contains no `--depict-*` or `--cinder-chat-*` CSS custom properties**. Verified via bundle metadata (sourcemap-aware) AND string search; not string search alone.
- Committee-review + codex-advisor pass.

---

### Phase D5 — `cinder/review-editor` (serial, primary worker)

`markdown-editor` already shipped in D4. ~5,600 LOC for review-editor remains. Single primary worker because the file set is interlocked enough that splitting across files would create merge hell.

- **W9 (primary, worktree):** ports the 17 files in `depict/packages/components/src/review-editor/`. Apply rename codemod. Wire to `@cinder/{commentary,markdown,editor}`, `cinder/{markdown-editor,diff-viewer,selection-popover,view-switcher,diff-statistics,segmented-control,dropdown,button}` — all available from D2/D3/D4. Playground demo: `/c/review-editor` with at least two scenarios (basic, with comments).
- **C8 (codex-worker, medium effort):** SSR fixture test. Adapter-node SvelteKit fixture that renders a page with all eight new components on it; asserts no throw. Imitates depict's `review-editor-ssr.svelte.test.ts`. The SSR test is **confirmation** — the actual import-time SSR safety was already enforced by the porters per `browser-only-imports.md`.
- **Integration owner serial:** `exports` map updates; barrel; CSS imports; W9 reconcile; regenerate consumer fixtures; `validate:consumer` run; `validate:playground` run.

**Gate D5:**

- `/c/review-editor` renders in playground.
- All nine new components (`segmented-control`, `diff-statistics`, `view-switcher`, `selection-popover`, `surface`, `chat`, `diff-viewer`, `markdown-editor`, `review-editor`) plus the Dropdown compound family coexist in one playground without CSS-token clashes.
- `bun run validate` green (lint + typecheck + test + exports check + consumer fixtures + workflow).
- `bun run validate:consumer` green (Node + SvelteKit fixtures).
- `bun run validate:playground` green.
- SSR fixture test green (C8); imports never throw at module-evaluation time in adapter-node.
- Tree-shake fixture still green.
- **Interaction acceptance for review-editor**: open document, select text, create comment, anchor persists across edit, comment exports to markdown summary; switch view modes (rendered ↔ source ↔ diff); reanchor a quote after upstream document edit.
- Long-document regression test (>5000 lines from D-1 perf-retention) renders review-editor in playground in <2s.
- Committee-review + codex-advisor pass; sentinel cleanup; merge.

---

## Critical files

**Modified:**

- `/Users/stevekinney/Developer/cinder/COMPONENT-COVERAGE-PLAN.md` (D0)
- `/Users/stevekinney/Developer/cinder/ROADMAP.md` (D0)
- `/Users/stevekinney/Developer/cinder/package.json` (D0; lint-staged + workspaces + scripts.validate)
- `/Users/stevekinney/Developer/cinder/packages/components/package.json` (D3, D4, D5; exports map for each new component)
- `/Users/stevekinney/Developer/cinder/packages/components/src/index.ts` (D3, D4, D5; barrel)
- `/Users/stevekinney/Developer/cinder/packages/components/src/styles/components.css` (D3, D4, D5; CSS imports)
- `/Users/stevekinney/Developer/cinder/packages/components/src/convention.test.ts` (D3; domain-suite carve-outs)

**Added:**

- `/Users/stevekinney/Developer/cinder/packages/markdown/**` (D1)
- `/Users/stevekinney/Developer/cinder/packages/diff/**` (D1)
- `/Users/stevekinney/Developer/cinder/packages/editor/**` (D2)
- `/Users/stevekinney/Developer/cinder/packages/commentary/**` (D3)
- `/Users/stevekinney/Developer/cinder/packages/components/src/components/{segmented-control,diff-statistics,view-switcher,selection-popover,surface,chat,diff-viewer,markdown-editor,review-editor}.svelte` (+ co-located CSS where needed) (D3, D4, D5)
- `/Users/stevekinney/Developer/cinder/packages/playground/src/examples/{...}/` for each new component (D3, D4, D5)

**Reused (do not rewrite):**

- `packages/components/scripts/generate-exports.ts` for components-package exports drift.
- `packages/components/src/utilities/use-id.ts` and `use-toast.ts` — referenced from chat where applicable.
- `packages/components/src/_internal/{collection,field-control,overlay}.ts` — reused by review-editor and friends to match the established cinder primitive contracts.
- `packages/playground/src/discover.ts` — auto-discovers new examples; no playground routing config to update.

---

## Risk register

1. **Bun build with 18 new npm deps** — highest impact. `shiki`, `unified`, `rehype-*`, `remark-*` ecosystems pull peer deps. Mitigation: D1 smoke harness must build cleanly before any UI work.
2. **SSR for editor + selection-popover + commentary.** `@milkdown/kit` is browser-only; `selection-popover` uses `getBoundingClientRect`. Cinder's `--conditions browser` test command works locally; `validate:consumer` runs adapter-node SSR. Mitigation: every browser-only access lives inside `$effect` / `onMount`, never at module top level. C8's SSR fixture test enforces this in D5.
3. **CSS-token clashes.** depict tokens are `--depict-*`; cinder's are `--cinder-*` and `--_cinder-*`. Codemod rewrites in C3. Highest-risk file is `review-editor.css` (~600 LOC). Convention test must not block `<style>` blocks for the new tier (D3 carve-out).
4. **`bun.lock` thrash** — 18 npm deps + workspace edits = noisy lockfile diffs. Each phase regens lock at the gate, integration owner only.
5. **Codex-worker drift** — Codex implementations may use different APIs (e.g., a different `unified` plugin order). Integration owner _always_ runs `git diff` between codex output and worker output before reconciling; never auto-merges.
6. **Convention test enforcement.** `convention.test.ts` line 138 hard-bans `<style>` blocks. Without the D3 carve-out, every domain-suite component will fail this test. Carve-out must land in D3 before any styled component does.

---

## Rollback strategy

Each phase declares: a hard failure signal, the exact set of files reverted on rollback, and what state the repository returns to. Because D-1 is read-only and D0 is doc-only, the riskiest revert points are D1d (root workspace widening) and D5 (review-editor).

| Phase | Hard failure signal                                                                                                       | Revert scope                                                                                                     | Resulting state                                                                                                           |
| ----- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| D-1   | Inventory artifacts contradict a locked decision (e.g., `@cinder/diff` truly cannot be a facade AND cannot be standalone) | Delete `tmp/port-inventory/`                                                                                     | No repo change. User decides next step.                                                                                   |
| D0    | n/a (doc-only)                                                                                                            | `git restore COMPONENT-COVERAGE-PLAN.md ROADMAP.md`                                                              | Pre-port docs.                                                                                                            |
| D1a–c | Smoke harness build fails to resolve npm deps                                                                             | Delete worktrees `packages/markdown/`, `packages/diff/`                                                          | No root change yet (D1d not run).                                                                                         |
| D1d   | After workspace widening, `bun run validate` red and not fixable in <1 hour                                               | `git restore package.json bun.lock`; delete `packages/markdown/`, `packages/diff/`                               | Pre-D1 state.                                                                                                             |
| D2    | `@cinder/editor` cannot import from `@cinder/markdown` despite workspace symlinks                                         | Delete `packages/editor/`; revert workspace entry for editor only                                                | D1 stable, no editor. Pause and diagnose.                                                                                 |
| D3    | `@cinder/commentary` SSR throws OR `convention.test.ts` allowlist not landable without breaking primitives                | Delete `packages/commentary/`, revert four cinder leaf components                                                | D2 stable. Re-plan D3 carve-out.                                                                                          |
| D4    | Tree-shake contract fails (heavy deps leak into `cinder/button` bundle)                                                   | Revert chat/diff-viewer/surface component additions; keep `@cinder/*` packages (they're already proven by D1–D3) | D3 stable. Re-architect tree-shake (likely needs `sideEffects` field surgery in components package).                      |
| D5    | Review-editor SSR throws and dynamic-import fix takes >1 day                                                              | Revert review-editor + markdown-editor; ship D4 deliverables as the final state of this work                     | D4 stable. Review-editor becomes a follow-up; not a regression because the deferred state matches what shipped before D5. |

**Rule:** Rollback is local to the phase that failed. No phase may revert an earlier phase's changes. If D5 fails, D4 stays shipped.

## Verification (end-to-end, after D5)

1. `bun run validate` (root) — lint + typecheck + test + exports check + consumer fixtures + workflow.
2. `bun run playground`, manually load each route and confirm interactability:
   - `/c/segmented-control`, `/c/diff-statistics`, `/c/view-switcher`, `/c/selection-popover`
   - `/c/surface`
   - `/c/chat`, `/c/diff-viewer`
   - `/c/markdown-editor`, `/c/review-editor`
3. Tree-shake fixture (from C6): `bun build` of a `import { Button } from 'cinder/button'` fixture produces a bundle that does **not** contain `shiki`, `unified`, `@milkdown/kit`, `diff-match-patch`, or `prosemirror`.
4. SSR fixture (from C8): adapter-node SvelteKit fixture with all eight new components renders without throwing.
5. Per-phase committee-review + codex-advisor against the exact target hash of each phase branch.
6. Per-phase sentinel cleanup before next phase begins.
