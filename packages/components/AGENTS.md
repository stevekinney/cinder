# AGENTS.md

Guidance for AI coding agents working with `cinder`. Two audiences, two
sections:

- **Using cinder in your app** — start here if you are building a product on
  top of `cinder` (you ran `bun add cinder` and want to ship the right
  component for the job).
- **Contributing to cinder** — start here if you are editing this package.

---

## Using cinder in your app

`cinder` is a Svelte 5 component library — roughly 100 accessible primitives
plus a few opinionated domain suites. It targets Svelte `>=5.55 <5.56` and is
SSR-safe out of the box. Everything ships with a JSON Schema, CSS variable
list, and (where it matters) a constraints sidecar and runnable examples.

### Quickstart

```bash
bun add cinder svelte
```

Two import shapes, pick one per file:

```ts
// Root barrel — convenient, larger import graph, fine for Node SSR.
import { Button, Modal } from 'cinder';
```

```ts
// Subpath — tree-shake friendly, ideal under Vite / SvelteKit.
import Button from 'cinder/button';
import Modal from 'cinder/modal';
```

Then load the **base** stylesheet **once**, **first**, at your app entry:

```ts
import 'cinder/styles';
```

`cinder/styles` is the slim base: it declares the `@layer` order
(`cinder.tokens, cinder.foundation, cinder.components, cinder.utilities`),
ships the design tokens, base resets, utilities, and shared internal chrome.
It does **not** ship per-component CSS. Import each component's styles
alongside the component:

```ts
import Button from 'cinder/button';
import 'cinder/button/styles';

import Modal from 'cinder/modal';
import 'cinder/modal/styles';
```

Bundlers (Vite, SvelteKit, esbuild, Bun) then include only the component CSS
you actually reference — a button-only app ships zero badge or tabs rules.

> [!WARNING] Import order matters
> `cinder/styles` MUST be imported before any `cinder/<component>/styles`. The
> base declares the `@layer` order; if a component's CSS lands first, the
> cascade layers are created in insertion order and utilities can no longer
> override component defaults. (A guard for this ships in a companion task.)

**Compound components** (Tabs, Table, Accordion, SideNavigation) ship their
whole family from the parent subpath — `import 'cinder/tabs/styles'` pulls in
Tab, TabList, and TabPanel CSS too, so you do not import each leaf separately.

**All-in escape hatch.** If you do not want to manage per-component imports,
`import 'cinder/styles/all'` ships the base plus every component's CSS in one
shot (no tree-shaking). The `cinder/styles/all` bundle also carries the
experimental-component styles and the JSON-highlight token set used by
`highlightJson()`; the slim base does not. There are also layer-only
sub-entries — `cinder/styles/tokens`, `cinder/styles/foundation`, and
`cinder/styles/utilities` — for advanced à-la-carte setups.

### Provider setup (highlighter context)

> [!WARNING]
> CinderProvider is planned for removal: CodeBlock is moving to auto-load Shiki on
> its own, so don't scaffold a provider expecting it to be permanent. Today it is
> still required for highlighting; only add it if you need a custom highlighter or
> scoped highlighting for a subtree.

`<CodeBlock>` resolves its syntax highlighter through Svelte context. Mount
**one** `<CinderProvider>` near your app root and every descendant
`<CodeBlock>` shares the highlighter. The recommended default is the
bundled `cinder/highlighters/shiki` adapter:

```svelte
<script lang="ts">
  import { CinderProvider } from 'cinder';
  import { shikiHighlighter } from 'cinder/highlighters/shiki';

  const highlighter = shikiHighlighter();
</script>

<CinderProvider {highlighter}>
  <!-- the rest of your app -->
</CinderProvider>
```

