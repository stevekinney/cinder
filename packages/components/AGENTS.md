# AGENTS.md

Guidance for AI coding agents working with `@lostgradient/cinder`. Two audiences, two
sections:

- **Using cinder in your app** — start here if you are building a product on
  top of `@lostgradient/cinder` (you ran `bun add @lostgradient/cinder` and want to ship the right
  component for the job).
- **Contributing to cinder** — start here if you are editing this package.

---

## Using cinder in your app

`@lostgradient/cinder` is a Svelte 5 component library with more than 160 public
component entries across accessible primitives and opinionated domain suites.
It targets Svelte `>=5.56.0 <6` and is SSR-safe out of the box. Everything ships
with a JSON Schema, CSS variable list, and (where it matters) a constraints
sidecar and runnable examples.

### Quickstart

```bash
bun add @lostgradient/cinder svelte
```

`svelte` is a peer dependency. Cinder uses Lucide (`lucide-svelte`) for its own
component chrome, but bundles its own pinned copy as a regular dependency
rather than a peer — this keeps the icon markup Cinder renders on the server
consistent with its own client build without depending on which
`lucide-svelte` version — if any — your application installs for its own
icons. (A bundler that dedupes Cinder's pinned copy onto a different version
your app requests can still cause the two to diverge; see the
`@lostgradient/cinder` changeset for that edge case.) Cinder does not provide a
general icon library for your application-specific icons.

Two import shapes, pick one per file:

```ts
// Root barrel — convenient, larger import graph, fine for Node SSR.
import { Button, Modal } from '@lostgradient/cinder';
```

```ts
// Subpath — tree-shake friendly, ideal under Vite / SvelteKit.
import Button from '@lostgradient/cinder/button';
import Modal from '@lostgradient/cinder/modal';
```

Then load the **base** stylesheet **once**, **first**, at your app entry:

```ts
import '@lostgradient/cinder/styles';
import '@lostgradient/cinder/styles/guard'; // dev-only: warns if the above line is missing
```

`@lostgradient/cinder/styles` is the slim base: it declares the `@layer` order
(`cinder.tokens, cinder.foundation, cinder.components, cinder.utilities`),
ships the design tokens, base resets, utilities, and shared internal chrome.
It does **not** ship per-component CSS. Component entry points automatically
load their co-located sidecar, so the common case is:

```ts
import Button from '@lostgradient/cinder/button';

import Modal from '@lostgradient/cinder/modal';
```

Bundlers (Vite, SvelteKit, esbuild, Bun) then include only the component CSS
you actually reference — a button-only app ships zero badge or tabs rules.
The browser build injects the public `/styles` subpath for compiled entries,
while the Svelte-aware source entry imports its local sidecar. Server (`node`)
entries remain CSS-free so plain Node SSR can import them safely.

The `/styles` subpaths remain published for explicit CSS composition and
advanced bundler setups. They are not required for normal component imports.

> [!WARNING] `@lostgradient/cinder/styles` MUST be imported first
> `@lostgradient/cinder/styles` MUST be imported before any `@lostgradient/cinder/<component>/styles`. The
> base declares the `@layer` order. If a component's CSS lands first, the
> cascade layers are created in insertion order — utilities can no longer
> override component defaults, and tokens may lose to component rules. This is
> a silent cascade inversion that produces no browser error.
>
> To catch this in development, import `@lostgradient/cinder/styles/guard` at your app entry
> alongside `@lostgradient/cinder/styles`. The guard is a no-op in production (the `DEV`
> constant from `esm-env` eliminates it at build time). In development it
> checks once, after module evaluation, whether the base custom property
> (`--cinder-base-loaded`) is present on `:root`; if not, it logs a warning
> pointing at the fix.

**Compound components** (Tabs, Table, Accordion, SideNavigation) ship their
whole family from the parent component subpath — `import '@lostgradient/cinder/tabs'`
loads the parent and its leaf CSS, so you do not import each leaf separately.

