# Cinder: Svelte 5 Design System — Roadmap

`cinder` is a Bun + TypeScript + Svelte 5 design system. Phases 1–5 shipped a Bun plugin, packaging contract, 21 components, a `Bun.serve` playground with auto-generated controls from static analysis, and a workspace split into `packages/components` + `packages/playground`. **Phase 6** ports the depict domain-suite (chat, diff-viewer, review-editor, markdown-editor) plus four supporting workspace packages.

This file is the active task list. The architectural plan for Phase 6 lives in `docs/phase-6-plan.md` — read it before starting any task. The D-1 inventory artifacts (dependency-graph, css-token-map, browser-only-imports, version-matrix, compatibility-matrix, test-classification) live in `tmp/port-inventory/` and are inputs to the tasks below. The source repository to port from is at `/Users/stevekinney/Developer/depict`.

## Architectural Decisions (locked across all phases)

| Area             | Decision                                                                                                                                                                            |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component layout | Flat `.svelte` under `src/components/`; generated granular subpath exports                                                                                                          |
| Styles           | No per-component `<style>` blocks except for the **domain-suite allowlist** (`chat`, `diff-viewer`, `review-editor`, `markdown-editor`); one shared stylesheet at `./styles` export |
| Plugin           | Custom, ~40 lines, parameterized by `{ generate: 'client' \| 'server' }`                                                                                                            |
| Packaging        | Ship both source (`"svelte"` condition) and compiled server JS (`"node"` condition)                                                                                                 |
| Playground       | `Bun.serve` in-repo, per-component pages from hand-curated `*.example.svelte` files                                                                                                 |
| Static analysis  | `svelte/compiler` AST for structure + `ts-morph` for types; feeds playground controls                                                                                               |
| CSS namespace    | `.cinder-*` classes, `data-cinder-*` attributes, `@layer cinder.*`, `--cinder-*` / `--_cinder-*` tokens                                                                             |
| Repo structure   | Workspace split executed in Phase 5a (`packages/components`, `packages/playground`); Phase 6 widens with new packages                                                               |

## Per-phase review gate (applies to every phase)

Same gate Phases 1–5 used. The shipped commit on `main` is byte-identical to the hash both reviewers approved.

1. Phase work is on `phase-6/<slug>` (or `ralph/<task-id>` for ralph-driven tasks). All verification in the task's gate must pass locally.
2. Capture the tip hash with `git rev-parse HEAD`. Record it under `tmp/phase-review/` (gitignored).
3. Run `/committee-review` against the target hash. Record approval in `tmp/phase-review/<task>-committee.approved`.
4. Run `codex-advisor` review against the same target hash. Record approval in `tmp/phase-review/<task>-codex.approved`.
5. **Disagreement resolution**: stricter blocking finding wins; if they disagree on blocking, treat as blocking. New commit → new target hash → restart from step 2.
6. **Fast-forward-only merge to `main`**: `git merge --ff-only`. No squash, no merge commit. If `main` advanced mid-review, rebase and restart from step 2.
7. Delete the local + remote branch. Sentinels in `tmp/` are gitignored — no cleanup commit.

**MCP outage retry policy**: if `codex-advisor` is unavailable, retry up to 3 times over 30 minutes. If still unavailable, write `tmp/phase-review/<task>-blocked.md` and surface to the user. Never silently bypass.

---

## Shipped (Phases 1–5 + D0 + D1)

