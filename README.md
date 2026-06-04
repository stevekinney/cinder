# cinder

A Svelte 5 design system.

**Phase 2 status**: 21 components shipped (Button + 20 new). Playground lands in Phase 3, static-analysis-driven controls in Phase 4.

## Consuming cinder

```bash
bun add @lostgradient/cinder
# or
npm install @lostgradient/cinder
```

```svelte
<!-- routes/+page.svelte -->
<script lang="ts">
  import { Button, Alert } from '@lostgradient/cinder';
  import '@lostgradient/cinder/styles';
</script>

<Alert variant="info">
  {#snippet children()}Hello from cinder{/snippet}
</Alert>
<Button label="Click me" />
```

## Component API

| Component          | Key props                                                              | Snippets                           | State model             |
| ------------------ | ---------------------------------------------------------------------- | ---------------------------------- | ----------------------- |
| **AccordionItem**  | `id`, `title`, `disabled?`                                             | `children` (panel)                 | reads Accordion context |
| **Accordion**      | `expandedIds` ($bindable), `multiple?`                                 | `children`                         | controlled              |
| **Alert**          | `variant?` (info/success/warning/error), `dismissible?`, `onDismiss?`  | `children`, `icon?`                | uncontrolled            |
| **Badge**          | `variant?` (neutral/success/warning/danger/info), `size?` (sm/md)      | `children`                         | stateless               |
| **Button**         | `variant?`, `size?`, `href?`, `label` or `children`                    | `children?`                        | stateless               |
| **Card**           | discriminated: `title`+`description?` OR `header` snippet              | `children`, `footer?`              | stateless               |
| **DataList**       | `items: T[]`                                                           | `children: Snippet<[T]>`, `empty?` | stateless               |
| **Dropdown**       | `open` ($bindable), `placement?`                                       | `trigger`, `children`              | controlled              |
| **EmptyState**     | `title`, `description?`                                                | `icon?`, `action?`                 | stateless               |
| **Input**          | `id`, `value` ($bindable), `label?`, `description?`, `error?`, `type?` | —                                  | controlled              |
| **Modal**          | `open` ($bindable), `title`                                            | `children`, `footer?`              | controlled              |
| **NavigationBar**  | —                                                                      | `brand?`, `items`, `actions?`      | stateless               |
| **NavigationItem** | discriminated: `href` OR `onClick`; `active?`, `disabled?`             | `children`                         | stateless               |
| **PageLayout**     | `title`                                                                | `actions?`, `children`             | stateless               |
| **Pagination**     | `currentPage` ($bindable), `totalPages`, `totalCount?`                 | —                                  | controlled              |
| **Select**         | `id`, `value` ($bindable, string), `options`, `label?`, `disabled?`    | —                                  | controlled              |
| **Skeleton**       | `width?`, `height?`, `radius?`                                         | —                                  | stateless               |
| **Spinner**        | `size?` (sm/md/lg), `label?`                                           | —                                  | stateless               |
| **Textarea**       | `id`, `value` ($bindable), `label?`, `description?`, `error?`, `rows?` | —                                  | controlled              |
| **Toggle**         | `id`, `pressed` ($bindable), `label`, `disabled?`                      | —                                  | controlled              |
| **Tooltip**        | `text`, `placement?` (top/right/bottom/left)                           | `children` (trigger)               | uncontrolled            |

### Subpath imports

Every component is individually importable in Vite/SvelteKit consumers (the `svelte` export condition):

```svelte
<script lang="ts">
  import Button from '@lostgradient/cinder/button';
  import Alert from '@lostgradient/cinder/alert';
  // ...one subpath per component
</script>
```

> [!NOTE]
> Subpath exports only define `svelte` and `types` conditions — they are designed for Vite/SvelteKit bundler consumers. Plain Node SSR consumers should use the root barrel via the `node` condition: `import { Button } from '@lostgradient/cinder'`. Per-component Node SSR subpaths are a Phase 5 addition.

### Compound components

Components with compose-only leaves (`Tabs`, `Table`, `Dropdown`, `Accordion`,
`Tree`, `Feed`, `GridList`, `StatGroup`, `SideNavigation`) expose those leaves
as namespace properties on the parent. Importing the parent once is the
idiomatic API:

```svelte
<script lang="ts">
  import { Tabs } from '@lostgradient/cinder';
  // or: import { Tabs } from '@lostgradient/cinder/tabs';

  let active = $state('overview');
</script>

<Tabs bind:value={active}>
  <Tabs.List label="Project sections">
    <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
    <Tabs.Trigger value="activity">Activity</Tabs.Trigger>
  </Tabs.List>
  <Tabs.Panel value="overview">Project overview.</Tabs.Panel>
  <Tabs.Panel value="activity">Recent activity.</Tabs.Panel>
</Tabs>
```

The flat leaf exports (`Tab`, `TabList`, `TabPanel`, `TableBody`,
`DropdownTrigger`, `AccordionItem`, and the rest) remain supported for the
foreseeable future. Both the root barrel (`import { Tab } from '@lostgradient/cinder'`)
and the per-leaf subpaths (`import Tab from '@lostgradient/cinder/tab'`) continue to work
unchanged — deprecation of those forms is out of scope for this change.

### Export conditions

| Condition | Target                  | Consumer type                      |
| --------- | ----------------------- | ---------------------------------- |
| `svelte`  | `src/index.ts` (source) | Vite / SvelteKit                   |
| `types`   | `dist/index.d.ts`       | TypeScript type resolution         |
| `node`    | `dist/server/index.js`  | Plain Node SSR via `svelte/server` |

### Peer-dependency policy

`peerDependencies: { "svelte": ">=5.55.0 <6" }`

Cinder supports Svelte 5 from `5.55.0` through the latest stable Svelte 5 release. `validate:consumer` proves that contract against three Svelte lenses: the minimum supported version (`5.55.0`), the workspace version (`~5.55.0`), and the latest Svelte 5 version resolved by `svelte@^5`. The release gate fails if the peer range, workspace version, matrix, or documentation drift.

### Styles

`import '@lostgradient/cinder/styles'` once, anywhere. It loads a cascade-layer stack:

```
@layer cinder.tokens, cinder.foundation, cinder.components, cinder.utilities;
```

- **Classes** use the `.cinder-*` prefix: `.cinder-button`, `.cinder-alert`.
- **Variants** use `data-cinder-*` attributes: `data-cinder-variant`, `data-cinder-size`.
- **Design tokens** use `--cinder-*` for the public surface and `--_cinder-*` for internal-only custom properties. See [`docs/tokens.md`](docs/tokens.md) for the full catalog of public tokens and their defaults.

### Theming and dark mode

Cinder's color tokens are built on [`light-dark()`][mdn-light-dark]. Set `data-theme="light"` or `data-theme="dark"` on `:root` (or set `color-scheme` directly) and every semantic color follows automatically — no `ThemeProvider`, no class toggling. See [docs/theming.md](docs/theming.md) for the full contract, a copy-pasteable Svelte toggle, and a Storybook toolbar recipe.

[mdn-light-dark]: https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/light-dark

## Playground

`bun run playground` starts the playground dev server at http://localhost:5555 by default, or the next available port if 5555 is already taken. The sidebar lists all 21 components—click any one to open its page in the main frame. Each component page shows curated examples with live controls.

Those controls aren't hardcoded. The playground reads your component's `Props` type and generates form inputs automatically—text fields for strings, toggles for booleans, dropdowns for string unions. Change a `.svelte` file and the playground reloads via Server-Sent Events; no manual refresh needed.

## Analyzer conventions

The static analyzer (`scripts/playground/analyze.ts`) relies on five structural conventions—already enforced by `src/convention.test.ts` and required to ship a component in Phase 2 or later. None of this is magic; it's just how the analyzer finds what it needs.

Every component's module script must export a `${PascalName}Props` type alias. The analyzer reads the exported name to find the type definition; a Props export with any other name is silently ignored.

Your instance script must destructure from `$props()`—not assign to a variable like `const props = $props()`. Destructuring lets the analyzer walk the object pattern directly and know exactly which props exist.

Every prop you destructure must have either a default value or a type annotation. The analyzer needs the type to infer control kinds (text, boolean, dropdown); the default value seeds the control's initial state.

