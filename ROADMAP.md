# Cinder: Svelte 5 Design System — Complete Plan

## Context

`cinder` is a minimal Bun + TypeScript scaffold that will become a Svelte 5 design system. The user's scope spans five concrete deliverables:

1. A Bun plugin that transpiles `.svelte` components, wired into `bunfig.toml`.
2. A publishable component library with an authoring convention (flat files, module-level type exports, discriminated union props, data-attribute variants, **no** per-component `<style>` blocks).
3. Components ported from `../weft` and `../depict`, filtered to what belongs in a generic design system.
4. A Storybook-free playground served by `Bun.serve`, with per-component pages built from curated examples.
5. Static analysis (svelte/compiler + ts-morph) that reads component props and auto-generates controls in the playground.

This plan covers all five. Execution is sequenced into five phases so each phase builds on the previous one's verified guarantees — but **every phase is specified to execution rigor** (Files, Verification, scope boundaries) in this plan, not deferred to "a separate plan when its turn comes." The earlier Codex-approved Phase 1 survives intact because it's already rigorous; Phases 2–5 are filled in with equal concreteness.

The repo stays single-package until Phase 5 evaluates whether a workspace split is actually justified.

## Orchestration Model

**Parallelism**: work within each phase is dispatched across subagents whenever tasks are genuinely independent. Each phase's section below has a "Parallelization" subsection that names the subagent types and the work partition. Only tasks with hard sequential dependencies run serially.

**Per-phase review gate** (applies to every phase):

Precise semantics. The **invariant**: the commit on `main` that the next phase branches from is byte-identical to the hash both reviewers approved. No exceptions.

Mechanism:

1. **Prepare**: phase work is on a dedicated branch `phase/<N>-<slug>` (e.g., `phase/1-plugin-packaging`, `phase/3a-playground-shell`). All verification listed in the phase's "Verification" subsection must pass locally. The branch tip is the **review target**.
2. **Freeze the review target**: capture the tip hash with `git rev-parse HEAD`. Record it — **in `./tmp/`**, which is already gitignored (`tmp/plan-review/` was already excluded by the session preflight; `tmp/phase-review/` inherits the same exclusion). Review sentinels never enter the working tree of `main`. There is nothing tracked to clean up, so no cleanup commit exists.
3. **committee-review**: run `/committee-review` against the exact target hash. Review operates on `git diff <phase-base>..<target-sha>`. Record approval in `tmp/phase-review/<phase>-committee.approved` with the target hash inside.
4. **codex-advisor**: once committee-review has approved, run a `codex-advisor` review against the same target hash. Same diff. Record approval in `tmp/phase-review/<phase>-codex.approved` with the target hash.
5. **Disagreement resolution**: if the two reviews raise conflicting findings, the stricter blocking finding wins. If they disagree on whether something is blocking, treat as blocking. Make the fix → new commit → new target hash → restart from step 2. Both reviews must approve the **same** hash; approvals on earlier hashes are void the moment any new commit lands on the branch.
6. **Fast-forward-only merge to `main`**: once both `.approved` files reference the current target hash, merge the branch via `git merge --ff-only phase/<N>-<slug>`. If a non-fast-forward is required (because `main` advanced mid-review), rebase the branch onto `main`, which produces a new target hash → restart from step 2. No squash, no merge commit, no cleanup commit — the reviewed hash is literally the commit on `main`.
7. **Branch cleanup**: delete the local + remote branch (`git branch -d` / `git push origin --delete`). No commit. The phase's review sentinels in `./tmp/` can be deleted by the developer whenever; they're gitignored, so no commit is involved and nothing on `main` shifts.
8. **Proceed to the next phase**. The next phase branches from the exact hash both reviewers approved.

**Why review sentinels live in `./tmp/` (gitignored)**: round 9 finding #2. If sentinels were tracked, a cleanup commit would be needed after merge, which would introduce an unreviewed commit on `main` and break the "reviewed hash = shipped hash" invariant. By keeping sentinels untracked, there is no cleanup commit and the invariant holds.

**Why fast-forward-only**: same finding. A merge commit would also be an unreviewed object on `main`. Fast-forward preserves the reviewed commit as the literal tip.

**MCP outage retry policy**: if `codex-advisor` MCP is unavailable, retry up to 3 times over 30 minutes (10 min between attempts). If still unavailable after 3 retries, write `tmp/phase-review/<phase>-blocked.md` describing the outage, stop work on the phase, and surface the block to the user for a manual decision (continue waiting, skip with a documented override, or escalate). **Never** silently bypass. The gate is a hard dependency.

**What "review target" excludes**: fixture-tarball regenerations, `bun.lock` churn, and any in-review fixup commits all modify the target hash. Each fixup restarts the gate from step 2. This is deliberately strict — relaxing it reintroduces the "reviews examined a different diff than what shipped" hole.

---

## Architectural Decisions (locked)

| Area             | Decision                                                                                                             |
| ---------------- | -------------------------------------------------------------------------------------------------------------------- |
| Component layout | Flat `.svelte` under `src/components/`; generated granular subpath exports                                           |
| Styles           | No per-component `<style>` blocks. One shared stylesheet at `./styles` export                                        |
| Plugin           | Custom, ~40 lines, parameterized by `{ generate: 'client' \| 'server' }`                                             |
| Packaging        | Ship both source (`"svelte"` condition) and compiled server JS (`"node"` condition)                                  |
| Playground       | `Bun.serve` in-repo, per-component pages from hand-curated `*.example.svelte` files                                  |
| Static analysis  | svelte/compiler AST for structure + ts-morph for types; feeds playground controls                                    |
| CSS namespace    | `.cinder-*` classes, `data-cinder-*` attributes, `@layer cinder.*`, `--cinder-*` / `--_cinder-*` tokens              |
| Repo structure   | Single-package until Phase 5 evaluates workspace split                                                               |
| Dependencies     | `svelte`, `svelte2tsx`, `svelte-check`, `prettier-plugin-svelte`, `ts-morph`, `@testing-library/svelte`, `happy-dom` |

---

# Phase 1 — Plugin + Packaging + One Component ✅ COMPLETE

**Status**: Merged to `main` on 2026-04-27 via PR #1. Committee-reviewed (8 subagents + Codex, 4 rounds). All exit criteria met.

Codex-approved in 7 rounds of adversarial review. This is the foundation every later phase depends on.

## 1.1 Scope

Prove a single Svelte 5 component, authored in this repo, can be:

1. Imported under `bun test` (via `[test] preload`) and used inside `scripts/build.ts` (via programmatic `Bun.build`).
2. Bundled for SSR. Client-variant compilation is supported by the plugin but not shipped until Phase 5 adds a `"browser"` condition with its own fixture.
3. Installed from a packed tarball into two scratch consumer projects (SvelteKit under Vite + a Node-only consumer under `node`) and rendered without missing types.
4. Authored without a `<style>` block, with styles coming from the repo-level stylesheet.

## 1.2 Packaging Contract

```jsonc
{
  "name": "cinder",
  "type": "module",
  "sideEffects": ["**/*.css"],
  "files": ["dist", "src/index.ts", "src/components", "src/styles", "src/utilities", "README.md"],
  "exports": {
    ".": {
      "svelte": "./src/index.ts",
      "types": "./dist/index.d.ts",
      "node": "./dist/server/index.js",
    },
    "./styles": { "default": "./src/styles/index.css" },
  },
  "peerDependencies": { "svelte": ">=5.0.0 <5.1.0" },
}
```

Rationale locked by Codex rounds 1–7:

- **No `"browser"` / `"default"`.** Phase 1 ships only what it verifies. Browser-bundler path is Phase 5.
- **Peer range = one Svelte minor.** Bump cinder's minor in lockstep with Svelte minors. Policy goes in README.
- **`files` includes the full transitive source tree.** Tarball inspection asserts this.

### Declaration emission

```
dist/
├── index.d.ts                   (tsc --emitDeclarationOnly of src/index.ts)
├── server/{index.js, components/button.js}
└── components/button.svelte.d.ts  (svelte2tsx — preserves .svelte extension)
```