| Phase | Delivered                                                                                                      | PR  |
| ----- | -------------------------------------------------------------------------------------------------------------- | --- |
| 0     | Internal contracts, design tokens, test infrastructure                                                         | —   |
| 1     | Bun Svelte plugin, packaging contract, Button (export conditions, peer-range policy, consumer fixtures)        | #1  |
| 2     | 21 components with subpath exports + AST convention enforcement                                                | #2  |
| 3a    | Playground shell (`Bun.serve` dev server)                                                                      | #3  |
| 3b    | Avatar, Breadcrumbs, Progress (stable); Sheet, Popover (experimental)                                          | —   |
| 4     | Static analysis + auto-generated playground controls; Combobox                                                 | #4  |
| 5     | Kbd, CopyButton, CodeBlock + experimental observability bucket; workspace split election (deferred → executed) | #5  |
| 5a    | Workspace split into `packages/components` + `packages/playground`                                             | #6  |
| D0    | Domain-suite tier admission in `COMPONENT-COVERAGE-PLAN.md` + Phase 6 roadmap                                  | #7  |
| D1    | `@cinder/markdown` + `@cinder/diff` workspace packages (foundational layer)                                    | #8  |

---

# Phase 6 — Domain-Suite Port

Goal: port `chat`, `diff-viewer`, `review-editor`, `markdown-editor` from `@depict/components` into cinder under the **domain-suite** tier, plus three supporting workspace packages (`@cinder/editor`, `@cinder/commentary`; `@cinder/markdown` and `@cinder/diff` already shipped in D1).

Read `docs/phase-6-plan.md` for the full architectural plan, dep graph, and parallelization strategy before starting any task. Inventory artifacts in `tmp/port-inventory/` are inputs to every task.

## Phase D2 — `@cinder/editor` package

- [x] Scaffold `@cinder/editor` workspace package porting the Milkdown/ProseMirror integration

  Port `/Users/stevekinney/Developer/depict/packages/editor/src/` into `packages/editor/src/`. Rewrite all `@depict/markdown/*` imports to `@cinder/markdown/*`. Migrate vitest → bun:test by category (per `tmp/port-inventory/test-classification.md`). Apply the SSR rewrite list from `tmp/port-inventory/browser-only-imports.md`: every `@milkdown/kit` static top-level import becomes a dynamic `import()` inside `$effect` or `onMount`.

  Package skeleton matches D1's pattern (see `packages/markdown/` and `packages/diff/`):
  - `package.json` with `"private": true`, `"type": "module"`, `"sideEffects": false`, exports map, `scripts: { build, validate, test, typecheck, lint }`
  - `tsconfig.json` extending `../../tsconfig.base.json` with `paths: { "@/*": ["./src/*"] }`
  - `tsconfig.build.json` with `declaration: true, emitDeclarationOnly: true, outDir: ./dist`
  - `scripts/build.ts` using `Bun.build` (esm/browser, external: `@cinder/*` + `svelte`) + `tsc --emitDeclarationOnly`
  - `src/index.ts` barrel export

  Pin `@milkdown/kit@^7.17.3` as dep, `@cinder/markdown` as workspace dep. Add `"packages/editor"` to root `package.json` workspaces. Add lint-staged globs for the new package.

  Add a cross-package smoke test inside `@cinder/editor`:

  ```ts
  import { contentEquals } from '@cinder/markdown/pipeline';
  console.assert(typeof contentEquals === 'function');
  ```

  This proves the workspace symlink, exports map, and dist build are wired correctly.

  Verification gate:
  - `bun run --filter='@cinder/editor' validate` green
  - `bun run validate` at root green
  - Cross-package smoke import test passes

## Phase D3 — `@cinder/commentary` + four leaf components + primitive extensions