`shikiHighlighter()` accepts a `theme` (single string or
`{ light, dark }` for CSS-variable-driven dual-theme mode) and an
optional `langs` array to preload specific grammars. [Shiki](https://shiki.style/)
itself is
lazy-imported on the first highlight call, so consumers that never
mount this adapter ship zero Shiki bytes in their entry chunk.

> [!WARNING]
> Pass `theme` as `{ light, dark }` (the default) when highlighted code
> should re-theme with cinder's light/dark switch. A single-string `theme`
> bakes one palette into Shiki's inline `color:` styles, which CSS cannot
> override per theme. That means the choice has to happen at highlight time in
> `shikiHighlighter`, not later in cinder's stylesheet.

`<CodeBlock>` rendered without an ancestor provider (or with a provider
that supplies no `highlighter`) falls back to escaped plaintext — the
"no syntax highlighting" state is a first-class supported render. The
adapter follows the same fallback contract: empty/missing/unknown
languages render as escaped plaintext rather than throwing.

`<CinderProvider>` is app setup context, not a visual component. Treat it
like a root-level capability boundary for syntax highlighting rather than
something you render in a component gallery or playground sidebar.

The provider is reactive: assigning a new `highlighter` re-renders every
descendant `<CodeBlock>`. Nest a second `<CinderProvider>` to scope a
different highlighter to a subtree (the nearest provider wins). For a
custom highlighter, implement the `Highlighter` type from `cinder` and
pass it to `<CinderProvider highlighter={...}>` — the function receives
`(code, lang)` and must return safe HTML (Shiki's `codeToHtml` escapes
input by default; if you build your own, escape the code yourself).

### Discovery recipe (the agent contract)

This is the part that matters. Every component ships machine-readable
metadata. You do not need to read 100 READMEs.

**1. Read the manifest.**

```ts
import manifest from 'cinder/manifest' with { type: 'json' };
```

`manifest.components[]` enumerates every public component. Narrow by:

- `category` — one of `action`, `overlay`, `form`, `feedback`, `navigation`,
  `data-display`, `layout`, `typography`, `domain`.
- `tags` — free-text keywords (`cta`, `disclosure`, `selection`, etc.).
- `overlapFamilies` — explicit groupings of components that solve overlapping
  problems (Modal vs Drawer vs Sheet vs Popover). When two candidates appear
  in the same family, read each one's `useWhen` / `avoidWhen` to pick.

Each entry carries `purpose`, `useWhen[]`, `avoidWhen[]`, `related[]`,
`hasConstraints`, `hasExamples`, and pointers under `artifacts` to the
subpaths you fetch next.

**2. Fetch the prop signature.**

```ts
type ButtonSchema = typeof import('cinder/button/schema').default;
```

`cinder/<name>/schema` and `cinder/<name>/variables` are **type-only metadata
modules**. They ship `types` + `svelte` conditions only — no `node`/`default`
runtime condition, because the build emits no `.schema.js`/`.variables.js`. The
default export is a **value** (`declare const _default: ComponentSchema`), so
reach its type with `typeof`. Take it through `import(...)` as shown above, or
off the namespace binding of an `import type * as`:

```ts
import type * as ButtonSchemaModule from 'cinder/button/schema';
type ButtonSchema = typeof ButtonSchemaModule.default;
```

> [!WARNING]
> Do **not** use a default-only `import type ButtonSchemaModule from '…'`. That
> binds `ButtonSchemaModule` to the **type of the default export** (`ComponentSchema`
> directly), not the module namespace — so `typeof ButtonSchemaModule.default` fails
> with `TS2339: Property 'default' does not exist on type 'ComponentSchema'`. Use
> `import type * as` (namespace import) to bind the module namespace, where `.default`
> correctly refers to the default-exported value.

The resulting type describes a JSON Schema draft 2020-12 document: required
props, prop types, enum values, and defaults are all there.

> [!WARNING]
> Do not `import` these for their runtime value from a plain Node or Vite
> (non-Svelte) consumer. Because there is no `default` condition, the runtime
> resolver throws `ERR_PACKAGE_PATH_NOT_EXPORTED`. That is intentional — these
> subpaths are metadata, not runtime entry points.

If you genuinely need the schema as a runtime **value** (e.g. to feed a form
generator or validator), read the JSON sidecar that ships alongside the module.
Anchor the path off the package root — resolve `cinder/package.json` (which _is_
an export) and join to the sidecar so you never hardcode a `node_modules` layout:

```ts
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = dirname(fileURLToPath(import.meta.resolve('cinder/package.json')));
const sidecar = join(packageRoot, 'src/components/button/button.schema.json');
const buttonSchema = JSON.parse(await readFile(sidecar, 'utf-8'));
```

The authoritative, machine-readable index for every component is `cinder/manifest`
(step 1) — prefer it over hand-resolving sidecar paths whenever you can.

**3. Fetch the cross-prop constraints — when `hasConstraints` is true.**

```ts
import buttonConstraints from 'cinder/button/constraints' with { type: 'json' };
```

`cinder/<name>/constraints` is a JSON file. Use the `with { type: 'json' }`
import attribute on a modern runtime. For Node consumers without import-
attribute support, read the file off disk:

```ts
import { readFile } from 'node:fs/promises';
const url = new URL(import.meta.resolve('cinder/button/constraints'));
const buttonConstraints = JSON.parse(await readFile(url, 'utf-8'));
```

JSON Schema cannot cleanly express rules like _"exactly one of `label`,
`children`, or `iconOnly`"_ or _"`iconOnly` requires an accessible name
source"_ — those rules live in the constraints sidecar as a small DSL.

**4. Fetch canonical examples — when `hasExamples` is true.**

```ts
import buttonExamples from 'cinder/button/examples' with { type: 'json' };
```

Like `/constraints`, the `/examples` subpath ships as JSON.

Each example has a `title`, `description`, and a `code` string you can show
the user or copy into their codebase verbatim.

**5. Compose.** Use the kebab-case `id` from the manifest (`button-group`,
`copy-button`) when you cross-reference components in your own code — that
matches the convention `cinder` uses internally and in `related[]`.

### Conventions

- **Class prefix:** every component's root element carries
  `.cinder-<component>` (`.cinder-button`, `.cinder-modal`). Override styles
  by targeting that class.
- **CSS custom properties:** all public design tokens use the `--cinder-`
  prefix (`--cinder-color-text`, `--cinder-space-md`). The token namespaces
  are `color`, `space`, `radius`, `ring`, `type`, `motion`, and `shadow`.
- **Private custom properties — DO NOT REDEFINE.** Any variable matching
  `--_cinder-*` (underscore after the dash) is an internal implementation
  detail. Redefining one will break the component at the next patch release.
  If you need to customize something and there is no public token, file an
  issue rather than reaching into the underscore namespace.
- **Variants via `data-*` attributes.** State and variant selectors use
  `data-cinder-*` (`data-cinder-variant="primary"`,
  `data-cinder-state="open"`). Stable, scriptable, and survive class-name
  collisions.
- **SSR-safe.** Every component renders cleanly on the server. The Node
  build (`cinder` root, no subpath) is the SSR entry point.
- **Svelte 5 runes.** Components use `$state`, `$derived`, `$props`. Pass
  bindings with `bind:value` where the schema marks a prop bindable.
- **Theming via `light-dark()`.** There is no `<ThemeProvider>`. Tokens are
  defined with the CSS `light-dark()` function and switch based on
  `color-scheme`. Set `color-scheme: dark` on `<html>` (or any ancestor) to
  flip the palette.

### Decision aid

The tables below are auto-generated from the manifest. Each row lists the
`id` you import (`cinder/<id>`), the component's `purpose`, and its first
`useWhen` clause as a tiebreaker. When you need a fuller comparison, read
the matching entry in `cinder/manifest`.

<!-- generated:overlap-families:start -->

### hover (3 components)

| id           | purpose                                                                                                     | use when                                                                                                   |
| ------------ | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `tooltip`    | Hover-and-focus triggered descriptive hint anchored to a focusable child element, wired through…            | Showing a short non-interactive label or description for an icon-only button or terse control.             |
| `popover`    | Anchored floating panel positioned by Floating UI that hosts non-modal contextual content beside a trigger… | Showing rich, interactive contextual content anchored to a trigger such as a help panel, color picker, or… |
| `hover-card` | Hover-and-focus triggered rich preview card for non-interactive contextual content.                         | Showing a profile, issue, or metadata preview that is richer than a tooltip but still read-only.           |

### notice (3 components)

| id        | purpose                                                                                                       | use when                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `banner`  | Page-level dismissible region landmark that surfaces a persistent informational, success, warning, or danger… | Communicating a persistent page-level status the user can dismiss, such as a maintenance window or trial… |
| `alert`   | Inline status message with assertive role for surfacing time-sensitive feedback about a nearby action or…     | Surfacing the result of a just-completed action such as a save failure or success.                        |
| `callout` | Inline aside that highlights supporting commentary alongside body content without claiming live-region…       | Drawing attention to tangential information nested inside prose, documentation, or article content.       |

### overlay (5 components)

| id             | purpose                                                                                                        | use when                                                                                                      |
| -------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `modal`        | Centered modal dialog built on the native dialog element with focus capture, restoration, and dismissal…       | Interrupting the user for a focused task or decision that blocks the rest of the page.                        |
| `drawer`       | Side-anchored modal panel built on the native dialog element for secondary navigation, settings, or long-form… | Showing supplementary navigation, filters, or settings that should slide in from a page edge.                 |
| `sheet`        | Bottom-anchored modal panel built on the native dialog element with an optional drag handle for mobile-first…  | Presenting a focused task or set of actions that slides up from the bottom of the viewport on touch surfaces. |
| `popover`      | Anchored floating panel positioned by Floating UI that hosts non-modal contextual content beside a trigger…    | Showing rich, interactive contextual content anchored to a trigger such as a help panel, color picker, or…    |
| `alert-dialog` | Sticky alert dialog for urgent acknowledgement that cannot be dismissed by backdrop click or Escape.           | Requiring acknowledgement of a blocking warning before the user can continue.                                 |

### selection (3 components)

| id                  | purpose                                                                                                      | use when                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `toggle`            | Sliding switch implementing the WAI-ARIA switch pattern for a single on or off setting that applies…         | Flipping a single setting on or off with immediate effect such as notifications or dark mode. |
| `checkbox`          | Binary or tri-state selection control with bindable checked and indeterminate state for forms and lists.     | Selecting zero or more independent options from a list.                                       |
| `segmented-control` | Compact radio-style selector that surfaces a small fixed set of options as a single connected bar and binds… | Choosing one of two to five mutually exclusive options that all fit on screen at once.        |

### tabs (2 components)

| id                  | purpose                                                                                                      | use when                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `tabs`              | Root tabs composite that owns the active value and orientation and coordinates tab, tab-list, and tab-panel… | Switching between several panels of related content under one heading area.            |
| `segmented-control` | Compact radio-style selector that surfaces a small fixed set of options as a single connected bar and binds… | Choosing one of two to five mutually exclusive options that all fit on screen at once. |

<!-- generated:overlap-families:end -->

### Things cinder will NOT do for you

This is a presentation library, not a framework. The following are out of
scope and you should wire them up yourself:

- **No router.** Use SvelteKit's router (or your framework's). Components
  like `NavigationItem`, `Breadcrumbs`, and `Tabs` accept `href` props but
  do not own navigation.