**All-in escape hatch.** If you do not want to manage per-component imports,
`import '@lostgradient/cinder/styles/all'` ships the base plus every component's CSS in one
shot (no tree-shaking). The `@lostgradient/cinder/styles/all` bundle also carries the
experimental-component styles and the JSON-highlight token set used by
`highlightJson()`; the slim base does not. There are also layer-only
sub-entries — `@lostgradient/cinder/styles/tokens`, `@lostgradient/cinder/styles/foundation`, and
`@lostgradient/cinder/styles/utilities` — for advanced à-la-carte setups.

### Syntax highlighting (automatic)

`<CodeBlock>` highlights itself. Set a `language` and that is all you need —
CodeBlock lazy-loads the bundled `@lostgradient/cinder/highlighters/shiki` adapter on the
client and highlights automatically. There is no provider to mount and no
highlighter to wire:

```svelte
<script lang="ts">
  import { CodeBlock } from '@lostgradient/cinder';
</script>

<CodeBlock {code} language="ts" />
```

Highlighting is a two-phase, client-only enhancement: the server (and the
first client paint) emit the plain `<pre><code>` fallback, and CodeBlock swaps
in the highlighted HTML once Shiki resolves. Colorization may appear after
first paint, but the plain and highlighted states share one stable scroll
viewport and identical box metrics, so highlighting must not move surrounding
layout. Shiki is dynamic-imported the first time any `<CodeBlock>` actually
highlights, so it never lands in the SSR bundle and a page that renders no
highlighted code ships zero Shiki bytes in its entry chunk.

The bundled default applies Shiki's dual-theme mode (`github-light` /
`github-dark`), which emits CSS variables that re-theme with cinder's
light/dark switch. Empty, missing, or unknown languages fall back to escaped
plaintext rather than throwing.

To override the default per instance, pass a custom `highlighter` — for
example a `shikiHighlighter()` configured with a specific theme or preloaded
grammars:

```svelte
<script lang="ts">
  import { CodeBlock } from '@lostgradient/cinder';
  import { shikiHighlighter } from '@lostgradient/cinder/highlighters/shiki';
  import type { Highlighter } from '@lostgradient/cinder';

  // A single theme string, or { light, dark } for dual-theme mode; `langs`
  // preloads specific grammars. Shiki is lazy-imported on first highlight.
  const highlighter: Highlighter = shikiHighlighter({ theme: 'github-light' });
</script>

<CodeBlock {code} language="ts" {highlighter} />
```

> [!WARNING] The `highlighter` output is rendered with `{@html}`
> A custom `highlighter` returns trusted HTML rendered verbatim via `{@html}`.
> It MUST escape any user- or caller-provided `code` before returning markup,
> or it opens an HTML-injection / XSS hole. cinder's only safety guarantee is
> that the bundled adapter with default options escapes code text — a custom
> highlighter (and Shiki with custom transformers / decorations / raw-HTML
> options) is your trust boundary, not cinder's. When you want guaranteed
> escaped plaintext, pass `highlight={false}` instead: that path renders the
> code through Svelte text interpolation and never touches `{@html}`.

> [!WARNING] Single-string themes do not re-theme
> Pass `theme` as `{ light, dark }` when highlighted code should re-theme with
> cinder's light/dark switch. A single-string `theme` bakes one palette into
> Shiki's inline `color:` styles, which CSS cannot override per theme — the
> choice happens at highlight time in `shikiHighlighter`, not later in cinder's
> stylesheet.

`highlight={false}` keeps the `language` header label while disabling all
highlighting — including an explicit `highlighter` prop — and triggers no
Shiki import at all. It is the absolute off switch and the guaranteed-escaped
plaintext path.

### Discovery recipe (the agent contract)

This is the part that matters. Every component ships machine-readable
metadata. You do not need to read 100 READMEs.

