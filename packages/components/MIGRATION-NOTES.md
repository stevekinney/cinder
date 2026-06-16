# Component-Layout Migration Notes

This file is the planning note required by the per-component-layout migration plan. It records the answers to every open question before any code lands, so the PR description can copy from here.

Plan reference: `~/.claude/plans/i-want-to-reorganize-velvet-candy.md`.

## OQ#1 — Workspace filter syntax and playground name

- Workspace tool: Bun workspaces (root `package.json` lists `workspaces`; lockfile is `bun.lock`).
- Components package name: `@lostgradient/cinder` → filter `--filter=@lostgradient/cinder`.
- Playground package name: `@cinder/playground` → filter `--filter='@cinder/playground'` (quoted to escape the `@`).
- Other workspaces use the `@cinder/*` scope; only `packages/components` itself is unscoped.

Commands used in this PR:

- `bun run --filter=@lostgradient/cinder build`
- `bun run --filter=@lostgradient/cinder test`
- `bun run --filter=@lostgradient/cinder typecheck`
- `bun run --filter='@cinder/playground' dev`

## OQ#2 — Existing publication contract

The package ships **hybrid**: per-component subpath `svelte` condition → `./src/components/<name>.svelte`; `types` condition → `./dist/components/<name>.svelte.d.ts`. Root `.` exports include `svelte` → `./src/index.ts`, `types` → `./dist/index.d.ts`, and `node` → `./dist/server/index.js`.

`files` whitelist already includes both `dist` and `src/components/**/*.{ts,svelte,css}`.

Implication for this migration: the new layout matches the same hybrid contract. Each migrated component's `./<name>` subpath gets `svelte` → `./src/components/<name>/index.ts` and `types` → `./dist/components/<name>/index.d.ts`. Schema/variables subpaths follow the same dual condition shape.

`files` is updated to include the new directory shape:

- Add `src/components/**/*.json` and `src/components/**/*.md`.
- Add `src/schema-types.ts`.
- Existing globs already cover `.ts`, `.svelte`, `.css` recursively.

## OQ#3 — CSS import sites

CSS for each component lives at `packages/components/src/styles/components/<name>.css` and is aggregated by `packages/components/src/styles/components.css`, which is imported once by `src/styles/index.css` (the public `@lostgradient/cinder/styles` entry).

Test files load specific component CSS at runtime via `new URL('../styles/components/<name>.css', import.meta.url)` for token measurement — there are 22 such imports in `*.test.ts` files.

Migration path per pilot:

1. Move `src/styles/components/<name>.css` → `src/components/<name>/<name>.css`.
2. Update the `@import` line in `src/styles/components.css` to point at the new path: `@import '../components/<name>/<name>.css';`.
3. Update the test file's URL: `new URL('./<name>.css', import.meta.url)` (test now lives in the same dir as the CSS).

The aggregator approach means no Svelte component code changes — Svelte components never imported their own CSS file; the global stylesheet brought it in. That remains true after migration.

## OQ#4 — Codegen dependency policy

Approved devDependencies for `packages/components`:

- `ts-morph` (TypeScript compiler API wrapper). Used by the schema generator. Confirmed dev-only via the existing `files` allowlist (no node_modules paths whitelisted).
- `postcss` for the variables generator AST walk. Smallest, well-known parser; the workspace does not currently use `lightningcss`.

Both go in `devDependencies`. `bun pm pack --dry-run` is run in the Phase 1 verification step to confirm neither appears in the tarball.

## OQ#5 — Current public-export inventory

`packages/components/package.json` `exports` has these reserved (non-component) entries:

- `.` — root.
- `./styles` — styles entry.

Every other entry is a component subpath. Stable component subpaths plus 3 experimental deprecation aliases: `./experimental/connection-indicator`, `./experimental/json-viewer`, `./experimental/message`. (The `./experimental/timeline` and `./experimental/timeline-item` aliases were removed once their deprecation window closed — import `@lostgradient/cinder/timeline` and `/timeline-item` instead.)

Components whose name suggests they might be subcomponents but are in fact top-level public exports today (and must remain so):

- `./accordion-item`, `./button-group`, `./checkbox-group`, `./radio-group`, `./command-item`, `./diff-statistics`, `./dropdown-item`, `./dropdown-label`, `./dropdown-menu`, `./dropdown-separator`, `./dropdown-trigger`, `./feed-event`, `./grid-list-item`, `./navigation-item`, `./side-navigation-group`, `./side-navigation-item`, `./stacked-list-item`, `./stat`, `./stat-group`, `./tab`, `./tab-list`, `./tab-panel`, `./table-body`, `./table-cell`, `./table-header`, `./table-header-cell`, `./table-row`, `./tree-item`.

Migration rule: every name above gets its own top-level component directory. They are not absorbed as internal subcomponents of any parent.

## OQ#6 — Playground example inventory

Playground examples live at `packages/playground/src/examples/<name>/`. Pilots:

- `button` — has a route (`packages/playground/src/examples/button/`).
- `accordion` — has a route.
- `accordion-item` — no top-level route (rendered inside the `accordion` examples).
- `experimental/timeline` — historical pilot only; no route, and the alias is no longer active.
- `experimental/timeline-item` — historical pilot only; no route, and the alias is no longer active.

Verification path:

- `button`, `accordion` → Chrome MCP browser visit.
- `accordion-item` → consumer-fixture imports only (per §Verification step 8).
- `experimental/timeline`, `experimental/timeline-item` → historical consumer-fixture baselines from the pre-removal source; they do not describe active exports after OQ#5.

## OQ#7 — Pre-migration runtime-import baseline

Each pilot imported successfully in a clean Bun process from the then-current pre-migration source. The `experimental/timeline*` rows are historical baselines from before the aliases were removed, not active exports.

| Component                    | Baseline           |
| ---------------------------- | ------------------ |
| `button`                     | green              |
| `accordion`                  | green              |
| `accordion-item`             | green              |
| `experimental/timeline`      | green (historical) |
| `experimental/timeline-item` | green (historical) |

The three still-active pilots therefore get runtime-import assertions in the consumer fixture post-migration. Baselines for the remaining components are taken at the start of each later phase.
