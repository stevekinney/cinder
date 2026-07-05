# @lostgradient/cinder

Svelte 5 components for product interfaces: accessible primitives, design-system tokens, per-component CSS, generated prop schemas, and examples that can be read by people or tooling.

Use cinder when you want UI building blocks without adopting a framework-level router, form-state manager, data fetching layer, global state provider, or theme provider. The package is SSR-safe and targets Svelte `>=5.55.0 <6`.

## Install

```bash
bun add @lostgradient/cinder svelte lucide-svelte
```

`svelte` and `lucide-svelte` are peer dependencies. Cinder uses Lucide for its own component chrome, but it does not provide a general icon library for your application-specific icons.

Rich editor, markdown rendering, editor/commentary re-exports, and syntax-highlighting surfaces use optional peer dependencies. Install them only when your app imports `@lostgradient/cinder/chat` with the default composer, `@lostgradient/cinder/markdown-editor`, `@lostgradient/cinder/review-editor`, `@lostgradient/cinder/markdown`, `@lostgradient/cinder/markdown/*`, `@lostgradient/cinder/editor`, `@lostgradient/cinder/editor/*`, `@lostgradient/cinder/commentary`, `@lostgradient/cinder/commentary/*`, `@lostgradient/cinder/highlighters/shiki`, or relies on `Chat` built-in markdown/tool message rendering or `CodeBlock` automatic highlighting:

```bash
bun add @milkdown/ctx @milkdown/kit @milkdown/prose @shikijs/engine-oniguruma @shikijs/langs @shikijs/rehype @shikijs/types @types/hast @types/mdast @types/unist comlink hast-util-sanitize js-yaml prosemirror-inputrules prosemirror-model prosemirror-state prosemirror-view rehype-katex rehype-sanitize rehype-stringify remark-gfm remark-html remark-math remark-parse remark-rehype remark-stringify shiki unified unist-util-remove unist-util-visit
```

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

For agents and local tooling, prefer the published `cinder` command:

```sh
cinder search modal
cinder show button --json
cinder compare modal drawer --json
cinder best-practices styles
```

Use `cinder mcp` to start the read-only stdio MCP server. It exposes the same
component search, detail, comparison, best-practice guidance, and generated
artifact resources without requiring agents to parse package files directly.

Cinder also ships a machine-readable manifest for environments where the CLI or
MCP server is unavailable:

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

[data-theme='dark'] {
  color-scheme: dark;
}
```

Use `[data-theme='dark']` or `[data-theme='light']` on a subtree for scoped theme islands. Cinder pins the core semantic surface, text, border, overlay, and control tokens inside those scopes so components inherit local values without app-level token overrides.

Public tokens use the `--cinder-` prefix. Internal implementation variables use `--_cinder-`; do not redefine those.

## What Cinder Does Not Provide

Cinder is a presentation library, not an application framework.

- No router.
- No form-state manager.
- No application-wide toast singleton; use `ToastRegion` for scoped toast UI.
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