Barrel (`src/index.ts`):

```ts
export { default as Button } from './components/button.svelte';
export type { ButtonProps, ButtonVariant, ButtonSize } from './components/button.svelte';
```

`dist/index.d.ts` references `./components/button.svelte`; tsc resolution finds `./components/button.svelte.d.ts`. Same convention as `svelte-package`.

## 1.3 Plugin

```ts
// scripts/svelte-plugin.ts
import type { BunPlugin } from 'bun';
import { compile } from 'svelte/compiler';

export function sveltePlugin(
  options: { generate: 'client' | 'server' } = { generate: 'client' },
): BunPlugin {
  return {
    name: `svelte-${options.generate}`,
    setup(builder) {
      builder.onLoad({ filter: /\.svelte$/ }, async ({ path }) => {
        const source = await Bun.file(path).text();
        const result = compile(source, {
          filename: path,
          generate: options.generate,
          css: 'external',
          dev: Bun.env.NODE_ENV !== 'production',
        });
        if (result.css?.code?.trim()) {
          throw new Error(
            `[svelte-plugin] <style> block in ${path} — not allowed. Put styles in src/styles/.`,
          );
        }
        return { contents: result.js.code, loader: 'js' };
      });
    },
  };
}

export default sveltePlugin;
```

## 1.4 Preload Scoping

`bunfig.toml`:

```toml
[loader]
".md" = "text"
[run]
bun = true
[test]
preload = ["./scripts/preload.ts"]
```

`scripts/preload.ts` calls `Bun.plugin(sveltePlugin({ generate: 'client' }))`. Only `bun test` auto-loads it. `scripts/build.ts` registers programmatically. Ad-hoc `bun run some.ts` that imports `.svelte` needs `bun --preload ./scripts/preload.ts some.ts` — documented, not a test gate.

## 1.5 CSS Contract

`src/styles/index.css`:

```css
@layer cinder.tokens, cinder.foundation, cinder.components, cinder.utilities;
@import './tokens.css' layer(cinder.tokens);
@import './foundation.css' layer(cinder.foundation);
@import './components.css' layer(cinder.components);
@import './utilities.css' layer(cinder.utilities);
```

- **Namespace**: `.cinder-*` classes, `data-cinder-*` attributes.
- **Tokens**: public `--cinder-*`, private `--_cinder-*`.
- **Reset**: `foundation.css` uses `:where()` for zero specificity.

## 1.6 `<style>`-Disallowed Enforcement

Two parser-based layers:

1. Plugin throws on non-empty `result.css.code` (primary).
2. `src/components.test.ts` parses every `.svelte` with `svelte/compiler.parse` and asserts `ast.css === null` (safety net).

No hook-level grep.

## 1.7 Repo Workflow Gate

Introducing `.svelte` files affects oxlint/prettier/lint-staged/husky. Concrete changes:

- `tsconfig.json`: `typecheck` runs `tsc --noEmit` + `bunx svelte-check --tsconfig tsconfig.json`; `exclude` grows `"fixtures"`.
- `.oxlintrc.json`: `ignorePatterns` grows `.svelte` and `fixtures/**`.
- `.prettierrc.json`: `plugins` grows `prettier-plugin-svelte`.
- `package.json`: `lint-staged` grows `"**/*.svelte": ["prettier --write"]`.
- `scripts/validate-commit-workflow.ts` (standalone serial script, **not** under `bun test`): creates a tmp isolated git repo, seeds configs, writes a mis-formatted `.svelte` + `.css`, runs `bun exec lint-staged`, asserts exit 0 + golden byte-match formatting. Bound to `bun run validate:workflow`.

## 1.8 Component

`src/components/button.svelte`:

- Module script exports `ButtonProps`, `ButtonVariant`, `ButtonSize`.
- Discriminated union (button vs link).
- `$props()` with defaults, `Snippet` children.
- `data-cinder-variant` attribute selectors.
- No `<style>`.

## 1.9 Consumer Fixtures

```
fixtures/
├── sveltekit-consumer/          (standalone; "svelte" + "types" + "./styles")
│   ├── package.json             (cinder from tarball; @sveltejs/adapter-node)
│   ├── svelte.config.js, vite.config.ts, tsconfig.json (NOT extends root)
│   └── src/{app.html, app.css, routes/+page.svelte}
└── node-consumer/               (standalone; "node" + "types", runs under Node)
    ├── package.json             (engines.node pinned)
    ├── tsconfig.json            (emits ESM JS to dist/)
    └── src/render.ts            (Svelte's render() API)
```

Root `tsconfig` and oxlint don't descend into `fixtures/`. Each fixture has its own toolchain.

`scripts/validate-consumers.ts`:

1. `bun run build` → `dist/server/`, `dist/components/button.svelte.d.ts`, `dist/index.d.ts`.
2. `bun pm pack` → `cinder-0.0.1.tgz`.
3. **Tarball inspection**: positive assertions (every path referenced by `exports` + transitively from `dist/index.d.ts` is present) + negative assertions (no `fixtures/`, `tmp/`, `dist/client/`, stray `.svelte` outside `src/components/`).
4. `fixtures/sveltekit-consumer/`: `bunx svelte-check` + `bunx vite build` (adapter-node) + CSS-bundle inspection (built CSS contains `.cinder-button` and `@layer cinder.components`) + boot + `curl /` → HTTP 200 + body contains `cinder-button`.
5. `fixtures/node-consumer/`: `bunx tsc` (emits to fixture's `dist/`) + `node dist/render.js` → stdout contains `<button class="cinder-button"`. `validate-consumers.ts` fails fast if Node isn't on PATH.

## 1.10 Files (Phase 1)

**Create**:

- `scripts/svelte-plugin.ts`, `scripts/preload.ts`, `scripts/validate-consumers.ts`, `scripts/validate-commit-workflow.ts`
- `src/index.ts`, `src/components/button.svelte`
- `src/styles/{index,tokens,foundation,components,utilities}.css`
- `src/utilities/class-names.ts`
- `src/components.test.ts`
- `fixtures/sveltekit-consumer/**`, `fixtures/node-consumer/**`

**Modify**:

- `bunfig.toml` (`[test] preload`)
- `package.json` (exports, sideEffects, peerDeps, devDeps: `svelte`, `svelte2tsx`, `svelte-check`, `prettier-plugin-svelte`; scripts: `validate:consumer`, `validate:workflow`; lint-staged glob for `.svelte`)
- `scripts/build.ts` (Bun.build server + svelte2tsx + tsc)
- `tsconfig.json` (svelte types, `fixtures` in exclude)
- `.oxlintrc.json` (ignorePatterns: `.svelte`, `fixtures/**`)
- `.prettierrc.json` (prettier-plugin-svelte)

**Do not touch**: `scripts/husky/post-checkout.ts`, `scripts/husky/post-merge.ts`, `scripts/husky/utilities.ts`, existing `src/index.ts` + `src/index.test.ts`.

## 1.11 Verification (Phase 1)

1. `bun test src/components.test.ts` — plugin compiles, AST `css === null`, plugin throws on fixture `<style>`.
2. `bun run validate:workflow` — isolated-repo lint-staged simulation.
3. `bun run build` + `bun run validate:consumer` — tarball inspection + both fixtures.
4. `bun run validate` — composes typecheck + lint + test + validate:workflow + validate:consumer.

## 1.12 Parallelization

Phase 1 has a hard sequential core but several independent tasks. Dispatch in parallel after the plugin lands:

| Task                                                                                        | Subagent           | Depends on                                          |
| ------------------------------------------------------------------------------------------- | ------------------ | --------------------------------------------------- |
| Write `scripts/svelte-plugin.ts` + `scripts/preload.ts`                                     | general-purpose    | — (first; everything else waits)                    |
| Write `src/components/button.svelte` + `src/styles/*.css` + `src/utilities/class-names.ts`  | ux-designer        | plugin                                              |
| Update `scripts/build.ts` for the new pipeline                                              | general-purpose    | plugin                                              |
| Build `fixtures/sveltekit-consumer/` + its `test.ts`                                        | frontend-architect | plugin + barrel + build                             |
| Build `fixtures/node-consumer/` + its `test.ts`                                             | general-purpose    | plugin + barrel + build                             |
| Write `src/components.test.ts`                                                              | testing-expert     | component + plugin                                  |
| Write `scripts/validate-consumers.ts` (including tarball inspection)                        | general-purpose    | both fixtures                                       |
| Write `scripts/validate-commit-workflow.ts`                                                 | general-purpose    | config changes (oxlint/prettier/lint-staged) landed |
| Update `package.json`, `tsconfig.json`, `bunfig.toml`, `.oxlintrc.json`, `.prettierrc.json` | general-purpose    | — (can run in parallel with component authoring)    |

The two fixture tasks run in parallel after the plugin, component, and build are done. The `validate-consumers.ts` orchestrator is written after both fixtures exist. Component authoring and config updates overlap.

## 1.13 Phase 1 Exit Criteria

- [x] Every verification step above is green on main.
- [x] README documents: export conditions shipped, peer-range policy, consumer invocation patterns.
- [x] `/committee-review` passes (8 subagents + Codex, 4 rounds, iteration cap reached with all blocking items resolved). Branch merged to `main` via PR #1 on 2026-04-27.
- [ ] `bun pm pack` + install into a clean SvelteKit scaffold outside the repo — manual one-time smoke test, not automated. (Not yet confirmed done; low priority since `validate:consumer` covers this programmatically.)

---

# Phase 2 — Component Port ← NEXT

## 2.1 Goal

Port every component from weft + depict that belongs in a generic Svelte 5 design system, under the Phase 1 conventions (flat files, module-level type exports, data-attribute variants, no `<style>`, shared classes in `components.css`). Grow `src/components/` from 1 to ~20 components. Grow `src/styles/components.css` correspondingly.

Phase 2 stops being "port" and starts being "new features" at the point where we add something neither source repo has; that's Phase 4's territory, not here.

## 2.2 Inventory

Explicit table. Every row is a migration decision, not a vague "reuse directly":

| Component      | Source        | Source path                                       | Mode    | Utilities used        | Notes                                                                   |
| -------------- | ------------- | ------------------------------------------------- | ------- | --------------------- | ----------------------------------------------------------------------- |
| Alert          | weft          | `src/dashboard/components/alert.svelte`           | adapt   | `cn`                  | Variant union + icon snippet. Strip domain-specific variants.           |
| Badge          | weft          | `src/dashboard/components/badge.svelte`           | adapt   | `cn`, `truncate`      | Variant + size unions. Remove `code` prop.                              |
| Button         | weft + depict | already Phase 1                                   | done    | `cn`                  | —                                                                       |
| Card           | depict        | `src/card/card.svelte`                            | adapt   | `cn`                  | Discriminated union (header snippet vs title+description).              |
| DataList       | weft          | `src/dashboard/components/data-list.svelte`       | adapt   | `cn`                  | Generic component: `<script generics="T">`.                             |
| EmptyState     | weft          | `src/dashboard/components/empty-state.svelte`     | adapt   | `cn`                  | Icon + title + description + action snippet.                            |
| Input          | weft + depict | both                                              | adapt   | `cn`                  | Required `id`, `aria-describedby` wiring, `$bindable` value.            |
| Modal          | weft          | `src/dashboard/components/modal.svelte`           | adapt   | `cn`                  | `<dialog>`, `$state` + `$effect` for open sync, body + footer snippets. |
| NavigationBar  | weft          | `src/dashboard/components/navigation-bar.svelte`  | adapt   | `cn`                  | Brand + items snippets.                                                 |
| NavigationItem | weft          | `src/dashboard/components/navigation-item.svelte` | adapt   | `cn`                  | Link or button; `data-cinder-active`.                                   |
| Page           | weft          | `src/dashboard/components/page.svelte`            | adapt   | `cn`                  | Header + content. Rename to `PageLayout`.                               |
| Pagination     | weft          | `src/dashboard/components/pagination.svelte`      | adapt   | `cn`, `format-number` | `$bindable` page; formats total-count display.                          |
| Select         | weft + depict | both                                              | adapt   | `cn`                  | `$bindable` value; options via `Snippet<[T]>`.                          |
| Skeleton       | weft          | `src/dashboard/components/skeleton.svelte`        | copy    | `cn`                  | Trivial.                                                                |
| Spinner        | weft          | `src/dashboard/components/spinner.svelte`         | copy    | `cn`                  | Trivial.                                                                |
| Textarea       | depict        | `src/textarea/textarea.svelte`                    | adapt   | `cn`                  | Same pattern as Input.                                                  |
| Toggle         | weft          | `src/dashboard/components/toggle.svelte`          | adapt   | `cn`                  | `$bindable` checked; keyboard handling.                                 |
| Tooltip        | weft          | `src/dashboard/components/tooltip.svelte`         | rewrite | `cn`                  | CSS anchor positioning (modern baseline).                               |
| Accordion      | depict        | `src/accordion/accordion.svelte`                  | adapt   | `cn`                  | Generic collapsible.                                                    |
| Dropdown       | depict        | `src/dropdown/dropdown.svelte`                    | adapt   | `cn`                  | `<details>` or custom popover.                                          |

The "Utilities used" column is assignment-mechanical: an agent for a component is guaranteed that its listed utilities exist by the time it starts (Wave 0 finishes before Wave 1). `cn` is Phase 1's `src/utilities/class-names.ts` (already present); `truncate`, `format-number`, and the other formatters are Phase 2's Wave 0 outputs. No component in this inventory uses `format-date` or `format-duration` directly, but they're still ported in Wave 0 because Phase 4+ examples and future components will need them — and porting them all together is cheaper than porting individually.

**Explicitly dropped** (listed so they don't silently slip in): weft's `agent-*`, `workflow-*`, `event-*`, `json-viewer`, `schedule-list`, `review-item`, `execution-deadline`, `search-attributes-table`; depict's entire `chat/*` subtree; any `$app/paths` / `$app/environment` SvelteKit stub references.

## 2.3 Per-Component Acceptance Criteria

Every component, without exception:

1. Flat file `src/components/<kebab-name>.svelte`.
2. Module script exports `${Pascal}Props` plus any `${Pascal}Variant` / `${Pascal}Size` literal unions. JSDoc on each exported type.
3. Uses `$props()` destructuring with defaults. Every destructured prop has either an explicit default or a type annotation (required for the Phase-4 analyzer).
4. Snippet props are typed as `Snippet` or `Snippet<[...]>` — never untyped `Function` or arbitrary callable types.
5. Any `$bindable(...)` defaults are literal values (not expressions), so the analyzer can extract the default mechanically.
6. No `<style>` block. Styling lives in `src/styles/components/<name>.css` (owned by this component; not in shared `components.css`).
7. `class?: string` prop merged via `cn()` utility.
8. HTML attributes spread via `{...rest}` after destructuring.
9. **For interactive components** (Modal, Tooltip, Dropdown, Accordion, Toggle, Select, Pagination): documented keyboard behavior (arrow keys, Enter, Escape, Tab trapping where appropriate) and ARIA attributes. Each has a `<name>.a11y.md` sibling file that lists expected keyboard interactions and ARIA roles; consumed by Phase 3b examples and Phase 4's manifest.
10. **Passes `src/convention.test.ts` the moment it lands.** This test is introduced in Phase 2 (not Phase 4) so analyzer conventions are enforced from day one rather than as retroactive tax. The test asserts: module script exports `${Pascal}Props`; `$props()` is destructured; every destructured prop has a default or annotation; `Snippet` props have `Snippet` in their type; `$bindable(...)` defaults are literals. Codex round 8 finding #5.
11. Has a `<name>.test.ts` with at least: renders, applies variant attribute, props are typed, no console errors. Uses `@testing-library/svelte` + `happy-dom` (added as Phase 2 devDeps).
12. Is re-exported from `src/index.ts` (the barrel) by name, and via a subpath export in `package.json` (see 2.5).

## 2.4 Styles — Disjoint Write Ownership

Round 8 finding #3: the prior sketch had 18 agents writing into shared `components.css` + `tokens.css`. Merge conflicts guaranteed. Fixed via partition-by-owner:

**Per-component CSS partials**. Each component owns one file in each aggregated category:

```
src/styles/
├── index.css                          (unchanged; imports the aggregate files below)
├── tokens.css                         (Wave-2-owned aggregator — @imports tokens-base.css + every tokens/<name>.css)
├── tokens-base.css                    (Phase-1 base tokens only: spacing, radii, typography, motion, z-index)
├── foundation.css                     (unchanged)
├── components.css                     (Wave-2-owned aggregator — @imports every components/<name>.css)
├── utilities.css                      (stub)
├── components/
│   ├── alert.css
│   ├── badge.css
│   ├── button.css                     (created in Phase 1 at this path, not in shared components.css)
│   ├── card.css
│   └── <one .css per component>
└── tokens/
    ├── alert.css                      (optional; only when a component exposes public tokens)
    └── <component>.css
```

Both aggregators — `components.css` and `tokens.css` — contain **only** `@import` statements and are **single-owner** (Wave-2 consolidation agent). Wave-1 component-port agents write only into `src/styles/components/<name>.css` and optionally `src/styles/tokens/<name>.css`, never into the aggregators. This matches the component-partition and closes Codex round-9 finding #1 (the token path is now symmetric with the component-style path).

`tokens-base.css` isolates Phase-1-shipped tokens (spacing, radii, typography scale, motion, z-index — things not tied to a specific component) so the `tokens.css` aggregator can `@import` both the base and the per-component partials cleanly. The base file was `tokens.css` in Phase 1; Phase 2 renames it to `tokens-base.css` when it introduces the aggregator. The rename is a one-line change in Phase 1's output plus the aggregator creation — done by Wave 2's consolidation agent alongside its other work.

Phase 1's migration touch-up: when Phase 2 lands, `src/styles/tokens.css` moves to `src/styles/tokens-base.css`, and a new `src/styles/tokens.css` is written by Wave 2 containing `@import './tokens-base.css';` followed by `@import './tokens/<name>.css';` entries. This is listed in Phase 2's Modify section below. `src/styles/index.css`'s `@import './tokens.css' layer(cinder.tokens);` line is unchanged because the file name at that path is still `tokens.css` — just with different content.

A component port agent owns, and writes **only** to, these files:

1. `src/components/<name>.svelte`.
2. `src/components/<name>.test.ts`.
3. `src/components/<name>.a11y.md` (if interactive).
4. `src/styles/components/<name>.css`.
5. `src/styles/tokens/<name>.css` (if component has public tokens; optional).

Agents never touch shared aggregators (`components.css`, `tokens.css`), the barrel (`src/index.ts`), the exports generator, fixture routes, or `package.json`. Those are Wave 2's job.

Tokens: public token names follow `--cinder-<component>-<prop>`; private follow `--_cinder-<component>-<prop>`. Naming is enforced by a test in `src/styles/tokens.test.ts` (parses each file, asserts every `--cinder-<component>-*` declaration's component prefix matches its file name).

## 2.5 Subpath Exports (generated)

`scripts/generate-exports.ts`:

- Runs `Bun.Glob('src/components/*.svelte').scan()`.
- For each component, appends to `package.json#exports` a subpath:

  ```jsonc
  "./button": {
    "svelte": "./src/components/button.svelte",
    "types":  "./dist/components/button.svelte.d.ts"
  }
  ```

- Runs as the first step of `scripts/build.ts` (before `Bun.build`), rewriting only the `exports` key in-place. Idempotent.
- A test `src/exports-drift.test.ts` re-runs the generator into a tmp file and diffs against the committed `package.json`; fails on drift.

## 2.6 Utilities Port

Port only generic utilities from weft: `class-names.ts` (already in Phase 1), `format-date.ts`, `format-duration.ts`, `format-number.ts`, `truncate.ts`. Each gets a `.test.ts`. Domain-specific utilities (`workflow-tags.ts`, `tenant-quota.ts`, `workflow-retention.ts`, `workflow-list-data.ts`) are **not** ported.

## 2.7 Files (Phase 2)

**Create**:

- `src/components/<18 new .svelte files>` — per inventory.
- `src/components/<18 new .test.ts files>` — one per component.
- `src/components/<N new .a11y.md files>` — for interactive components.
- `src/styles/components/<19 .css files>` — one per component (including button.css migrated from Phase 1's aggregate components.css).
- `src/styles/tokens/<N .css files>` — optional, one per component with public tokens.
- `src/utilities/{format-date,format-duration,format-number,truncate}.ts` + their `.test.ts`.
- `scripts/generate-exports.ts`.
- `src/exports-drift.test.ts`.
- `src/convention.test.ts` (moved from Phase 4 into Phase 2 per Codex round 8 finding #5).
- `src/styles/tokens.test.ts` (enforces `--cinder-<component>-*` naming).

**Modify** (all single-owner in Wave 2):

- `src/styles/components.css` — rewritten as `@import` aggregator over `src/styles/components/*.css`.
- `src/styles/tokens.css` — **content** rewritten as aggregator over `./tokens-base.css` + `src/styles/tokens/*.css`; **path** unchanged.
- `src/styles/tokens-base.css` — new file holding Phase-1's original `tokens.css` content (spacing, radii, typography, motion, z-index). Created by `git mv src/styles/tokens.css src/styles/tokens-base.css` then writing the new aggregator at the original path.
- `src/index.ts` — re-export every component + its type.
- `package.json` — generated subpath `exports`; add devDeps `@testing-library/svelte`, `happy-dom`.
- `scripts/build.ts` — run `generate-exports.ts` first; expand svelte2tsx over all components.
- `fixtures/sveltekit-consumer/src/routes/+page.svelte` — import every component from `cinder`; strong assertion that every subpath export resolves.
- `src/components/button.svelte` — move its inline styles (if any were accidentally kept in Phase 1's aggregate) to `src/styles/components/button.css`. Phase 1 already placed button's styles at that path; this is a no-op check, not a rewrite.

## 2.8 Verification (Phase 2)

1. All Phase 1 verification passes.
2. Every component has a passing test.
3. `src/exports-drift.test.ts` passes (subpath exports match glob result).
4. `fixtures/sveltekit-consumer/` imports one of every component from `cinder` and from at least one subpath (`cinder/button`, `cinder/alert`, etc.); `svelte-check` + `vite build` succeeds; `curl /` returns HTML containing every component's root class.
5. `fixtures/node-consumer/` SSR-renders each interactive component and asserts the documented ARIA role/attribute is present.
6. Tarball inspection grows: every `src/components/*.svelte`, every `dist/components/*.svelte.d.ts`, every utility `.ts` in the whitelist is present; no test files, no `.a11y.md` (those stay in source tree but aren't published).

## 2.9 Parallelization

Phase 2's parallel wave has **disjoint write sets** per agent so merge conflicts are structurally impossible (not just unlikely). Four waves (round 10 added Wave 0):

**Wave 0 (single agent, runs before Wave 1)**: `general-purpose` ports the four generic utilities plus their tests. Write set:

1. `src/utilities/format-date.ts` + `.test.ts`
2. `src/utilities/format-duration.ts` + `.test.ts`
3. `src/utilities/format-number.ts` + `.test.ts`
4. `src/utilities/truncate.ts` + `.test.ts`

Utilities are small, internally consistent, and don't depend on components. Pulling them ahead of Wave 1 means every component worker can freely `import { formatDate } from '../utilities/format-date.ts'` without risking either a missing-module error or duplicated-logic cleanup. Round 10 finding #1 addressed.

**Wave 1 (18 parallel agents, one per component)**: each agent's write set is strictly:

1. `src/components/<name>.svelte`
2. `src/components/<name>.test.ts`
3. `src/components/<name>.a11y.md` (if interactive)
4. `src/styles/components/<name>.css`
5. `src/styles/tokens/<name>.css` (optional)

No agent touches `components.css`, `tokens.css`, `src/index.ts`, fixture routes, `package.json`, or another component's files. Prompt template for every agent:

- Component name (e.g., Alert) + kebab file name (alert).
- Migration mode from the inventory (`copy` / `adapt` / `rewrite`).
- Source path (full path in weft or depict).
- Explicit acceptance criteria from 2.3, including the Phase-4-required conventions (2.3.10: pass `src/convention.test.ts`). Agent must self-verify by running `bun test src/convention.test.ts -- <name>` before returning.
- Write-set boundary — "only these five paths; any write outside fails the review."

For interactive components (Modal, Tooltip, Dropdown, Accordion, Toggle, Select, Pagination, Textarea, Input), use `ux-designer` — explicit a11y + keyboard requirements, produces the `.a11y.md`. For others, `general-purpose`.

**Wave 2 (single consolidation agent, after Wave 1 is fully complete)**: `general-purpose` owns all shared-file writes:

1. Writes `scripts/generate-exports.ts` and runs it → updates `package.json#exports` with subpath entries.
2. Updates `src/styles/components.css` to `@import` every Wave-1 component partial in alphabetical order.
3. Updates `src/styles/tokens.css` to `@import` every Wave-1 component token partial.
4. Updates `src/index.ts` (barrel) to re-export every component + its types.
5. Updates `fixtures/sveltekit-consumer/src/routes/+page.svelte` to import every component.
6. Writes `src/styles/tokens.test.ts` (the naming-enforcement test).
7. Writes `src/exports-drift.test.ts`.

Single agent because all seven writes are coordinated: the barrel list, the exports list, the `components.css` import order, and the fixture imports must agree. Running `bun run validate` at the end confirms consistency.

**Wave 3 (parallel)**:

- `testing-expert` — audits every Wave-1 `.test.ts` for coverage parity + adds missing cases.
- `general-purpose` — extends `scripts/validate-consumers.ts`'s tarball-inspection expected-paths list.

Wave-3 agents have disjoint write sets: tests, validate-consumers.ts. No conflict. (Utilities were ported in Wave 0.)

Three waves total. Each wave is the sync point before the next.

## 2.10 Phase 2 Exit Criteria

- ~20 components live under `src/components/`, each with a test and (for interactive ones) an a11y doc.
- Both fixtures exercise every component.
- Consumer-fixture HTML size + build time tracked in commit message so Phase 3 has a baseline.
- `/committee-review` passes. `codex-advisor` passes against the same hash. Branch fast-forwards into `main`. Phase's feature branch deleted; review sentinels under `./tmp/phase-review/` persist until the developer deletes them (untracked; no commit involved).

---

# Phase 3 — Playground (Bun.serve, curated examples)

Phase 3 splits into two sub-phases because the playground's shell + server can be built against Phase 1's single component, but the example-authoring is pointless until Phase 2's component set exists.

- **Phase 3a (Shell + Server)**: built against Phase 1's Button only. Can run in parallel with Phase 2.
- **Phase 3b (Example Authoring)**: authors the 40–60 example files across the component set. Hard dependency on Phase 2 being committed so component APIs are stable.

Each sub-phase has its own review gate (committee-review + codex-advisor + commit + sentinel cleanup).

## 3.1 Goal

A component playground served by `Bun.serve` that lets the implementer and the user open a URL, see every component rendered in realistic scenarios, and see per-example source code. No Storybook. No framework lock-in. Hand-curated examples, not auto-discovered props (that's Phase 4).

## 3.2 Curated Examples

Examples live **outside** `src/` so they can't accidentally leak into the published tarball, the subpath-exports generator, discovery, or the convention tests. Layout:

```
scripts/playground/examples/
├── button/
│   ├── primary.example.svelte
│   ├── link.example.svelte
│   └── loading.example.svelte
├── alert/
│   ├── info.example.svelte
│   └── warning.example.svelte
└── <one subdirectory per component>
```

Each `*.example.svelte` imports the subject component via its published path (`import { Button } from '../../../../src/index.ts';` or the subpath `import Button from 'cinder/button';` once Phase 2's exports land and workspace-relative imports resolve).

Convention:

- Directory is the component's kebab name (e.g., `button/`, `alert/`).
- File is `<scenario>.example.svelte`; scenario kebab-case.
- Module script exports `title: string` and `description?: string` for card labels.
- No test per example — `svelte-check` in the playground's own tsconfig catches prop misuse.

This placement makes the relationship explicit:

- `src/components/*.svelte` — published source.
- `scripts/playground/examples/<component>/*.example.svelte` — playground-only demo usage.
- `package.json#files` excludes `scripts/` (already does, since only `dist` + specific `src/` subtrees are listed).
- Phase 2's `scripts/generate-exports.ts` scans `src/components/*.svelte` only; examples are invisible to it.
- Phase 4's `src/convention.test.ts` asserts rules on `src/components/*.svelte`; examples aren't subject to them.
- Tarball-inspection's negative assertions grow to confirm no `scripts/playground/` content ships.

## 3.3 Server

`scripts/playground/server.ts`:

```ts
import { Glob } from 'bun';
import { renderShell } from './render-shell.ts';
import { discoverExamples } from './discover.ts';

Bun.serve({
  port: 4173,
  async fetch(request) {
    const url = new URL(request.url);
    // Routes:
    // GET /              → playground shell (sidebar + main frame)
    // GET /c/:name       → per-component page (renders all examples for that component)
    // GET /bundle/:name.js → per-component ESM bundle (Bun.build with sveltePlugin({generate:'client'}))
    // GET /styles.css    → cinder's stylesheet (resolved @imports inlined for the browser)
    // GET /events        → Server-Sent Events stream for reload signals
  },
});
```

Every route is explicit, not hand-waved. The bundle route runs `Bun.build` on demand with `sveltePlugin({ generate: 'client' })` — the same plugin Phase 1 built but in client mode. This is where the plugin's client branch (unit-tested in Phase 1, never shipped) starts earning its keep.

## 3.4 Reload

`fs.watch` on `src/` triggers an SSE event to all connected clients; the client's JS does a hard reload of the current page. Not HMR — a full reload. Label it as "reload-on-save" in code and docs so nobody mistakes it for stateful HMR.

## 3.5 Shell UI

`scripts/playground/app.svelte` (yes, dog-fooded):

- Sidebar: list of components (from `Bun.Glob('src/components/*.svelte')`) grouped alphabetically.
- Main: iframe pointing at `/c/:name`. Iframe isolates per-component styles and JS so one broken example doesn't take down the shell.
- Footer: link to source, link to `a11y.md` for interactive components.

`scripts/playground/component-page.svelte` (rendered by `/c/:name`):

- Renders each `*.example.svelte` in a labeled card.
- Below each card: a `<details>` with the example's source code (read server-side, highlighted via `shiki` or a lighter syntax-highlighter; decision deferred until the first implementation attempt).

## 3.6 Build

A Phase 3 static-build script `scripts/playground/build-static.ts` can produce a static-HTML version of the playground for deploys (no `Bun.serve` at runtime). Useful for GitHub Pages / Vercel. Optional; flip it on when needed.

## 3.7 Files

### Phase 3a (Shell + Server)

**Create**:

- `scripts/playground/server.ts`
- `scripts/playground/discover.ts` (Bun.Glob over components and examples; safe even when examples/ is sparse in Phase 3a)
- `scripts/playground/render-shell.ts`
- `scripts/playground/app.svelte`
- `scripts/playground/component-page.svelte`
- `scripts/playground/index.html`
- `scripts/playground/tsconfig.json` (isolated tsconfig; includes `scripts/playground/**` + `src/**`; does not extend root)
- `scripts/playground/discover.test.ts` — unit-tests the glob + parse logic against fixtures.
- `scripts/playground/examples/button/primary.example.svelte` (one example to smoke-test the pipeline in Phase 3a; full example set is Phase 3b).

**Modify**:

- `package.json` — add `"playground": "bun --hot run scripts/playground/server.ts"`. No new runtime deps.
- `.oxlintrc.json` — add `scripts/playground/**/*.svelte` to `ignorePatterns`.

### Phase 3b (Example Authoring)

**Create**:

- `scripts/playground/examples/<component>/<scenario>.example.svelte` × 40–60 files across ~20 components. Each component directory has 1+ scenarios per 3.2's convention.
- `scripts/playground/build-static.ts` (optional; only if we decide to ship static variant).

**Modify**:

- `.gitignore` — add `scripts/playground/dist/` if static-build is enabled.

**Tarball impact**: none in either sub-phase. Playground is dev-only.

## 3.8 Verification (Phase 3)

1. `bun run playground` starts, serves 200 on `/`.
2. Sidebar lists every component from `src/components/*.svelte`.
3. Every component's page renders every example without console errors (automated by a Playwright-free check: `validate-playground.ts` boots the server, crawls each `/c/:name`, uses `fetch()` to retrieve the page, and asserts the returned HTML contains one `<div class="example-card">` per expected example).
4. Saving a component file triggers SSE → page reloads within ~500ms (measured, not eyeballed: test spawns the server, opens an SSE connection, `touch`es a component file, asserts an event arrives within the window).
5. `bun run playground:build` (if enabled) produces a static-HTML output that, when served by `bun --bun serve scripts/playground/dist/`, behaves identically to the live server for the `/` and `/c/:name` routes.

## 3.9 Parallelization

### Phase 3a (Shell + Server)

**Wave 1 (parallel)**:

- `general-purpose` — implements `server.ts` + `discover.ts` + `render-shell.ts`. Single agent because routes share state (file cache, SSE clients).
- `ux-designer` — implements `app.svelte` + `component-page.svelte` + `index.html` + shell CSS. Independent of the server as long as the route shapes are agreed upfront (documented in 3.3).
- `general-purpose` — writes one smoke-test example (`scripts/playground/examples/button/primary.example.svelte`) to exercise the pipeline end-to-end.

**Wave 2 (serial)**:

- `testing-expert` — writes `discover.test.ts` + `validate-playground.ts` (boots server, crawls routes, asserts expectations, runs SSE reload timing test against the one smoke example).

### Phase 3b (Example Authoring)

**Wave 1 (parallel)**: one `general-purpose` agent per component. Each agent receives the component's type exports + `.a11y.md` + sibling source and produces 2–4 `<scenario>.example.svelte` files in that component's `scripts/playground/examples/<component>/` directory. Because each agent writes into its own directory only, there are no write races.

**Wave 2 (serial)**:

- `testing-expert` — extends `validate-playground.ts` to assert every component's page lists at least one example card (and the expected number based on filesystem discovery). Updates the reload-timing test to a representative component.

**Wave 3 (optional, parallel)**:

- `general-purpose` — implements `build-static.ts` if we decide to ship a static variant.

## 3.10 Phase 3 Exit Criteria

### Phase 3a exit

- Playground runs locally via `bun run playground` against the Phase 1 Button only.
- Shell renders; sidebar lists Button; `/c/button` renders the one smoke example; fs.watch → SSE reload works within ~500ms.
- `validate-playground.ts` is part of `bun run validate:playground` called from `bun run validate`.
- `/committee-review` passes. `codex-advisor` passes against the same hash. Branch fast-forwards into `main`. Phase's feature branch deleted; review sentinels under `./tmp/phase-review/` persist until the developer deletes them (untracked; no commit involved).

### Phase 3b exit

- Every component from Phase 2 has at least one example under `scripts/playground/examples/<component>/`.
- `bun run playground` sidebar and per-component pages render the full set without console errors.
- `/committee-review` passes. `codex-advisor` passes against the same hash. Branch fast-forwards into `main`. Phase's feature branch deleted; review sentinels under `./tmp/phase-review/` persist until the developer deletes them (untracked; no commit involved).

---

# Phase 4 — Static Analysis + Auto-Controls

## 4.1 Goal

Auto-generate interactive controls in the playground from static analysis of each component's props type. Without this, the playground is "curated examples" — good, but the user explicitly asked for static-analysis-driven controls.

## 4.2 Approach

Two-source merge:

1. **svelte/compiler.parse** over each `.svelte` file — walks the AST to extract prop names from `let { ... } = $props()`, which props are `$bindable(...)`, which are `Snippet`, and default values from the destructuring pattern.
2. **ts-morph** loaded against the module script block — finds `export type ${Name}Props`, resolves each property's type. Literal unions → `select`. `boolean`/`number`/`string` → matching control. `Snippet` → documented but non-interactive. Unknown → `unknown` with `rawType` string.

Merge rule: svelte/compiler wins on structural disagreements (e.g., if ts-morph claims a prop exists but `$props()` destructuring doesn't list it, the destructuring is truth).

## 4.3 Output Shape

```ts
type ComponentManifest = {
  name: string; // 'Button'
  file: string; // absolute path
  importPath: string; // 'cinder/button'
  props: Array<{
    name: string;
    control:
      | { kind: 'text' }
      | { kind: 'number' }
      | { kind: 'boolean' }
      | { kind: 'select'; options: string[] }
      | { kind: 'snippet' }
      | { kind: 'unknown'; rawType: string };
    defaultValue?: unknown;
    bindable: boolean;
    description?: string; // from JSDoc
  }>;
  a11y?: string; // markdown from <name>.a11y.md if present
};
```

## 4.4 Playground Integration

Each `/c/:name` page gains a "Controls" panel alongside the examples:

- Panel lists every prop from the manifest.
- User flips a control → URL query param updates (`?variant=primary&size=sm`) → new per-component bundle request to `/bundle/:name.js?variant=primary&size=sm` → server-side `Bun.build` uses a generated wrapper that reads `URLSearchParams` and passes them as props to the component.
- Deep-linkable: every control state has a URL. Copy link, open elsewhere, same state.

This is where the Codex "curated examples ≠ Storybook replacement" concern is answered: examples show realistic usage; controls expose the prop surface. Both together get you Storybook's core value.

## 4.5 Analyzer Hardening

The round-1 Codex concern about a "brittle authoring straitjacket" is addressed by giving each convention an explicit lint-rule test:

- `src/convention.test.ts`:
  - For each component, assert module script exports `${PascalName}Props`.
  - Assert `$props()` is destructured (not `let p = $props()`).
  - Assert every prop in the destructuring has either a default or a type annotation.
  - Assert any `Snippet` prop's type is `Snippet` or `Snippet<[...]>`.

Failures fail CI with a clear message saying _why_ the playground analyzer needs the convention. This turns undocumented AST conventions (Codex's original concern) into documented, enforced ones.

## 4.6 Files (Phase 4)

**Create**:

- `scripts/playground/analyze.ts` (svelte/compiler + ts-morph).
- `scripts/playground/analyze.test.ts` — feeds fixture `.svelte` files, asserts manifest output.
- `scripts/playground/controls.ts` — prop type → control kind mapping; unit-tested.
- `scripts/playground/wrapper-generator.ts` — generates the wrapper that reads URLSearchParams and renders the component (server-side build of `/bundle/:name.js`).

(`src/convention.test.ts` is introduced in Phase 2, not Phase 4 — Codex round 8 finding #5.)

**Modify**:

- `scripts/playground/server.ts` — add `/api/manifest` + `/api/manifest/:name`; update `/bundle/:name.js` to consume URLSearchParams into props.
- `scripts/playground/component-page.svelte` — add Controls panel UI (driven by the manifest API).
- `scripts/playground/discover.ts` — now returns `ComponentManifest[]` instead of bare paths.
- `package.json` — add `ts-morph` devDep.

## 4.7 Verification (Phase 4)

1. `bun test scripts/playground/analyze.test.ts` — fixture components produce expected manifests. Must cover: literal union, boolean, number, string, `Snippet`, `$bindable`, JSDoc description, unknown type fallback.
2. `bun test src/convention.test.ts` — every real component passes the conventions.
3. In the live playground: flipping a Button control updates the URL, and the new URL's page renders the button with the new prop.
4. Deep-link test: start from `/c/button?variant=danger&size=lg`, assert the controls panel reflects those values and the preview renders correspondingly.

## 4.8 Parallelization

**Wave 1 (parallel)**:

- `typescript-expert` — builds `scripts/playground/analyze.ts` (svelte/compiler AST walk + ts-morph type resolution + merge logic). Its test fixtures + `analyze.test.ts` are written by this same agent since understanding the analyzer and testing it are tightly coupled.
- `general-purpose` — builds `scripts/playground/controls.ts` (prop-type → control-kind mapping; pure functions, unit-testable in isolation).
- `general-purpose` — builds `scripts/playground/wrapper-generator.ts` (generates the per-component wrapper the server uses at `/bundle/:name.js`).

(`src/convention.test.ts` was created in Phase 2's Wave 1 and is already green for every component — no re-introduction needed.)

**Wave 2 (serial after Wave 1)**:

- `frontend-architect` — integrates the manifest API into `scripts/playground/server.ts` and rebuilds `component-page.svelte` with the Controls panel + URL round-tripping. Single agent because this touches multiple existing files and must match the analyzer's output shape exactly.

**Wave 3 (parallel)**:

- `testing-expert` — writes the deep-link round-trip test (boots playground, navigates to `/c/button?variant=danger`, asserts controls + preview reflect the query).
- `general-purpose` — updates README with the conventions required by the analyzer so external contributors know what the straitjacket is.

## 4.9 Phase 4 Exit Criteria

- Every component in the playground has auto-generated controls for every primitive-typed prop.
- Convention test passes for every component (no straitjacket violations).
- Deep-linked URLs round-trip.
- `/committee-review` passes. `codex-advisor` passes against the same hash. Branch fast-forwards into `main`. Phase's feature branch deleted; review sentinels under `./tmp/phase-review/` persist until the developer deletes them (untracked; no commit involved).

---

# Phase 5 — Evaluate Workspace Split + Browser Export

## 5.1 Goal

Two narrow decisions, both deferred to this phase on purpose:

1. **Workspace split**: convert the repo to `packages/components` + `packages/playground` workspaces, **only** if Phase 3+4 have made the playground big enough to justify the separation. Success criterion: playground has >500 lines of TS/Svelte **and** has imports from at least one third-party dev dep that has no reason to be in the published package's `devDependencies`. If both, split. If not, stay single-package.
2. **Browser export condition**: add `"browser": "./dist/client/index.js"` to the exports map, start producing `dist/client/` in `scripts/build.ts`, and add a third consumer fixture that exercises the compiled-client path in a non-Svelte-aware browser bundler (esbuild or rollup-only, no Vite/Svelte plugin). Only do this if we get actual consumer demand for a plain-browser build — otherwise it's premature.

Phase 5 is evaluated, not automatically executed. The user signs off on each of the two decisions separately.

## 5.2 Workspace Migration (if elected)

```
cinder/
├── package.json                 (workspaces: ["packages/*"])
├── packages/
│   ├── components/              (was src/, scripts/build.ts, fixtures/)
│   └── playground/              (was scripts/playground/)
```

Root `package.json` scripts become workspace-aware: `bun run --filter=components ...`, etc. Fixtures live under `packages/components/fixtures/`. `bun test` runs per-package tests via workspace filter.

## 5.3 Browser Fixture (if elected)

The fixture is written in **two variants** so the browser-export decision is genuinely independent of the workspace-split decision (round 8 finding #6). Pick the variant matching Phase 5's workspace outcome.

### Variant A — Single-package repo (workspace split **not** elected or not yet executed)

Path: `fixtures/browser-consumer/` (alongside the two existing fixtures).

- `fixtures/browser-consumer/package.json` — installs cinder from the same tarball as the other two fixtures. No workspace dependency.
- `fixtures/browser-consumer/esbuild.config.mjs` — bundles `src/main.ts` → `dist/bundle.js`. No Svelte plugin. Exercises the compiled-client path via `"browser"` export condition (which was restored in this phase).
- `fixtures/browser-consumer/src/main.ts` — imports `{ Button }` from `cinder`; mounts it into a DOM node.
- `fixtures/browser-consumer/test.ts` — runs esbuild; asserts output contains a known identifier from the compiled Button; optionally boots Playwright (fixture-local dep) and navigates to the built HTML to assert live render + click behavior.
- `scripts/validate-consumers.ts` gains a fifth orchestration step that installs this fixture and runs its test.

### Variant B — Split workspace (workspace split elected and executed first)

Path: `packages/components/fixtures/browser-consumer/`.

- Same internal structure as Variant A — the only difference is the path prefix and that `package.json` installs via `"cinder": "workspace:*"` instead of the tarball (Bun's workspace protocol resolves to the local package).
- `scripts/validate-consumers.ts` moves to `packages/components/scripts/validate-consumers.ts` as part of the workspace migration and gains the fifth step there.

### How to pick which variant

- If Track A (workspace split) and Track B (browser fixture) are **both** elected, Track A commits first (so paths are stable) and Track B is written in Variant B.
- If Track B is elected alone, use Variant A. No path changes anywhere else.
- If Track A is elected alone, no browser fixture is written; the `"browser"` export is not added.

Phase 5 is not a single diff — it's up to two separate committed tracks, each with its own review gate per the Orchestration Model.

## 5.4 Files (Phase 5, conditional on elections)

**Track A — Workspace split (if elected)**:

- Move `src/` → `packages/components/src/`.
- Move `scripts/build.ts`, `scripts/svelte-plugin.ts`, `scripts/preload.ts`, `scripts/generate-exports.ts`, `scripts/validate-consumers.ts` → `packages/components/scripts/`.
- Move `scripts/playground/**` → `packages/playground/src/`.
- Move `fixtures/sveltekit-consumer/`, `fixtures/node-consumer/` → `packages/components/fixtures/`.
- Root `package.json` gains `"workspaces": ["packages/*"]` and delegates scripts to workspace filters (`bun run --filter=components test`, etc.).
- Each new package gets its own `package.json` and `tsconfig.json` (existing ones move with their content).

**Track B — Browser fixture (if elected)**:

- Single-package variant (Variant A): `fixtures/browser-consumer/**`.
- Split-workspace variant (Variant B): `packages/components/fixtures/browser-consumer/**`.
- Either variant adds `"browser": "./dist/<components-path>/client/index.js"` and `"default": ...` to the package's `.` exports.
- Either variant restores the client build in `scripts/build.ts` (Phase 1 built it conceptually but Phase 1.2 elided the shipped artifact).

## 5.5 Verification (Phase 5)

1. If workspace elected: every Phase 1–4 verification passes unchanged under the new structure.
2. If browser fixture elected: the third fixture runs as part of `validate:consumer` (now a three-fixture matrix).
3. Tarball inspection's negative assertions are updated: `dist/client/` is now **expected** to be present.

## 5.6 Parallelization

Phase 5's two decisions are orthogonal; if both are elected, they run in parallel.

**Track A — Workspace split (if elected)**:

- `aws-platform-architect` or `general-purpose` — executes the git-mv operations + rewrites the root `package.json` + every package's `package.json` to workspace-aware shapes. Single agent; the move touches every file and races are unsafe.

**Track B — Browser fixture (if elected)**:

- `general-purpose` — scaffolds `packages/components/fixtures/browser-consumer/` (package.json, esbuild.config.mjs, src/main.ts, test.ts).
- `frontend-architect` — updates `scripts/build.ts` to re-emit `dist/client/` and updates the exports map. Coordinates with Track A if both elected (the file moves affect paths in build.ts).

After either or both tracks land:

- `general-purpose` — updates tarball-inspection's expectations (`dist/client/` now expected, not forbidden).
- `general-purpose` — writes the README decision log.

## 5.7 Phase 5 Exit Criteria

- Workspace split: elected or explicitly declined (with reasoning).
- Browser export: elected or explicitly declined.
- Either way, a one-paragraph decision log in the README.
- `/committee-review` passes. `codex-advisor` passes against the same hash. Branch fast-forwards into `main`. Phase's feature branch deleted; review sentinels under `./tmp/phase-review/` persist until the developer deletes them (untracked; no commit involved).

---

## Cross-Phase Dependencies

```
Phase 1 ──┬── Phase 2 (component port) ─────────┬── Phase 3b (example authoring) ──┐
          │                                     │                                  │
          └── Phase 3a (shell + server) ────────┴── Phase 4 (analysis + controls) ─┤
                                                                                   │
                                                                                   └── Phase 5 (conditional: workspace + browser)
```

Exact dependencies:

- **Phase 1** gates everything downstream.
- **Phase 2** (component port) and **Phase 3a** (playground shell + server, built against Phase 1's Button only) can run in parallel after Phase 1 commits.
- **Phase 3b** (example authoring) requires both Phase 2 _and_ Phase 3a committed. It depends on Phase 2 because examples are pointless without a component set, and on Phase 3a because the example-rendering pipeline has to exist to receive them.
- **Phase 4** (static analysis + controls) requires Phase 2 committed (components must exist and already follow the analyzer's conventions — see Phase 2's 2.3.10) and Phase 3a committed (the playground UI it augments). Phase 3b is **not** a hard prerequisite for Phase 4; the two can run in parallel because Phase 4 operates on `src/components/` (analyzer input) and its UI changes apply regardless of how many example cards are rendered.
- **Phase 5** is evaluated only after Phases 1–4 are all committed. Its two decisions (workspace split, browser export) are orthogonal and independent.

Codex's round-8 finding on this DAG is addressed: examples no longer reside under `src/components/`, Phase 3 is split, and Phase 4's dependency on Phase 2 is explicit.

## Risks (cross-phase)

- **`svelte2tsx` breaks on a Svelte update** — Phase 1 risk; mitigated by pinning peer range to one minor. If it bites in Phase 2+, rollback is disabling the `"svelte"` condition and shipping source only via a new `"source"` custom condition.
- **Plugin SSR output drifts between Svelte versions** — Phase 1 fixture catches it; Phase 5 browser fixture extends coverage to compiled-client.
- **Component styles collide with consumer CSS** — `.cinder-*` namespace + `:where()` reset gives a strong baseline; Phase 5 browser fixture with Playwright is the final cascade test.
- **Playground reload-on-save is too slow as components grow** — measured in Phase 3 (~500ms target). If it degrades, Phase 4's bundling already caches per-component builds; that cache extends to the reload path.
- **Convention test flags existing components** during Phase 2 → Phase 4 transition — expected. Phase 4 requires Phase 2 to be done first so the test is enforceable.
- **Workspace split in Phase 5 is more churn than value** — exit criterion includes "explicitly decline" as a valid outcome.

## Phase 6 — Domain-Suite Port

The full execution plan is at `docs/phase-6-plan.md`. This section is the ROADMAP-side index pointing at it.

**Goal**: port `chat`, `diff-viewer`, `review-editor`, and `markdown-editor` from `@depict/components` into cinder under the new **domain-suite** tier (see `COMPONENT-COVERAGE-PLAN.md`), along with four new workspace packages (`@cinder/diff`, `@cinder/markdown`, `@cinder/commentary`, `@cinder/editor`) supporting them.

**Prerequisite**: all Phase-5 work committed. Phase 6 depends on no Phase-5 deliverables directly, but the domain-suite tier admission needs `convention.test.ts` exemptions to land cleanly, and overlay/field-control/collection contracts need to be settled.

**Sub-phase decomposition**:

- **D-1 — Inventory freeze + decision lock-down** (no tracked repo state changed; writes to gitignored `tmp/port-inventory/` only). Five artifacts: dependency-graph, css-token-map, browser-only-imports, version-matrix, compatibility-matrix. Plus test-classification. Resolves `@cinder/diff` shape (standalone, decided), API parity target (depict-compatible), and surfaces plan corrections.
- **D0 — Admission doc + roadmap update** (doc-only, no executable changes). Updates `COMPONENT-COVERAGE-PLAN.md` with the domain-suite tier and scoped allowlist. Adds this section to ROADMAP. **No `package.json`, no workspaces, no lint-staged, no validate scripts changed in D0** — those move to D1d, gated on `@cinder/markdown` building cleanly.
- **D1 — Foundational packages**: `@cinder/markdown` + `@cinder/diff`. Two parallel leaf workers in worktrees. D1d (workspace widening) runs only after D1a–c (build/typecheck/smoke harness) pass. Rollback-safe.
- **D2 — `@cinder/editor`**: single worker, depends on `@cinder/markdown`. SSR rewrites per `browser-only-imports.md`.
- **D3 — `@cinder/commentary` + four leaf cinder components + cinder primitive extensions**: `@cinder/commentary` serial-on-D2; in parallel: `segmented-control`, `diff-statistics`, `view-switcher`, `selection-popover`, plus additive primitive extensions (Button `ghost-danger`, Badge `accent`/`xs`, Kbd `label`/`size`, Card `description` verify, Dropdown compound family — `DropdownTrigger`, `DropdownMenu`, `DropdownItem`, `DropdownLabel`, `DropdownSeparator`).
- **D4 — `cinder/chat` + `cinder/diff-viewer` + `cinder/surface` + `cinder/markdown-editor`**: three parallel worktrees. `markdown-editor` moved here from D5 because chat depends on it.
- **D5 — `cinder/review-editor`**: single primary worker. Most deps already landed in D1–D4.

**Per-phase review gate**: same as Phases 1–5 (committee-review + codex-advisor against the exact target hash; sentinels in `tmp/phase-review/`; fast-forward-only merge).

**Verification (gate D5)**:

- `bun run validate` green at root.
- `/c/chat`, `/c/diff-viewer`, `/c/markdown-editor`, `/c/review-editor`, `/c/surface`, plus the four D3 sibling routes and the Dropdown compound demos — all render in playground without console errors.
- Tree-shake fixture: `import { Button } from 'cinder/button'` produces a bundle that does not contain `shiki`, `unified`, `@milkdown/kit`, `diff-match-patch`, `prosemirror`, or any `--depict-*`/`--cinder-chat-*`/`--cinder-markdown-editor-*` CSS custom properties.
- SSR fixture (adapter-node): all nine new components on one page renders without throwing at module-eval time.
- Per-component interaction acceptance tests pass (keyboard, focus, ARIA, streaming, scroll-pin, anchor persistence — full list in the plan file's gate sections).
- Long-document regression test (>5000 lines) renders review-editor in playground in <2s.

**Rollback strategy**: per-phase rollback table in the plan file. Rollback is local to the phase that failed; no phase reverts an earlier phase. If D5 fails, D4 stays shipped.

---

## Out of Scope (all phases)

- Publishing workflow (`.github/workflows`) — separate concern.
- Visual regression testing — separate concern.
- Theme switching UI — tokens use `light-dark()` so it's inherited; a switcher is a Phase 6+ feature.
- Internationalization — separate concern.
- Component-level SSR/hydration debugging tools — if something hydrates wrong, Phase 1's adapter-node fixture catches it at the integration level; deeper debugging is out of scope.
- Node version matrix testing — Phase 1 fixture uses whatever `node` is on PATH; CI is expected to pin it.

## Environment Requirements

- Bun >= 1.3.0 (already pinned in `package.json#engines`).
- Node on PATH for `validate:consumer` (introduced in Phase 1). Documented in README.
- Git on PATH for `validate:workflow` (introduced in Phase 1). Already ambient.
- No other system dependencies.