**1. Ask the CLI or MCP server first.**

```sh
cinder search modal --json
cinder show button --json
cinder compare modal drawer --json
cinder best-practices styles --json
```

For agent runtimes that support MCP, run `cinder mcp` as a read-only stdio MCP
server and use `search_components`, `get_component`, `compare_components`, and
`get_best_practices`. The server also exposes `cinder://manifest` plus
`cinder://component/{id}` and its `/schema`, `/variables`, `/examples`, and
`/constraints` resources.

**2. Fall back to the manifest when the CLI/MCP path is unavailable.**

```ts
import manifest from '@lostgradient/cinder/manifest' with { type: 'json' };
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

**3. Fetch the prop signature.**

```ts
type ButtonSchema = typeof import('@lostgradient/cinder/button/schema').default;
```

`@lostgradient/cinder/<name>/schema` and `@lostgradient/cinder/<name>/variables` are full runtime entry
points. They ship the five-condition shape (`types` + `browser` + `node` +
`svelte` + `default`): the build compiles each `<name>.schema.ts` / `<name>.variables.ts`
to its own JS, so a plain Node or Vite (non-Svelte) consumer can import the
default-exported value directly:

```ts
import buttonSchema from '@lostgradient/cinder/button/schema';
import buttonVariables from '@lostgradient/cinder/button/variables';
```

`buttonSchema` is a JSON Schema draft 2020-12 document (required props, prop
types, enum values, and defaults); `buttonVariables` is the component's CSS
custom-property names. To reach the **type** instead of the value, use `typeof`
on the default export through `import(...)` or an `import type * as` namespace
binding:

```ts
type ButtonSchema = typeof import('@lostgradient/cinder/button/schema').default;