- [x] Port `@cinder/commentary` and four leaf cinder components; extend existing cinder primitives

  **Part A — `@cinder/commentary` package**: port `/Users/stevekinney/Developer/depict/packages/commentary/src/` into `packages/commentary/src/`. Rewrite `@depict/{markdown,editor}/*` → `@cinder/*`. Wire `happy-dom` via a local `bunfig.toml` (commentary's anchoring tests touch DOM). Migrate vitest → bun:test. Same package skeleton as D1/D2. Add to root workspaces.

  **Part B — Four new cinder components** (port from `/Users/stevekinney/Developer/depict/packages/components/src/`):
  - `segmented-control` → `packages/components/src/components/segmented-control.svelte`
  - `diff-statistics` → `packages/components/src/components/diff-statistics.svelte`
  - `view-switcher` → `packages/components/src/components/view-switcher.svelte`
  - `selection-popover` → `packages/components/src/components/selection-popover.svelte`

  For each: kebab-case filename, named exports from `index.ts`, run the rename codemod (`cn` → `classNames`, `--depict-*` → `--cinder-*` per `tmp/port-inventory/css-token-map.md`), add a playground demo under `packages/playground/src/examples/<name>/basic.example.svelte`.

  **Part C — Cinder primitive extensions** (additive, no breaking changes):
  - `packages/components/src/components/button.svelte`: add `'ghost-danger'` to `ButtonVariant` + matching CSS in `src/styles/components/button.css`
  - `packages/components/src/components/badge.svelte`: add `'accent'` to `BadgeVariant`, `'xs'` to `BadgeSize` + CSS
  - `packages/components/src/components/kbd.svelte`: add optional `label: string` and `size: 'sm' | 'md'` props
  - `packages/components/src/components/card.svelte`: add optional `description` prop to title-variant if absent
  - Dropdown compound family: add `dropdown-trigger.svelte`, `dropdown-menu.svelte`, `dropdown-item.svelte`, `dropdown-label.svelte`, `dropdown-separator.svelte` as new primitives alongside the existing `dropdown.svelte`. Each gets a playground demo.

  **Part D — `convention.test.ts` allowlist update**: add the domain-suite allowlist (4 names: `chat`, `diff-viewer`, `review-editor`, `markdown-editor`) so those components can carry `<style>` blocks without failing the convention test.

  Update `packages/components/package.json` exports and `src/index.ts` barrel for all new components.

  Verification gate:
  - `bun run --filter='@cinder/commentary' validate` green
  - `bun run validate` green
  - All four new components render in playground at `/c/segmented-control`, `/c/diff-statistics`, `/c/view-switcher`, `/c/selection-popover`
  - Dropdown compound demos render in playground
  - `bun run --filter=cinder test` green (convention test passes with allowlist)

## Phase D4 — `cinder/chat` + `cinder/diff-viewer` + `cinder/surface` + `cinder/markdown-editor`

- [x] Port chat, diff-viewer, surface, and markdown-editor components with playground demos

  Port all four from `/Users/stevekinney/Developer/depict/packages/components/src/`. Apply the rename codemod for each. SSR rewrites per `tmp/port-inventory/browser-only-imports.md`.

  **`cinder/surface`** (tiny primitive, no domain-suite allowlist needed): port `/Users/stevekinney/Developer/depict/packages/components/src/surface/`. Playground demo `/c/surface`.

  **`cinder/markdown-editor`** (domain-suite; `<style>` blocks allowed): port `/Users/stevekinney/Developer/depict/packages/components/src/markdown-editor/` (~1,124 LOC, 9 files). Deps: `@cinder/editor`, `@cinder/markdown`. Apply browser-only import rewrites (every `@milkdown/kit` static import → dynamic inside `$effect`). Playground demo `/c/markdown-editor`.

  **`cinder/diff-viewer`** (domain-suite): port `/Users/stevekinney/Developer/depict/packages/components/src/diff-viewer/` (~1,600 LOC, 7 files). Internal deps: `badge`, `button`, `kbd`, `segmented-control` (D3), `spinner`. Package deps: `@cinder/markdown/diff/line-diff` + `@cinder/diff`. Inline `front-matter-header` as a private sub-component inside `diff-viewer/` (not exported). Replace `lucide-svelte` icons with inline SVG (8 icons: `ChevronDown`, `ChevronUp`, `ChevronLeft`, `ChevronRight`, `RotateCcw`, `RefreshCw`, `FileText`, plus one more from the toolbar). Playground demos at `/c/diff-viewer` (basic, with front-matter, large-diff scenarios).

  **`cinder/chat`** (domain-suite): port `/Users/stevekinney/Developer/depict/packages/components/src/chat/` (~6,800 LOC across `artifact/`, `container/`, `export/`, `input/`, `message/`, `scope/`, `utilities/`). Internal deps: `alert`, `button`, `card`, `empty-state`, `input`, dropdown compound family (D3), `markdown-editor` (above). Package dep: `conversationalist@0.0.9`. `chat-input.svelte` imports `MarkdownEditor` from markdown-editor — ensure that's ported first. One symbol in `message-content.svelte` imports from `@depict/markdown/rendering` — rewire to `@cinder/markdown/rendering`. Playground demos at `/c/chat` (basic, streaming, with tool calls).

  Write a tree-shake fixture test at `packages/components/src/tree-shake.test.ts` that runs `bun build` on a fixture importing only `cinder/button` and asserts the output does **not** contain `shiki`, `unified`, `@milkdown/kit`, `diff-match-patch`, or `prosemirror`, and contains no `--depict-*` custom property strings.

  Update `packages/components/package.json` exports and `src/index.ts` barrel for all four new components.

  Verification gate:
  - `bun run validate` green
  - `/c/chat`, `/c/diff-viewer`, `/c/surface`, `/c/markdown-editor` all render in playground
  - Tree-shake fixture passes

## Phase D5 — `cinder/review-editor`

- [ ] Port review-editor component — the final and most complex domain-suite component

  Port `/Users/stevekinney/Developer/depict/packages/components/src/review-editor/` (~5,600 LOC, 17 files) into `packages/components/src/components/review-editor/`.

  Wire to: `@cinder/{commentary,markdown,editor}`, `cinder/{markdown-editor,diff-viewer,selection-popover,view-switcher,diff-statistics,segmented-control,dropdown,button}` — all available from prior phases.

  Apply rename codemod (`cn` → `classNames`, `--depict-*` CSS tokens → `--cinder-*` per `tmp/port-inventory/css-token-map.md`). Apply browser-only import rewrites per `tmp/port-inventory/browser-only-imports.md`.

  Add playground demos at `/c/review-editor` (basic, with comments).

  Write an SSR fixture test: a Node script at `tmp/ssr-fixture.ts` that imports `review-editor` and all eight new domain-suite components and asserts they don't throw at module-eval time in a Node (adapter-node) context. Run with `bun run tmp/ssr-fixture.ts`.

  Update `packages/components/package.json` exports and `src/index.ts` barrel.

  Verification gate (full Phase 6 exit gate):
  - `/c/review-editor` renders in playground
  - All nine new components (`segmented-control`, `diff-statistics`, `view-switcher`, `selection-popover`, `surface`, `chat`, `diff-viewer`, `markdown-editor`, `review-editor`) coexist in playground without CSS-token clashes
  - `bun run validate` green
  - `bun run validate:consumer` green (Node + SvelteKit fixtures)
  - `bun run validate:playground` green
  - SSR fixture (`tmp/ssr-fixture.ts`) runs without throwing
  - Tree-shake fixture still green
  - Interaction acceptance: review-editor can open a document, select text, switch view modes (rendered/source/diff)
  - Long-document regression: review-editor renders a >5,000-line document in playground in under 2 seconds

---

## Out of Scope (all phases)

- Publishing workflow (`.github/workflows`) — separate concern.
- Visual regression testing — separate concern.
- Theme switching UI — tokens use `light-dark()` so it's inherited; a switcher is a post-Phase-6 feature.
- Internationalization — separate concern.
- Component-level SSR/hydration debugging tools — Phase 1's adapter-node fixture catches the integration-level cases.
- Node version matrix testing — Phase 1 fixture uses whatever `node` is on PATH; CI is expected to pin it.

## Environment Requirements

- Bun >= 1.3.0 (already pinned in `package.json#engines`).
- Node on PATH for `validate:consumer`. Documented in README.
- Git on PATH for `validate:workflow`. Already ambient.
- No other system dependencies.
