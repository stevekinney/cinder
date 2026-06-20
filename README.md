# cinder

Components for product interfaces.

The published package is `@lostgradient/cinder`: accessible primitives, domain-suite components, design-system tokens, per-component CSS, generated prop schemas, and examples that can be read by people or tooling. The current generated manifest lists 167 public component entries across action, data-display, domain, feedback, form, layout, navigation, overlay, and typography categories.

Use Cinder when you want UI building blocks without adopting a framework-level router, form-state manager, data fetching layer, global state provider, or theme provider. The package is SSR-safe.

## Install

```bash
bun add @lostgradient/cinder svelte lucide-svelte
```

`svelte` and `lucide-svelte` are peer dependencies. Cinder targets Svelte `>=5.55.0 <6`.
It uses Lucide for its own component chrome, but it does not provide a general icon library for
your application-specific icons.

## Quickstart

Load the base stylesheet once at your app entry, before any component stylesheet:

```ts
import '@lostgradient/cinder/styles';
import '@lostgradient/cinder/styles/guard';
```

`@lostgradient/cinder/styles` declares the cascade-layer order, design tokens, foundation rules, utilities, and shared internal chrome. `@lostgradient/cinder/styles/guard` is development-only; it warns when the base stylesheet is missing or loaded too late.

Then import components and their styles from matching subpaths:

```svelte
<script lang="ts">
  import Button from '@lostgradient/cinder/button';
  import Modal from '@lostgradient/cinder/modal';

  import '@lostgradient/cinder/button/styles';
  import '@lostgradient/cinder/modal/styles';
</script>

<Button variant="primary" label="Save changes" />
<Modal open title="Edit project" />
```

If you want one stylesheet with everything, use:

```ts
import '@lostgradient/cinder/styles/all';
```

That bundle includes the base stylesheet plus every component stylesheet. It is convenient, but it is not tree-shaken.

## Import Shapes

Prefer subpath imports in browser applications:

```ts
import Button from '@lostgradient/cinder/button';
import Modal from '@lostgradient/cinder/modal';
```

The root barrel is available when convenience matters more than keeping the import graph narrow:

```ts
import { Button, Modal } from '@lostgradient/cinder';
```

Every component subpath carries `types`, `svelte`, `node`, and `default` export conditions. Svelte-aware tooling reads the source entry through the `svelte` condition; plain Node SSR reads the compiled server entry through `node`; other non-Svelte ESM consumers can resolve the compiled `default` entry.

## Finding Components

Cinder ships a machine-readable manifest:

```ts
import manifest from '@lostgradient/cinder/manifest' with { type: 'json' };
```

`manifest.components[]` lists each public component with its `id`, `category`, `status`, `tags`, `purpose`, `useWhen`, `avoidWhen`, related components, and artifact subpaths.

Every component also ships generated sidecars:

```ts
import buttonSchema from '@lostgradient/cinder/button/schema';
import buttonVariables from '@lostgradient/cinder/button/variables';
import buttonConstraints from '@lostgradient/cinder/button/constraints' with { type: 'json' };
import buttonExamples from '@lostgradient/cinder/button/examples' with { type: 'json' };
```

- `schema`: JSON Schema for props.
- `variables`: public CSS custom properties for the component.
- `constraints`: cross-prop rules that JSON Schema cannot express cleanly.
- `examples`: canonical runnable usage snippets.

Not every component has `constraints` or `examples`; check the manifest's `hasConstraints` and `hasExamples` flags before importing those subpaths.

## Styling and Theming

Cinder uses CSS custom properties and `color-scheme`; there is no provider to mount.

```css
html {
  color-scheme: light;
}

html[data-theme='dark'] {
  color-scheme: dark;
}
```

Public tokens use the `--cinder-` prefix. Internal implementation variables use `--_cinder-`; do not redefine those.

See:

- [Design tokens](./docs/tokens.md)
- [Theming and dark mode](./docs/theming.md)
- [Focus ring policy](./docs/focus-ring-policy.md)
- [Packaging contract](./docs/packaging.md)
- [Recipes](./docs/recipes/README.md)

## What Cinder Does Not Provide

Cinder is a presentation library, not an application framework.

- No router.
- No form-state manager.
- No application-wide toast singleton; use `ToastRegion` for scoped toast UI.
- No data fetching layer.
- No global state provider.
- No general-purpose icon library for product-specific icons.

Wire those pieces with your application stack and pass the resulting state, callbacks, links, icons, and data into Cinder components.

## Workspace Layout

This repository is a Bun workspace.

| Workspace             | Purpose                                                    |
| --------------------- | ---------------------------------------------------------- |
| `packages/components` | Published `@lostgradient/cinder` package.                  |
| `packages/playground` | Private component playground and static export.            |
| `packages/testing`    | Private Playwright, axe, and visual-regression harness.    |
| `packages/diff`       | Private diff utilities used by domain-suite components.    |
| `packages/markdown`   | Private Markdown pipeline and rendering utilities.         |
| `packages/editor`     | Private editor runtime and template-placeholder utilities. |
| `packages/commentary` | Private review/comment anchoring utilities.                |

## Development

```bash
bun install
bun run dev
```

The playground opens at `/` with this README as its landing page. Component examples live under
`/c/<component-id>`; for example, `/c/accordion` opens the Accordion component page.

Useful root commands:

```bash
bun run build
bun run lint
bun run typecheck
bun run test
bun run test:browser
bun run validate
```

Useful package commands:

```bash
bun run --filter=@lostgradient/cinder build
bun run --filter=@lostgradient/cinder components:check
bun run --filter=@lostgradient/cinder components:generate
bun run --filter=@lostgradient/cinder exports:check
bun run --filter=@lostgradient/cinder validate:consumer
```

When adding or changing components, update files under `packages/components/src/components/<component-id>/`, then run:

```bash
bun run --filter=@lostgradient/cinder components:generate
```

That regenerates schemas, variables, examples, constraints, the manifest, generated README sections, package exports, and related artifacts.

## Release

Only `@lostgradient/cinder` publishes to npm. The other `@cinder/*` workspaces are private implementation packages that are packed into the published artifact when needed.

The npm artifact has one source of truth: `packages/components/scripts/pack-for-publish.ts`. Consumer validation, release dry runs, the Changesets publish path, and the manual break-glass workflow all publish or inspect the staged tarball from that script.

Before a release, run:

```bash
bun run validate
bun run --filter=@lostgradient/cinder package:weight:check
```

## Repository

- Source: [github.com/stevekinney/cinder](https://github.com/stevekinney/cinder)
- Issues: [github.com/stevekinney/cinder/issues](https://github.com/stevekinney/cinder/issues)