import type * as ButtonSchemaModule from '@lostgradient/cinder/button/schema';
type ButtonSchemaToo = typeof ButtonSchemaModule.default;
```

> [!WARNING]
> Do **not** use a default-only `import type ButtonSchemaModule from '…'` to
> reach the _type_. The failure mode depends on your `moduleResolution`.
> Under `bundler`, `node16`, or `nodenext`-with-ESM-interop it errors with
> `TS2339: Property 'default' does not exist on type 'ComponentSchema'`.
> Under `nodenext`'s CJS interop path it silently widens the default type to
> `any`. For the runtime _value_ a plain
> `import buttonSchema from '@lostgradient/cinder/button/schema'` is correct; the namespace
> form is only needed when you want the `typeof` type.

A JSON sidecar (`<name>.schema.json` / `<name>.variables.json`) still ships
alongside each module for tooling that prefers reading raw JSON off disk, but
importing the subpath is the simpler path now that it carries a runtime
`default` condition.

The authoritative, machine-readable index for every component is the CLI/MCP
knowledge service, backed by `@lostgradient/cinder/manifest` (step 2).

**4. Fetch the cross-prop constraints — when `hasConstraints` is true.**

```ts
import buttonConstraints from '@lostgradient/cinder/button/constraints' with { type: 'json' };
```

`@lostgradient/cinder/<name>/constraints` is a JSON file. Use the `with { type: 'json' }`
import attribute on a modern runtime. For Node consumers without import-
attribute support, read the file off disk:

```ts
import { readFile } from 'node:fs/promises';
const url = new URL(import.meta.resolve('@lostgradient/cinder/button/constraints'));
const buttonConstraints = JSON.parse(await readFile(url, 'utf-8'));
```

JSON Schema cannot cleanly express rules like _"exactly one of `label`,
`children`, or `iconOnly`"_ or _"`iconOnly` requires an accessible name
source"_ — those rules live in the constraints sidecar as a small DSL.

**5. Fetch canonical examples — when `hasExamples` is true.**

```ts
import buttonExamples from '@lostgradient/cinder/button/examples' with { type: 'json' };
```

Like `/constraints`, the `/examples` subpath ships as JSON.

Each example has a `title`, `description`, and a `code` string you can show
the user or copy into their codebase verbatim.

**6. Compose.** Use the kebab-case `id` from the manifest (`button-group`,
`copy-button`) when you cross-reference components in your own code — that
matches the convention `@lostgradient/cinder` uses internally and in `related[]`.

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
  build (`@lostgradient/cinder` root, no subpath) is the SSR entry point.
- **Svelte 5 runes.** Components use `$state`, `$derived`, `$props`. Pass
  bindings with `bind:value` where the schema marks a prop bindable.
- **Theming via `light-dark()`.** There is no `<ThemeProvider>`. Tokens are
  defined with the CSS `light-dark()` function and switch based on
  `color-scheme`. Set `color-scheme: dark` on `<html>` (or any ancestor) to
  flip the palette.

### Decision aid

The tables below are auto-generated from the manifest. Each row lists the
`id` you import (`@lostgradient/cinder/<id>`), the component's `purpose`, and its first
`useWhen` clause as a tiebreaker. When you need a fuller comparison, read
the matching entry in `@lostgradient/cinder/manifest`.

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
| `modal`        | Centered modal dialog shell built on the native dialog element with focus capture, restoration, and dismissal… | Presenting rich or structured content that requires user interaction before returning to the page — forms,…   |
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
- **No process-global toast singleton.** `ToastRegion` owns a region-scoped
  queue and live regions. Mount one where descendants should dispatch, then
  bridge application events into the nearest region with `useToast()`.
- **No form-state manager.** Components are uncontrolled-friendly and play
  nicely with `bind:value`. Pair them with a form library of your choice
  (Felte, Superforms, plain `<form>`) for validation, submission, and field
  state.
- **No general-purpose icon library.** Bring your own product-specific icons.
  Components that accept icons take them as snippets or slots — pass an
  `<svg>`, a Lucide component, whatever you ship.
- **No data fetching.** Components render the data you hand them.
- **No global state.** There is no `@lostgradient/cinder` store, context provider, or
  initialization step beyond the styles import. `<CodeBlock>` highlights
  itself by lazy-loading Shiki on the client (see "Syntax highlighting"
  above) — no provider to mount.

---

## Contributing to cinder

You are editing inside `packages/components`. Read this section before
adding a component, changing a generator, or extending the manifest.

### Validation ownership

The `pre-commit` hook checks lockfile staging and runs staged formatters and
package sorting only. Required PR CI and `main-green` own broad source lint,
typecheck, and test gates; release owns consumer/tarball validation and package
weight checks. For ordinary issue or pull request work, run focused regression
tests and necessary generated-artifact checks. Do not use the root
`bun run validate`, full test/coverage/browser suites, or consumer validation
as an ordinary local pull request gate; required CI and release own those broad
checks.

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
   import siblings via `@lostgradient/cinder/<id>` so the same string works in the
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
  `@category`, `@status`, and the optional accessibility tags `@a11yPattern`,
  `@keyboardShortcut`, `@a11yNote`.

`@avoidWhen` takes `<reason> | <kebab-id>`: the text before the first `|` is the
reason; the optional kebab-case id after it is the component to reach for
instead (rendered as a link, validated to be a real component id at generate
time). Omit the `| <id>` half when there is no single alternative.

`@keyboardShortcut` takes `<keys> | <action>` (the `|` is required). `@a11yPattern`
is a single WAI-ARIA pattern name; `@a11yNote` is repeatable free text. All
three a11y tags are optional — omit them entirely for components with nothing to say.

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
   * @avoidWhen Toggling a binary on/off state. | toggle
   * @avoidWhen Selecting from a fixed set of mutually exclusive options. | segmented-control
   * @related button-group, copy-button
   * @a11yPattern WAI-ARIA Button
   * @keyboardShortcut Enter / Space | Activates the button.
   * @a11yNote Uses a native button element so the role and pressed state are announced.
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
subpath import (`@lostgradient/cinder/<id>/styles`) rather than relying on the aggregator's
`@import … layer(cinder.components)`. Applications that layer their own
overrides should declare their layer order (e.g. `@layer cinder.components,
app;`) before importing cinder styles — the sidecar carries layer _membership_,
not ordering, so ordering stays the consumer's responsibility.
`scripts/check-component-css.ts` enforces the wrapper at build time.

Once the sidecar exists, `bun run exports:generate` automatically emits a
`@lostgradient/cinder/<id>/styles` subpath pointing at the built `dist/components/<id>/<id>.css`
— no hand-editing of `package.json` exports. The slim base
(`src/styles/index.css` → `@lostgradient/cinder/styles`) does **not** import per-component
CSS; the all-in aggregator (`src/styles/all.css` → `@lostgradient/cinder/styles/all`) imports
`components.css`, which lists every component sidecar in alphabetical order. If
you add a brand-new component with a sidecar, add its `@import` line to
`src/styles/components.css` (the all-in aggregator is hand-maintained, not
regenerated) so `@lostgradient/cinder/styles/all` picks it up.

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
  defeat tree-shaking for consumers importing only `@lostgradient/cinder/<leaf>`. The
  `compound-leaf-import-boundary.test.ts` enforces this.
- **Parent CSS aggregates the family.** When leaves ship their own CSS, the
  parent `<parent>.css` sidecar `@import`s each leaf's sidecar with a
  sibling-leaf path (`@import '../<leaf>/<leaf>.css';`) placed **before** the
  `@layer cinder.components { … }` wrapper. That path resolves identically in
  `src/` and the verbatim-copied `dist/` because the layout mirrors, so a
  consumer importing only `@lostgradient/cinder/<parent>/styles` gets the whole family. Each
  leaf still gets its own `@lostgradient/cinder/<leaf>/styles` subpath; bundlers dedupe the
  shared file by URL. `scripts/check-component-css.ts` permits exactly this
  sibling-leaf `@import` shape and rejects every other import. (Most table/tab
  leaves are styled entirely by the parent and ship empty registry sidecars —
  the `@import` is still correct and future-proof.)
- **Add flat exports for new leaves too.** Continue adding the flat
  `@lostgradient/cinder/<leaf>` subpath and the leaf's entry in `src/index.ts`. The
  namespace API is additive, not a replacement — keep flat leaf exports
  for the compatibility window.
- **Playground examples belong on the parent page.** Put compound usage
  under `examples/<parent>/`, never under `examples/<leaf>/`. Leaves
  documented under their parent should also be listed in
  `packages/playground/src/discover.ts`'s `COMPOSE_ONLY_COMPONENTS` set so
  the sidebar shows one entry per family. A component in `COMPOSE_ONLY_COMPONENTS`
  is intentionally exempt from its own `*.examples.json`; the parent example set
  is the runnable coverage.
- **README usage snippets show the namespace form.** Parent READMEs
  demonstrate `Parent.Leaf` composition and list every namespaced leaf in
  their `Subcomponents` region. Leaf READMEs point back at the parent for
  composed usage instead of duplicating a standalone snippet.
- **Context uses `createContext`, never raw `Symbol` keys.** Define the
  family's context in a dedicated context module with Svelte's
  `createContext<T>()`. Use `<family>.context.ts` beside the parent when the
  context belongs to one component family, and use `_internal/<family>-context.ts`
  when multiple families share the context contract.

  ```ts
  import { createContext } from 'svelte';

  export type FooContext = {
    /* … */
  };

  const [getFooContextStrict, setFooContext] = createContext<FooContext>();
  export { setFooContext };
  // Required (a leaf outside its parent is a programmer error): export the
  // strict getter directly — it throws automatically on a missing provider.
  export const getFooContext = getFooContextStrict;
  // Optional (a leaf may legitimately run with no provider): wrap with
  // optionalContext so a missing provider yields `undefined` instead of throwing.
  // export const tryGetFooContext = optionalContext(getFooContextStrict);
  ```

  Do **not** hand-roll `setContext<T>(SYMBOL, …)` / `getContext<T | undefined>(SYMBOL)`
  with a manual `if (!ctx) throw` — `createContext` provides the typed get/set
  pair and the throw-on-missing-provider guard for you, and consumers get
  compile-time narrowing without the `rawCtx`→`ctx` two-step cast. The Symbol
  key must not be exported from the family barrel. See
  `dropdown/dropdown.context.ts` for a family-local context and
  `_internal/side-navigation-group-context.ts` for a shared internal context.

- **Rune module suffixes describe ownership.** Use `use-<name>.svelte.ts` for
  reusable hook-like utilities consumed from multiple unrelated components,
  `<component>-state.svelte.ts` for a component family's reactive state model,
  `<component>-controller.svelte.ts` for imperative coordination around a
  component-specific runtime object, and `<name>.utilities.svelte.ts` only when
  the module is a small grab bag scoped to one component directory. Do not rename
  a `.ts` file to `.svelte.ts` unless it uses runes directly.

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
bun run scripts/render-agents-md.ts          # this AGENTS.md overlap-family block
bun run scripts/render-agents-md.ts --check  # drift-check this file
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

- Carry a `<script lang="ts" module>` block exporting a **string-literal**
  `title`, an optional string-literal `description`, plus an optional
  `component` (kebab-case id).
- Provide a **default export** — the example component itself (markup in the
  instance `<script>` / template). The playground mounts this default export;
  an example with no default export renders nothing.
- Import **only** from `@lostgradient/cinder`, `@lostgradient/cinder/<subpath>`, or a package listed in
  `scripts/example-allowed-packages.ts`. Relative imports, `$lib`,
  playground-only modules, and fixtures are hard errors.
- Contain no `<style>` block — styles come from `@lostgradient/cinder/styles`.

A minimal compliant example:

```svelte
<script lang="ts" module>
  // Required: a static string literal. The playground reads this verbatim to
  // label the example card. Template literals with `${...}` interpolation and
  // computed expressions are NOT supported — the value must be a plain string.
  export const title = 'Basic usage';
  // Optional: a one-line description rendered under the title.
  export const description = 'The smallest button you can render.';
  // Optional: an explicit kebab-case component id when the file path can't
  // be inferred (rare). Most examples omit this.
  // export const component = 'button';