When you use `$bindable()`, its argument must be a JSON-serializable literal—strings, numbers, booleans, empty arrays, empty objects, or nothing at all. No function calls, no identifiers, no dynamic expressions. The playground initializes form state from your defaults and can only do that with values it can serialize.

Snippet props must be typed as `Snippet` or `Snippet<[T]>`, never `Snippet | undefined`. Use `Snippet?` for optional snippets instead. The analyzer skips snippets entirely when generating controls—they can't be represented as form inputs.

## Working on cinder

### Environment

- **Bun >= 1.3.0**: pinned in `engines.bun`. Runtime, bundler, test runner, package manager.
- **Node >= 22**: required for `bun run validate:consumer`, which verifies the `"node"` export condition under actual Node (not Bun).
- **Git**: for the commit-workflow simulation in `bun run validate:workflow`.

### Scripts

```bash
bun install                    # install dependencies
bun run build                  # server bundle + svelte2tsx .d.ts + tsc declarations → dist/
bun run typecheck              # tsc --noEmit + svelte-check
bun run lint                   # oxlint
bun run test                   # TZ=UTC LANG=en_US.UTF-8 bun test --conditions browser
bun run test:coverage          # same with --coverage
bun run exports:generate       # regenerate package.json#exports from src/components/*.svelte
bun run exports:check          # assert exports are in sync (non-zero on drift)
bun run validate:workflow      # isolated lint-staged simulation
bun run validate:consumer      # build → pack → tarball check → sveltekit + node fixtures
bun run validate:svelte-peer   # assert peer range, matrix, and docs agree
bun run package:weight         # report packed size, file count, and largest entries
bun run package:weight:check   # enforce package artifact budgets
bun run validate               # all of the above
```

> [!IMPORTANT]
> Always run tests via `bun run test`, not `bun test` directly. The script passes `--conditions browser` and sets `TZ=UTC LANG=en_US.UTF-8` for deterministic Intl output.

### Authoring conventions

Component files live as flat `.svelte` under `src/components/`. Every public component must:

- Use `<script lang="ts" module>` to export its `Props` type (and any `Variant`/`Size` literal unions) with JSDoc on each.
- Use `$props()` destructuring with defaults and/or type annotations per prop.
- Type `Snippet` children as `Snippet` or `Snippet<[...]>` — never `Snippet | undefined` (use `Snippet?` for optional).
- Use `$bindable(literal)` or `$bindable()` defaults — no arbitrary expression arguments.
- Carry **no `<style>` block**. The plugin throws at compile time if it sees one.
- Style via `.cinder-<name>` in a dedicated partial under `src/styles/components/<name>.css`.
- Merge a `class?: string` prop via `cn()` from `src/utilities/class-names.ts`.
- For components that spread HTML attributes (`{...rest}`): destructure `...rest` in `$props()` AND spread it on a native DOM element in the template.

### Internal components

`src/components/_internal/` is excluded from exports and the published tarball. Components there may be consumed by other components within cinder but are not public API.

### Determinism

Test output for date, number, and duration formatting is pinned to `en-US` locale and `UTC` timezone:

- The `test` script in `package.json` sets `TZ=UTC LANG=en_US.UTF-8` before invoking Bun.
- Utility test files (`format-date.test.ts`, etc.) include a `beforeAll` guard that throws if `TZ !== 'UTC'`.
- `validate-consumers.ts` sets the same env vars when spawning fixture subprocesses.

Run `bun run test` (not `bun test`) to pick up these variables.

### Subpath export drift

If you add a new component file, run `bun run exports:generate` to update `package.json#exports`, then commit both files together. The `exports:check` step (part of `bun run build`) will fail if they drift.

## Packaging layout

After `bun run build`:

```
dist/
├── index.d.ts                         (tsc declarations for the barrel)
├── server/                            ("node" export target)
│   ├── index.js
│   └── components/{all-21-components}.js
└── components/{all-21-components}.svelte.d.ts  (svelte2tsx output)
```

The published tarball is produced by `packages/components/scripts/pack-for-publish.ts`, not by raw `npm publish` from the package directory. `validate:consumer`, `bun run changeset:publish:dry`, the Changesets release workflow, and the manual break-glass workflow all use that same staged artifact. The staged manifest strips private `@cinder/*` workspace dependencies, rewrites upstream re-export subpaths to real `dist/` files, and removes scripts before `npm publish <tarball>`.