- **No toast queue store.** `ToastRegion` is the render surface and the live
  region. You build (or import) the queue that pushes toasts at it.
- **No form-state manager.** Components are uncontrolled-friendly and play
  nicely with `bind:value`. Pair them with a form library of your choice
  (Felte, Superforms, plain `<form>`) for validation, submission, and field
  state.
- **No icon library.** Bring your own icons. Components that accept icons
  take them as snippets or slots — pass an `<svg>`, a Lucide component,
  whatever you ship.
- **No data fetching.** Components render the data you hand them.
- **No global state.** There is no `cinder` store or initialization step
  beyond the styles import. The one optional context provider is
  `<CinderProvider>` — it scopes a syntax highlighter to its subtree for
  `<CodeBlock>` to read; see "Provider setup" above. Mount it only if you
  want syntax highlighting; the unhighlighted code-block render is the
  no-provider state.

---

## Contributing to cinder

You are editing inside `packages/components`. Read this section before
adding a component, changing a generator, or extending the manifest.

### The five analyzer conventions

Every component in `src/components/<id>/` is parsed by the metadata,
schema, variables, and examples generators. They enforce:

1. **One component per directory.** `<id>/` contains `<id>.svelte`,
   `<id>.types.ts`, an `index.ts` re-export, and generated `.schema.json` /
   `.variables.json` / `README.md`.