</script>

<script lang="ts">
  import { Button } from '@lostgradient/cinder/button';
</script>

<Button>Click me</Button>
```

#### The `title` export is mandatory

`title` is required and must be present as a string literal. When it is missing
(or only a non-exported `const title` exists), the example metadata reader falls
back to the sentinel `'Untitled'`, the dev server logs
`[playground] example missing title: <filePath>`, and
`bun run --filter='@cinder/playground' validate` fails with the count of
offending files. A literal `export const title = 'Untitled'` is also rejected —
pick a real, descriptive title. Single-, double-, and backtick-quoted string
literals are all accepted; only interpolated template literals are not.

#### Excluding an example

To exclude an example that cannot ship (router-dependent, server-data,
iframe-isolated, etc.), add a top-of-file marker:

```svelte
// @cinder-example-exclude: requires-router
```

The reason must come from `allowedExampleExclusionReasons` in
`manifest.meta.ts`. The currently allowed reasons are:

- `playground-only-interaction` — relies on playground-only wiring that has no
  standalone equivalent.
- `requires-router` — needs a router the example harness does not provide.
- `requires-server-data` — needs server-fetched data to render meaningfully.
- `requires-iframe-isolation` — must run in an isolated iframe (e.g. global
  side effects).

To add a new reason, edit that array and document why in your PR. The exclusion
budget is capped at 10% of all playground examples; above that,
`components:check` fails.

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