The artifact contains `dist/`, Svelte-facing component source, style sidecars, JSON sidecars, highlighter source, the public utilities used by components, `components.json`, and package documentation. Fixtures, tests, type-test files, generated test harnesses, source maps, `.a11y.md` files, scripts, and temporary directories are excluded. `validate:consumer` asserts both expected and forbidden paths, and `package:weight:check` enforces the packed-size, unpacked-size, file-count, and largest-entry budgets before release.

## Phase 5 decision log

### Workspace split — elected but deferred

Two criteria trigger a workspace split per the project plan: (1) the playground exceeds a complexity threshold where it deserves independent dependency isolation, and (2) a playground-only tool pollutes the root development environment with no benefit to contributors working only on components. Both are met as of commit `472ebff` (2026-04-28): the playground source is substantial enough to justify isolation, and `ts-morph` — used exclusively by the playground analyzer — currently lives in root `devDependencies` alongside every contributor's install, even those who never touch the playground.

The target structure when executed:

```
cinder/
├── packages/
│   ├── components/   (published — name: "@lostgradient/cinder", all current exports)
│   └── playground/   (private — name: "@cinder/playground", ts-morph isolated here)
```

The migration touches a large number of files (import paths, tsconfigs, `bunfig.toml`, husky hooks) and was deliberately deferred rather than executed with broken tests. Do not execute until there are no concurrent package-structure changes on `main`, and both `bun test --conditions browser` and `bun run validate:consumer` pass cleanly on the migration branch before merging.

### Browser export — declined

The two existing consumer fixtures (`fixtures/sveltekit-consumer/` and `fixtures/node-consumer/`) both resolve via the `"svelte"` condition; neither requires a pre-compiled client bundle. No external consumer has raised a specific need for a `"browser"` export condition. Revisit if a real consuming application fails to resolve cinder through its bundler, or if a concrete use case (e.g. usage in a non-Svelte-aware build pipeline) is documented in an issue.

## Library boundary

Cinder has **three admission tiers** within two import namespaces. The import namespaces are `@lostgradient/cinder/<name>` (stable and domain-suite both use this shape) and `@lostgradient/cinder/experimental/<name>` (experimental). The _tier_ determines the admission rule and stability guarantee; the _import shape_ is what consumers use. A consumer importing `@lostgradient/cinder/chat` and a consumer importing `@lostgradient/cinder/button` use the same import pattern—but `chat` is a domain-suite component admitted under a weaker rule with different churn expectations than a stable primitive.

### Stability guarantees by tier

- **Stable**: public API is considered production-ready; changes follow the deprecation cycle (minor bump with notice, removal in a later major).
- **Experimental** (`@lostgradient/cinder/experimental/<name>`): API may change in any minor bump; documented as unstable.
- **Domain-suite** (`@lostgradient/cinder/<name>`): ships under the stable subpath shape for import convenience, but follows the experimental stability contract—API may change in any minor bump until the component earns promotion to the stable tier. Consumers importing domain-suite components must opt in with the awareness that heavy dep upgrades (ProseMirror, Milkdown, remark) may force API changes.

### Stable admission rules

A component is admitted directly to **stable** only if **either**:

- **Multi-consumer rule**: requested by two or more reference consumers, AND independent of any single consumer's domain model, AND has a public API stable enough that adopters can rely on prerelease bumps.
- **Universal-primitive rule**: it is a low-risk visual primitive with a well-established API in the wider Svelte/web ecosystem and minimal API-stability risk: Label, Avatar, Breadcrumbs, Kbd, CopyButton, Progress, CodeBlock. **Overlay components are explicitly excluded** from this rule because their API surface (modality, focus, positioning, hydration) is high-churn regardless of ecosystem precedent.

Components that meet neither rule—including all overlays without multi-consumer demand and all observability components—start in the **experimental** namespace.

### Promotion from experimental to stable

The single canonical promotion rule:

- Multi-consumer demand from at least two reference consumers, AND
- One real consumer-replacement landed (deleted local component in any **currently-Svelte** consumer in favor of the Cinder version), AND
- No API change in the last release cycle, AND
- Accessibility, keyboard, and hydration tests passing.