2. **Props type named `<Pascal>Props`** in `<id>.types.ts`. The schema
   generator walks this exact symbol.
3. **`<script lang="ts" module>` block** at the top of `<id>.svelte`
   containing the `@cinder` JSDoc header. The metadata extractor reads the
   first `@cinder` block and ignores anything before it.
4. **Kebab-case ids everywhere.** Directory name, manifest `id`,
   constraints sidecar `component`, examples sidecar `component`, JSDoc
   `@related` entries. PascalCase only appears in `exportName` and prose.
5. **No relative imports across components.** Examples and components
   import siblings via `cinder/<id>` so the same string works in the
   playground and the published tarball.

The full convention reference lives in
`packages/components/src/components/<id>/README.md` for any component you
take as a model (Button is a good one — it exercises constraints,
examples, and the discriminated-union props pattern).

### Where the data lives

- **Closed vocabularies** — `packages/components/src/manifest.meta.ts`.
  This is the authority for `categories`, `statusLevels`,
  `overlapFamilies`, `requiredConstraints`, and
  `allowedExampleExclusionReasons`. The manifest test fails fast if a
  component references an id not in this file.
- **Per-component free text** — the JSDoc header on the component's module
  block. `@purpose`, `@tag`, `@useWhen`, `@avoidWhen`, `@related`,
  `@category`, `@status`.

