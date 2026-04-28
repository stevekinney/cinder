# cinder

A Svelte 5 design system.

**Phase 2 status**: 21 components shipped (Button + 20 new). Playground lands in Phase 3, static-analysis-driven controls in Phase 4.

## Consuming cinder

```bash
bun add cinder
# or
npm install cinder
```

```svelte
<!-- routes/+page.svelte -->
<script lang="ts">
  import { Button, Alert } from 'cinder';
  import 'cinder/styles';
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
  import Button from 'cinder/button';
  import Alert from 'cinder/alert';
  // ...one subpath per component
</script>
```

> [!NOTE]
> Subpath exports only define `svelte` and `types` conditions — they are designed for Vite/SvelteKit bundler consumers. Plain Node SSR consumers should use the root barrel via the `node` condition: `import { Button } from 'cinder'`. Per-component Node SSR subpaths are a Phase 5 addition.

### Export conditions

| Condition | Target                  | Consumer type                      |
| --------- | ----------------------- | ---------------------------------- |
| `svelte`  | `src/index.ts` (source) | Vite / SvelteKit                   |
| `types`   | `dist/index.d.ts`       | TypeScript type resolution         |
| `node`    | `dist/server/index.js`  | Plain Node SSR via `svelte/server` |

### Peer-dependency policy

`peerDependencies: { "svelte": ">=5.55.0 <5.56.0" }`

cinder's compiled server output is coupled to the Svelte minor it was built against. Every cinder release pins exactly one Svelte minor. When Svelte ships a new minor, cinder bumps its own minor in lockstep.

### Styles

`import 'cinder/styles'` once, anywhere. It loads a cascade-layer stack:

```
@layer cinder.tokens, cinder.foundation, cinder.components, cinder.utilities;
```

- **Classes** use the `.cinder-*` prefix: `.cinder-button`, `.cinder-alert`.
- **Variants** use `data-cinder-*` attributes: `data-cinder-variant`, `data-cinder-size`.
- **Design tokens** use `--cinder-*` for the public surface and `--_cinder-*` for internal-only custom properties.

## Playground

`bun run playground` starts the playground dev server at http://localhost:4173. The sidebar lists all 21 components—click any one to open its page in the main frame. Each component page shows curated examples with live controls.

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

The published tarball (`bun pm pack`) contains `dist/`, `src/index.ts`, `src/components/**/*.svelte`, `src/styles/**/*.css`, the four generic utilities, and `README.md`. Fixtures, tests, `.a11y.md` files, `scripts/`, and `_internal/` components are excluded. `validate:consumer` asserts both expected and forbidden paths.

## Phase 5 decision log

### Workspace split — elected but deferred

Two criteria trigger a workspace split per the project plan: (1) the playground exceeds a complexity threshold where it deserves independent dependency isolation, and (2) a playground-only tool pollutes the root development environment with no benefit to contributors working only on components. Both are met as of commit `472ebff` (2026-04-28): the playground source is substantial enough to justify isolation, and `ts-morph` — used exclusively by the playground analyzer — currently lives in root `devDependencies` alongside every contributor's install, even those who never touch the playground.

The target structure when executed:

```
cinder/
├── packages/
│   ├── components/   (published — name: "cinder", all current exports)
│   └── playground/   (private — name: "@cinder/playground", ts-morph isolated here)
```

The migration touches a large number of files (import paths, tsconfigs, `bunfig.toml`, husky hooks) and was deliberately deferred rather than executed with broken tests. Do not execute until there are no concurrent package-structure changes on `main`, and both `bun test --conditions browser` and `bun run validate:consumer` pass cleanly on the migration branch before merging.

### Browser export — declined

The two existing consumer fixtures (`fixtures/sveltekit-consumer/` and `fixtures/node-consumer/`) both resolve via the `"svelte"` condition; neither requires a pre-compiled client bundle. No external consumer has raised a specific need for a `"browser"` export condition. Revisit if a real consuming application fails to resolve cinder through its bundler, or if a concrete use case (e.g. usage in a non-Svelte-aware build pipeline) is documented in an issue.

## License

MIT
