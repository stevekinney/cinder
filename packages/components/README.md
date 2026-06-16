# @lostgradient/cinder

Svelte 5 components for product interfaces: accessible primitives, design-system tokens, per-component CSS, generated prop schemas, and examples that can be read by people or tooling.

Use cinder when you want UI building blocks without adopting a framework-level state, routing, form, or theme provider. The package is SSR-safe and targets Svelte `>=5.55.0 <6`.

## Install

```bash
bun add @lostgradient/cinder svelte lucide-svelte
```

`svelte` and `lucide-svelte` are peer dependencies. Cinder uses Lucide for its own component chrome, but it does not provide a general icon library for your application-specific icons.

## Quickstart

Load the base stylesheet once at your app entry:

```ts
import '@lostgradient/cinder/styles';
import '@lostgradient/cinder/styles/guard';
```

`@lostgradient/cinder/styles` is the base stylesheet. Import it once at your app entry before any component stylesheet. It declares cinder's cascade-layer order, design tokens, foundation rules, utilities, and shared internal chrome.

`@lostgradient/cinder/styles/guard` is development-only. It warns if the base stylesheet is missing or loaded too late.

Then import components and their styles from matching subpaths:

```svelte
<script lang="ts">
  import Button from '@lostgradient/cinder/button';
  import '@lostgradient/cinder/button/styles';
</script>

<Button variant="primary" label="Save changes" />
```

Component styles are separate so bundlers can include only what you use:

```svelte
<script lang="ts">
  import Modal from '@lostgradient/cinder/modal';
  import '@lostgradient/cinder/modal/styles';
</script>

<Modal open title="Edit project" />
```

You can also import the component module from TypeScript:

```ts
import Modal from '@lostgradient/cinder/modal';
```

Compound components include their leaf styles from the parent stylesheet. For example, `@lostgradient/cinder/tabs/styles` covers `Tabs`, `Tabs.List`, `Tabs.Trigger`, and `Tabs.Panel`.

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

## Finding the Right Component

Cinder ships a machine-readable manifest:

```ts
import manifest from '@lostgradient/cinder/manifest' with { type: 'json' };
```

`manifest.components[]` lists each public component with its `id`, `category`, `tags`, `purpose`, `useWhen`, `avoidWhen`, related components, and artifact subpaths.

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

## Theming

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

## What Cinder Does Not Provide

Cinder is a presentation library, not an application framework.

- No router.
- No form-state manager.
- No toast queue store.
- No data fetching layer.
- No global state provider.
- No general-purpose icon library for product-specific icons.

Wire those pieces with your application stack and pass the resulting state, callbacks, links, icons, and data into cinder components.

## Development

This package lives in the cinder monorepository under `packages/components`.

```bash
bun install
bun run --filter=@lostgradient/cinder validate
```

Useful package commands:

```bash
bun run --filter=@lostgradient/cinder build
bun run --filter=@lostgradient/cinder components:check
bun run --filter=@lostgradient/cinder exports:check
bun run --filter=@lostgradient/cinder validate:consumer
```

When adding or changing components, update the source files under `src/components/<component-id>/`, then run:

```bash
bun run --filter=@lostgradient/cinder components:generate
```

That regenerates schemas, variables, the manifest, generated README sections, and related artifacts.

## Repository

- Source: [github.com/stevekinney/cinder](https://github.com/stevekinney/cinder)
- Issues: [github.com/stevekinney/cinder/issues](https://github.com/stevekinney/cinder/issues)