Convention shown for Button:

```svelte
<script lang="ts" module>
  /**
   * @cinder
   * @category action
   * @status stable
   * @purpose Primary interactive control for triggering actions or navigating via href.
   * @tag action
   * @tag cta
   * @useWhen Triggering an action (submit, save, delete).
   * @useWhen Anchor that should look like a button (pass href).
   * @avoidWhen Toggling on/off state — use Toggle.
   * @avoidWhen Selecting from a fixed set — use SegmentedControl.
   * @related button-group, copy-button
   */
</script>
```

### Adding a new component

1. Create `src/components/<id>/` with `<id>.svelte`, `<id>.types.ts`
   (exporting `<Pascal>Props`), and `index.ts` that re-exports the
   component plus the props type.
2. Author the `@cinder` JSDoc header on the module block. Reference only
   ids/categories that exist in `manifest.meta.ts`.
3. If the component belongs in `requiredConstraints`, author
   `<id>.constraints.ts` with `defineConstraints(...)` and matching
   `.fixtures.ts` covering valid and invalid prop combinations.
4. Add at least one `.example.svelte` to the playground for the component.
5. Run `bun run components:generate` to produce schemas, variables, the
   manifest entry, and per-component READMEs. Re-run `bun run
components:check` to confirm the drift checker is happy.

If the component ships a `<id>.css` sidecar, its rules must self-declare their
cascade layer: wrap the whole file in `@layer cinder.components { … }`. The
layer membership has to be intrinsic to the file so it survives a direct
subpath import (`cinder/<id>/styles`) rather than relying on the aggregator's
`@import … layer(cinder.components)`. Applications that layer their own
overrides should declare their layer order (e.g. `@layer cinder.components,
app;`) before importing cinder styles — the sidecar carries layer _membership_,
not ordering, so ordering stays the consumer's responsibility.
`scripts/check-component-css.ts` enforces the wrapper at build time.

Once the sidecar exists, `bun run exports:generate` automatically emits a
`cinder/<id>/styles` subpath pointing at the built `dist/components/<id>/<id>.css`
— no hand-editing of `package.json` exports. The slim base
(`src/styles/index.css` → `cinder/styles`) does **not** import per-component
CSS; the all-in aggregator (`src/styles/all.css` → `cinder/styles/all`) imports
`components.css`, which lists every component sidecar in alphabetical order. If
you add a brand-new component with a sidecar, add its `@import` line to
`src/styles/components.css` (the all-in aggregator is hand-maintained, not
regenerated) so `cinder/styles/all` picks it up.

> [!WARNING] This reversed the earlier bare-rules contract
> Component sidecars used to hold bare rules with NO `@layer` wrapper — the
> aggregator applied `layer(cinder.components)` on import, and the build gate
> _rejected_ any `@layer` inside a sidecar. That is now inverted. A branch that
> adds or edits a `.css` sidecar without the wrapper will fail the build with a
> "must live inside a single top-level `@layer cinder.components { … }` wrapper"
> error. To migrate, wrap the file's entire content in
> `@layer cinder.components { … }`.

### Compound components

A compound component is a parent that owns context and a small fixed set of
compose-only leaves (Tabs/TabList/Tab/TabPanel, Table/TableBody/TableRow/…,
Dropdown/DropdownTrigger/DropdownMenu/…). For these families:

- **Keep leaves physically separate.** Each leaf lives in its own component
  directory under `src/components/<leaf>/` with its own `.svelte`,
  `.types.ts`, schema, variables, tests, and README. Do not merge leaves
  into the parent directory.
