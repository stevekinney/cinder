# Phase 6 Task List: Domain-Suite Port

Context for all tasks: read `docs/phase-6-plan.md` before starting any task. It contains the full architectural decisions, dep graph, parallelization strategy, and per-phase verification gates. The D-1 inventory artifacts are in `tmp/port-inventory/` (already completed). D0 is already merged (PR #7).

The source repository to port from is at `/Users/stevekinney/Developer/depict`.

## Phase D1 — Foundational packages

- [ ] Scaffold `@cinder/markdown` and `@cinder/diff` workspace packages with full test suites

  Port `/Users/stevekinney/Developer/depict/packages/markdown/src/` into `packages/markdown/src/`. Mirror the 10-subpath exports map from depict, rewriting `@depict/markdown` → `@cinder/markdown`. Pin npm deps from `tmp/port-inventory/version-matrix.md`. Migrate vitest tests to bun:test by category (see `tmp/port-inventory/test-classification.md`) — keep round-trip + edge-cases as unit tests; retain one large-input regression. No `cn` rename needed in this package.

  Also scaffold `packages/diff/` as a standalone package with `diff-match-patch` as its only dep. Source: `/Users/stevekinney/Developer/depict/packages/markdown/src/diff/line-diff.ts` + types. `@cinder/markdown/diff/line-diff` becomes a re-export from `@cinder/diff`.

  Both packages get this skeleton:
  - `package.json` with `"private": true`, `"type": "module"`, `"sideEffects": false`, exports map, `scripts: { build, validate, test, typecheck, lint }`
  - `tsconfig.json` extending `../../tsconfig.base.json` with `paths: { "@/*": ["./src/*"] }`
  - `tsconfig.build.json` with `declaration: true, emitDeclarationOnly: true, outDir: ./dist`
  - `scripts/build.ts` using `Bun.build` (esm/browser, external: `@cinder/*` + `svelte`) + `tsc --emitDeclarationOnly`
  - `src/index.ts` barrel export

  After both packages build and typecheck in isolation, widen the workspace:
  - Add `"packages/markdown"` and `"packages/diff"` to root `package.json` `workspaces`
  - Add lint-staged globs for both new packages to root `package.json`
  - Update root `scripts.validate` to `bun run --filter='*' validate && bun run --filter=cinder validate:consumer`

  Write a smoke harness at `tmp/port-smoke/markdown-smoke.ts` that imports from every `@cinder/markdown` subpath and run `bun build` against it.

  Verification gate:
  - `bun run --filter='@cinder/markdown' validate` green
  - `bun run --filter='@cinder/diff' validate` green
  - `bun run validate` at root green
  - Smoke harness builds with no missing peer deps
  - One large-input regression test passes

## Phase D2 — @cinder/editor package

- [ ] Scaffold `@cinder/editor` workspace package porting the Milkdown/ProseMirror integration

  Port `/Users/stevekinney/Developer/depict/packages/editor/src/` into `packages/editor/src/`. Rewrite all `@depict/markdown/*` imports to `@cinder/markdown/*`. Migrate vitest → bun:test by category. Apply the SSR rewrite list from `tmp/port-inventory/browser-only-imports.md`: every `@milkdown/kit` static top-level import becomes a dynamic `import()` inside `$effect` or `onMount`.

  Package skeleton same as D1 (see above). Add to root `workspaces`. Pin `@milkdown/kit@^7.17.3` as dep, `@cinder/markdown` as workspace dep.

  Add a cross-package smoke test inside `@cinder/editor` that does:

  ```ts
  import { contentEquals } from '@cinder/markdown/pipeline';
  console.assert(typeof contentEquals === 'function');
  ```

  This proves the workspace symlink, exports map, and dist build are all wired correctly.

  Verification gate:
  - `bun run --filter='@cinder/editor' validate` green
  - Root validate green
  - Cross-package smoke import test passes

## Phase D3 — @cinder/commentary + four leaf components + primitive extensions

- [ ] Port @cinder/commentary and four leaf cinder components; extend existing cinder primitives

  **Part A — @cinder/commentary package:**
  Port `/Users/stevekinney/Developer/depict/packages/commentary/src/` into `packages/commentary/src/`. Rewrite `@depict/{markdown,editor}/*` → `@cinder/*`. Wire happy-dom via a local `bunfig.toml` (commentary's anchoring tests touch DOM). Migrate vitest → bun:test.

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
  - Dropdown compound family: add `packages/components/src/components/dropdown-trigger.svelte`, `dropdown-menu.svelte`, `dropdown-item.svelte`, `dropdown-label.svelte`, `dropdown-separator.svelte` as new primitives alongside the existing `dropdown.svelte`. Each gets a playground demo.

  **Part D — convention.test.ts update:**
  Add the domain-suite allowlist (4 names: `chat`, `diff-viewer`, `review-editor`, `markdown-editor`) so those components can carry `<style>` blocks without failing the convention test.

  Update `packages/components/package.json` exports and `src/index.ts` barrel for all new components.

  Verification gate:
  - `bun run --filter='@cinder/commentary' validate` green
  - `bun run validate` green
  - All four new components render in playground at `/c/segmented-control`, `/c/diff-statistics`, `/c/view-switcher`, `/c/selection-popover`
  - Dropdown compound demos render in playground
  - `bun run --filter=cinder test` green (convention test passes with allowlist)

## Phase D4 — cinder/chat + cinder/diff-viewer + cinder/surface + cinder/markdown-editor

- [ ] Port chat, diff-viewer, surface, and markdown-editor components with playground demos

  Port all four from `/Users/stevekinney/Developer/depict/packages/components/src/`. Apply rename codemod for each. SSR rewrites per `tmp/port-inventory/browser-only-imports.md`.

  **`cinder/surface`** (tiny primitive, no domain-suite allowlist needed):
  Port `/Users/stevekinney/Developer/depict/packages/components/src/surface/`. Playground demo `/c/surface`.

  **`cinder/markdown-editor`** (domain-suite; `<style>` blocks allowed per allowlist):
  Port `/Users/stevekinney/Developer/depict/packages/components/src/markdown-editor/` (~1,124 LOC, 9 files). Deps: `@cinder/editor`, `@cinder/markdown`. Apply browser-only import rewrites (every `@milkdown/kit` static import → dynamic inside `$effect`). Playground demo `/c/markdown-editor`.

  **`cinder/diff-viewer`** (domain-suite):
  Port `/Users/stevekinney/Developer/depict/packages/components/src/diff-viewer/` (~1,600 LOC, 7 files). Internal deps: `badge`, `button`, `kbd`, `segmented-control` (D3), `spinner`. Package deps: `@cinder/markdown/diff/line-diff` + `@cinder/diff`. Inline `front-matter-header` as a private sub-component inside `diff-viewer/` (not exported). Replace `lucide-svelte` icons with inline SVG (8 icons total — ChevronDown, ChevronUp, ChevronLeft, ChevronRight, RotateCcw, RefreshCw, FileText, and one more from the toolbar). Playground demos at `/c/diff-viewer` (basic, with front-matter, large-diff scenarios).

  **`cinder/chat`** (domain-suite):
  Port `/Users/stevekinney/Developer/depict/packages/components/src/chat/` (~6,800 LOC across artifact/, container/, export/, input/, message/, scope/, utilities/). Internal deps: `alert`, `button`, `card`, `empty-state`, `input`, `dropdown` compound family (D3), `markdown-editor` (above). Package dep: `conversationalist@0.0.9`. Note: `chat-input.svelte` imports `MarkdownEditor` from markdown-editor — ensure that's ported first. One symbol in `message-content.svelte` imports from `@depict/markdown/rendering` — rewire to `@cinder/markdown/rendering`. Add playground demos at `/c/chat` (basic, streaming, with tool calls).

  Write a tree-shake fixture test at `packages/components/src/tree-shake.test.ts` that runs `bun build` on a fixture importing only `cinder/button` and asserts the output does NOT contain `shiki`, `unified`, `@milkdown/kit`, `diff-match-patch`, `prosemirror`, and contains no `--depict-*` custom property strings.

  Update `packages/components/package.json` exports and `src/index.ts` barrel for all four new components.

  Verification gate:
  - `bun run validate` green
  - `/c/chat`, `/c/diff-viewer`, `/c/surface`, `/c/markdown-editor` all render in playground
  - Tree-shake fixture passes

## Phase D5 — cinder/review-editor

- [ ] Port review-editor component — the final and most complex domain-suite component

  Port `/Users/stevekinney/Developer/depict/packages/components/src/review-editor/` (~5,600 LOC, 17 files) into `packages/components/src/components/review-editor/`.

  Wire to: `@cinder/{commentary,markdown,editor}`, `cinder/{markdown-editor,diff-viewer,selection-popover,view-switcher,diff-statistics,segmented-control,dropdown,button}` — all available from prior phases.

  Apply rename codemod (`cn` → `classNames`, `--depict-*` CSS tokens → `--cinder-*` per `tmp/port-inventory/css-token-map.md`). Apply browser-only import rewrites from `tmp/port-inventory/browser-only-imports.md`.

  Add playground demos at `/c/review-editor` (basic, with comments).

  Write an SSR fixture test: a simple Node script at `tmp/ssr-fixture.ts` that imports `review-editor` and all eight new domain-suite components and asserts they don't throw at module-eval time in a Node (adapter-node) context. Run with `bun run tmp/ssr-fixture.ts`.

  Update `packages/components/package.json` exports and `src/index.ts` barrel.

  Verification gate (full D5 gate):
  - `/c/review-editor` renders in playground
  - All nine new components (`segmented-control`, `diff-statistics`, `view-switcher`, `selection-popover`, `surface`, `chat`, `diff-viewer`, `markdown-editor`, `review-editor`) coexist in playground without CSS-token clashes
  - `bun run validate` green
  - `bun run validate:consumer` green (Node + SvelteKit fixtures)
  - `bun run validate:playground` green
  - SSR fixture (`tmp/ssr-fixture.ts`) runs without throwing
  - Tree-shake fixture still green
  - Interaction acceptance: review-editor can open a document, select text, switch view modes (rendered/source/diff)