The replacement gate is a quality signal—it requires a real Cinder component running in a real Svelte app. The demand gate is a roadmap signal—it ranks priority across all named consumers.

**Stable status, once granted, is permanent** unless the component's API is found to be technically wrong. Stable does not get revoked because of downstream scheduling. Adoption gates entry into stable; it does not threaten exit. If a stable component's API turns out to be wrong, it goes through a normal deprecation cycle (minor bump with deprecation notice, removal in a later major), not a demotion.

### Domain-suite tier

The domain-suite tier exists for heavyweight components whose dependency graphs reach beyond visual primitives—chat surfaces, diff viewers, markdown editors, review editors. They ship under `@lostgradient/cinder/<name>` subpaths exactly like stable components, so a downstream consumer's import shape is identical (`import { Chat } from '@lostgradient/cinder/chat'`). They are tree-shaken: a consumer that imports only `@lostgradient/cinder/button` does not bundle ProseMirror, remark, or shiki. All runtime dependencies still install with the main package today; moving heavy suites to optional peer dependencies or secondary packages requires a separate package-boundary task.

**Domain-suite admission rule**: requested by **at least one reference consumer** with the heavy peer-dep chain accepted by both Cinder maintainers and that consumer. The single-consumer threshold (vs the multi-consumer threshold for stable) is intentional—these components are too specialized to expect uniform demand, but too valuable to leave in consuming apps to re-implement.

**Domain-suite carve-outs** (scoped, allowlisted, removable):

- The "no `<style>` blocks" rule does not apply. Components in this tier may carry per-component `<style>` blocks and co-located `.css` files. The exemption is enforced by a hard-coded allowlist in `convention.test.ts`: `chat`, `diff-viewer`, `review-editor`, `markdown-editor`. Adding a new domain-suite component requires explicit allowlist update; new names attempting `<style>` blocks fail the test.
- **Removal criteria**: a component leaves the allowlist when its CSS migrates to a partial under `src/styles/components/`. The allowlist is a transitional accommodation, not a permanent license.

**Consumer-facing components** (current `@lostgradient/cinder/<name>` allowlist):

- `chat`—`conversationalist` runtime dep.
- `diff-viewer`—`@cinder/diff` + `@cinder/markdown/diff` runtime deps.
- `markdown-editor`—`@cinder/editor` + `@cinder/markdown` + `@milkdown/kit` + `prosemirror-*` runtime deps.
- `review-editor`—everything above plus `@cinder/commentary`.

**Supporting workspace packages** (not consumer-facing `@lostgradient/cinder/<name>` components):

These are `@cinder/*` scoped packages that live in the cinder monorepo but are not imported as `@lostgradient/cinder/<name>`. They are implementation dependencies of the consumer-facing components above.

- `@cinder/diff`—standalone diff algorithm; `diff-match-patch` only dep.
- `@cinder/markdown`—markdown pipeline, rendering, and utilities; 18 npm deps (unified, remark-_, rehype-_, shiki, etc.).
- `@cinder/editor`—ProseMirror + Milkdown integration; depends on `@cinder/markdown` + `@milkdown/kit`.
- `@cinder/commentary`—comment threads, anchoring, and export; depends on `@cinder/editor` + `@cinder/markdown`.

### Out of scope

- **Mermaid, charts**—domain widgets with heavy peer deps that don't have multi-consumer demand; stay in consuming apps.
- **Syntax highlighting bundled into cinder/code-block**—Shiki is heavy and consumers like depict already own it; `@lostgradient/cinder/code-block` ships with opt-in highlighting via a `highlighter` async callback prop, so consumers wire in Shiki (or any highlighter) at their boundary without pulling the dependency into the library itself.
- **Form wrapper with validation orchestration**—deferred until two consumers ask.
- **VerificationCodeInput**—single-consumer-specific, specialized.
- **Multi-select / async combobox, virtualized table**—explicit non-goals for v1.
- **React port of cinder**—cross-framework needs are tracked at the vocabulary level; the port itself is not in scope.

## Recipes

- [Live-region announcer for transient messages](docs/recipes/announcer.md)

## License

MIT