- **Parent `index.ts` owns namespace composition.** The parent barrel imports
  each leaf's `.svelte` source (never its `index.ts`) and exposes them as
  properties using `Object.assign(ParentRoot, { LeafName: Leaf })` cast to
  the intersection type. See `tabs/index.ts` for the canonical pattern.
- **Leaf barrels must stay independent.** A leaf `index.ts` must not import
  the parent barrel, the root barrel, or any namespace helper — that would
  defeat tree-shaking for consumers importing only `cinder/<leaf>`. The
  `compound-leaf-import-boundary.test.ts` enforces this.
- **Parent CSS aggregates the family.** When leaves ship their own CSS, the
  parent `<parent>.css` sidecar `@import`s each leaf's sidecar with a
  sibling-leaf path (`@import '../<leaf>/<leaf>.css';`) placed **before** the
  `@layer cinder.components { … }` wrapper. That path resolves identically in
  `src/` and the verbatim-copied `dist/` because the layout mirrors, so a
  consumer importing only `cinder/<parent>/styles` gets the whole family. Each
  leaf still gets its own `cinder/<leaf>/styles` subpath; bundlers dedupe the
  shared file by URL. `scripts/check-component-css.ts` permits exactly this
  sibling-leaf `@import` shape and rejects every other import. (Most table/tab
  leaves are styled entirely by the parent and ship empty registry sidecars —
  the `@import` is still correct and future-proof.)
- **Add flat exports for new leaves too.** Continue adding the flat
  `cinder/<leaf>` subpath and the leaf's entry in `src/index.ts`. The
  namespace API is additive, not a replacement — keep flat leaf exports
  for the compatibility window.
- **Playground examples belong on the parent page.** Put compound usage
  under `examples/<parent>/`, never under `examples/<leaf>/`. Leaves
  documented under their parent should also be listed in
  `packages/playground/src/discover.ts`'s `COMPOSE_ONLY_COMPONENTS` set so
  the sidebar shows one entry per family.
- **README usage snippets show the namespace form.** Parent READMEs
  demonstrate `Parent.Leaf` composition and list every namespaced leaf in
  their `Subcomponents` region. Leaf READMEs point back at the parent for
  composed usage instead of duplicating a standalone snippet.

### Generators

All of these are idempotent — run the generator, commit the result, the
`*:check` flavor compares against disk and exits non-zero on drift.

```bash
bun run components:generate   # orchestrates every per-component generator
bun run components:check      # drift check (CI calls this)
bun run manifest:generate     # components.json only
bun run examples:generate     # *.examples.json
bun run constraints:generate  # *.constraints.json
bun run exports:generate      # package.json#exports
bun run agents:generate       # this AGENTS.md overlap-family block
bun run agents:check          # drift-check this file
```

For repo-wide git/commit/PR conventions (commit message format, branch
naming, review expectations), see the root [`CONTRIBUTING.md`][1].

[1]: ../../CONTRIBUTING.md

### Constraints DSL

`packages/components/src/_internal/constraints.ts` exports `defineConstraints`
and a runtime `evaluateConstraints(rules, attributes)` that the test suite
uses. Four combinators (`exactlyOne`, `anyOf`, `allOf`, `requires`) and four
predicates (`{prop, equals}`, `{prop, exists}`, `{prop, nonEmpty}`,
`{snippet}`). Author one `<id>.constraints.ts` per component and a sibling
`<id>.constraints.fixtures.ts` that exercises every rule. Look at
`button.constraints.ts` for the canonical shape — it covers the
`visual-content-source` (exactly one of `label`/`children`/`iconOnly`) and
`accessible-name` (icon-only buttons need a name source) rules.

To require a brand-new component to ship a sidecar, add its kebab-case id
to `requiredConstraints` in `manifest.meta.ts`. `components:check` will
then fail until the sidecar exists.

### Examples contract

Examples ship as JSON, generated verbatim from
`.example.svelte` files in the playground. Every example must:

- Carry a `<script lang="ts" module>` block exporting string literal
  `title` and `description`, plus an optional `component` (kebab-case id).
- Import **only** from `cinder`, `cinder/<subpath>`, or a package listed in
  `scripts/example-allowed-packages.ts`. Relative imports, `$lib`,
  playground-only modules, and fixtures are hard errors.
- Contain no `<style>` block — styles come from `cinder/styles`.

