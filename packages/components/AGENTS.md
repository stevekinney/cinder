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

Then load the stylesheet **once** at your app entry:

```ts
import 'cinder/styles';
```

That single import wires up the design tokens, base resets, and every
component's CSS. There is no per-component CSS to import.

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
import buttonSchema from 'cinder/button/schema' with { type: 'json' };
```

The result is a JSON Schema draft 2020-12 document. Required props, prop
types, enum values, and defaults are all there.

**3. Fetch the cross-prop constraints — when `hasConstraints` is true.**

```ts
import buttonConstraints from 'cinder/button/constraints' with { type: 'json' };
```

JSON Schema cannot cleanly express rules like _"exactly one of `label`,
`children`, or `iconOnly`"_ or _"`iconOnly` requires an accessible name
source."_ Those rules live in the constraints sidecar as a small DSL.

**4. Fetch canonical examples — when `hasExamples` is true.**

```ts
import buttonExamples from 'cinder/button/examples' with { type: 'json' };
```

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

### hover (2 components)

| id        | purpose                                                                                                     | use when                                                                                                   |
| --------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `tooltip` | Hover-and-focus triggered descriptive hint anchored to a focusable child element, wired through…            | Showing a short non-interactive label or description for an icon-only button or terse control.             |
| `popover` | Anchored floating panel positioned by Floating UI that hosts non-modal contextual content beside a trigger… | Showing rich, interactive contextual content anchored to a trigger such as a help panel, color picker, or… |

### notice (3 components)

| id        | purpose                                                                                                       | use when                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `banner`  | Page-level dismissible region landmark that surfaces a persistent informational, success, warning, or danger… | Communicating a persistent page-level status the user can dismiss, such as a maintenance window or trial… |
| `alert`   | Inline status message with assertive role for surfacing time-sensitive feedback about a nearby action or…     | Surfacing the result of a just-completed action such as a save failure or success.                        |
| `callout` | Inline aside that highlights supporting commentary alongside body content without claiming live-region…       | Drawing attention to tangential information nested inside prose, documentation, or article content.       |

### overlay (4 components)

| id        | purpose                                                                                                        | use when                                                                                                      |
| --------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `modal`   | Centered modal dialog built on the native dialog element with focus capture, restoration, and dismissal…       | Interrupting the user for a focused task or decision that blocks the rest of the page.                        |
| `drawer`  | Side-anchored modal panel built on the native dialog element for secondary navigation, settings, or long-form… | Showing supplementary navigation, filters, or settings that should slide in from a page edge.                 |
| `sheet`   | Bottom-anchored modal panel built on the native dialog element with an optional drag handle for mobile-first…  | Presenting a focused task or set of actions that slides up from the bottom of the viewport on touch surfaces. |
| `popover` | Anchored floating panel positioned by Floating UI that hosts non-modal contextual content beside a trigger…    | Showing rich, interactive contextual content anchored to a trigger such as a help panel, color picker, or…    |

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
- **No global state.** There is no `cinder` store, context provider, or
  initialization step beyond the styles import.

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
