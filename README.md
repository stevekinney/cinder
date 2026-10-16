# cinder

Components for product interfaces.

The core package is `@lostgradient/cinder`: accessible primitives, domain-suite components, design-system tokens, per-component CSS, generated prop schemas, and examples that can be read by people or tooling. The Editor domain suite is published separately as `@lostgradient/editor`. `@lostgradient/chat` stopped publishing on 2026-10-14; its last release, 0.16.0, remains on npm.

Use Cinder when you want UI building blocks without adopting a framework-level router, form-state manager, data fetching layer, global state provider, or theme provider. The package is SSR-safe.

## Install

```bash
bun add @lostgradient/cinder svelte
```

`svelte` is a peer dependency; Cinder targets Svelte `>=5.56.0 <6`.

`@lucide/svelte` is **not** a peer — Cinder owns it as a regular dependency and installs it for
you. That is deliberate: Cinder ships a prebuilt SSR bundle, so a consumer resolving a different
Lucide version on the client than the one baked into that bundle produces structurally different
markup for the same icon and a `hydration_mismatch` on first load. Cinder
uses Lucide for its own component chrome and does not provide a general icon library for your
application-specific icons — install Lucide yourself if you want it for your own components.

Install the Editor domain suite separately for `MarkdownEditor`, `ReviewEditor`, and `DiffViewer`:

```bash
bun add @lostgradient/editor
```

See [`@lostgradient/editor`'s README](./packages/editor/README.md) for its own peer install list
(Milkdown/ProseMirror and `@lostgradient/markdown`).

Cinder no longer exposes any `./markdown/*`, `./editor/*`, or `./commentary/*` subpath — that
surface moved to the two published sibling packages above during the
[package-boundaries extraction](./docs/decisions/package-boundaries.md). If your app imports one
of those removed subpaths, install `@lostgradient/markdown` directly (`bun add
@lostgradient/markdown`) and update the import specifier — see
[`@lostgradient/cinder`'s README](./packages/components/README.md) for the full removed-subpath
migration table. Syntax-highlighting (`CodeBlock` automatic highlighting via `shiki`) needs no
separate install — `shiki`, `@shikijs/engine-oniguruma`, and `@shikijs/types` are regular
`dependencies` of Cinder and install automatically.

## Quickstart

Load the base stylesheet once at your app entry, before importing any cinder component:

```ts
import '@lostgradient/cinder/styles';
import '@lostgradient/cinder/styles/guard';
```

`@lostgradient/cinder/styles` declares the cascade-layer order, design tokens, foundation rules, utilities, and shared internal chrome. `@lostgradient/cinder/styles/guard` is development-only; it warns when the base stylesheet is missing or loaded too late.

Then import components normally. In browser/Svelte-aware builds, component entry points automatically include their co-located CSS:

```svelte
<script lang="ts">
  import Button from '@lostgradient/cinder/button';
  import Modal from '@lostgradient/cinder/modal';
</script>

<Button variant="primary" label="Save changes" />
<Modal open title="Edit project" />
```

If you want one stylesheet with everything, use:

```ts
import '@lostgradient/cinder/styles/all';
```

That bundle includes the base stylesheet plus every component stylesheet. It is convenient, but it is not tree-shaken. The per-component `/styles` subpaths remain available for consumers that intentionally manage CSS imports themselves.

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

[data-theme='light'] {
  color-scheme: light;
}

[data-theme='dark'] {
  color-scheme: dark;
}
```

Use `[data-theme='dark']` or `[data-theme='light']` on a subtree for scoped theme islands. Cinder pins the core semantic surface, text, border, overlay, interaction, status, and control tokens inside those scopes so components inherit local values without app-level token overrides. If your app replaces Cinder's public tokens for custom branding, set those brand overrides in the same scoped theme selector.

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

| Workspace             | Purpose                                                                                                  |
| --------------------- | -------------------------------------------------------------------------------------------------------- |
| `packages/components` | Published `@lostgradient/cinder` package.                                                                |
| `packages/testing`    | Private workspace of small, target-owned checks the components package depends on.                       |
| `packages/markdown`   | Published `@lostgradient/markdown` package (headless Markdown pipeline, rendering, diffing, templating). |
| `packages/commentary` | Private review/comment anchoring and editor (ProseMirror/Milkdown) runtime utilities.                    |

## Development

```bash
bun install
```

The component playground lives in the private Corvidae workspace (`applications/playground`) and is served at cinder.website.

Useful root commands:

```bash
bun run build
bun run typecheck
bun run validate:consumer
```

Source lint, unit, coverage, and browser suites run in the private Corvidae workspace. Public mirror pull requests run the generated `mirror-verify` workflow against their exact package artifacts.

Useful package commands:

```bash
bun run --filter=@lostgradient/cinder build
bun run --filter=@lostgradient/cinder components:check
bun run --filter=@lostgradient/cinder components:generate
bun run --filter=@lostgradient/cinder exports:check
bun run --filter=@lostgradient/cinder validate:consumer
```

When adding or changing core components, update files under `packages/components/src/components/<component-id>/`, then run:

```bash
bun run --filter=@lostgradient/cinder components:generate
```

That regenerates schemas, variables, examples, constraints, the manifest, generated README sections, package exports, and related artifacts.

Editor component artifacts are emitted by Corvidae's mirror sync; do not generate them here.

## Release

`@lostgradient/markdown`, `@lostgradient/cinder`, `@lostgradient/editor` and `@lostgradient/cinder-mcp` publish to npm. `@lostgradient/chat` stopped publishing on 2026-10-14; its last release is 0.16.0. The `@cinder/*` workspaces remain private implementation packages that are packed into Cinder's published artifact when needed.

Each public package owns its packed artifact. Consumer validation, release dry runs, and the Changesets publish path build and inspect every tarball before publishing Markdown, Cinder, Editor, then cinder-mcp.

Before a release, run the same gates `release.yaml` runs: consumer validation for all four packages in publish order, then each package's weight budget against the tarball that validation staged.

```bash
bun run validate:consumer
bun run --filter=@lostgradient/markdown package:weight:check -- --existing-tarball
bun run --filter=@lostgradient/cinder package:weight:check -- --existing-tarball
bun run --filter=@lostgradient/editor package:weight:check -- --existing-tarball
bun run --filter=@lostgradient/cinder-mcp package:weight:check -- --existing-tarball
```

## Repository

- Source: [github.com/stevekinney/cinder](https://github.com/stevekinney/cinder)
- Issues: [github.com/stevekinney/cinder/issues](https://github.com/stevekinney/cinder/issues)