To exclude an example that cannot ship (router-dependent, server-data,
iframe-isolated, etc.), add a top-of-file marker:

```svelte
// @cinder-example-exclude: requires-router
```

The reason must come from `allowedExampleExclusionReasons` in
`manifest.meta.ts`. To add a new reason, edit that array and document
why in your PR. The exclusion budget is capped at 10% of all playground
examples; above that, `components:check` fails.

## Stable-promotion gate

Before flipping a component's `@status` from `alpha` or `beta` to `stable`,
run the promotion gate:

```bash
bun run components:promotion-check <component-name>
# or with machine-readable output:
bun run components:promotion-check <component-name> --json
```

Exits 0 on PASS, 1 on FAIL. The `--json` flag writes a single JSON object to
stdout and routes all human-readable diagnostics to stderr.

### What the gate checks

**Check 1 — Substantive test present.** The component must have a
`<name>.test.ts` file containing at least one active `test(...)` or `it(...)`
call (`.skip`, `.todo`, `.failing` suffixes excluded). A types-only snapshot
file does not satisfy this.

**Check 2 — Accessibility coverage (interactive components only).** A component
is considered interactive when its `@category` metadata is one of `action`,
`form`, `navigation`, or `overlay`. The check passes when EITHER:

- An a11y doc exists at `<name>.a11y.md` adjacent to the component, OR at the
  legacy flat path `src/components/<name>.a11y.md`, OR
- A single `test(...)` block in `<name>.test.ts` contains BOTH a keyboard call
  (`fireEvent.keyDown` or `user.keyboard`) AND an ARIA/role query
  (`getByRole`/`findByRole`/`queryByRole`, or `expect(...).toHaveAttribute`
  where the attribute name is `"role"` or starts with `"aria-"`).

Setup-only mentions outside a test block do not count. Non-interactive
components are N/A.

**Check 3 — Hydration/SSR coverage (only if a browser guard exists).** The
gate detects a browser guard structurally: a `{#if browser}` or
`{#if hydrated}` template block (via `svelte/compiler` AST), or an import of
`BROWSER` from `esm-env`. When a guard is found, the test file must contain a
`render` call imported from `svelte/server` OR a `renderThenHydrate` call. A
test merely _named_ "hydrates" does not satisfy this. No guard detected → N/A.

**Check 4 — Prop-name conventions.** The committed `<name>.schema.json` must
be up-to-date (no drift vs. what `components:generate` would produce), and all
prop names must satisfy:

- camelCase (starts with a lowercase letter, letters and digits only)
- `class` is always allowed as a passthrough
- `aria-*` and `data-*` attribute names are allowed
- The prop name must NOT appear in the **frozen denylist** below

`is`-prefix and `has`-prefix boolean props (e.g. `isLoading`) emit a **warning**
but do not cause failure.

### Frozen prop-name denylist

These exact strings are forbidden as prop names. Most are the all-lowercased,
wrong-cased forms of legitimate camelCase props. `className` is special: it is
valid camelCase but still forbidden, because cinder components expose
`class?: string` as the public prop and destructure it internally as
`class: className` — the public API is always `class`, never `className`.

| Forbidden name | Correct form   |
| -------------- | -------------- |
| `classname`    | `class`        |
| `className`    | `class`        |
| `icononly`     | `iconOnly`     |
| `leadingicon`  | `leadingIcon`  |
| `trailingicon` | `trailingIcon` |
| `ondismiss`    | `onDismiss`    |
| `onchange`     | `onChange`     |

To add to this list: update `PROP_NAME_DENYLIST` in
`scripts/component-conventions.ts` and document the entry here in the same PR.

### Schema-exempt components

Components listed in `SCHEMA_EXEMPT` inside `scripts/check-promotion-readiness.ts`
are skipped for the schema-drift and prop-name checks. Add a component to this
set only when it has no `.types.ts` by design and document the reason.

### Promotion workflow

1. Run `bun run components:promotion-check <name>`.
2. If PASS: flip `@status` to `stable` in the component's `.svelte` module
   script, then run `bun run components:generate`.
3. If FAIL: address each gap listed in the report. Do NOT promote with known
   gaps — document them instead and leave the status unchanged.

The gate is opt-in and is not wired into CI. It is a human/agent pre-promotion
step, not an automated blocker.
