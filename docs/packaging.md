# Packaging contract

This document describes what `cinder` ships in its npm tarball, how the `exports`
map is resolved by the tooling consumers use, and the two supported ways to pull
in CSS.

## Conditional exports — resolution table

Every component subpath is published with the same conditional shape:

```jsonc
"./button": {
  "types": "./dist/components/button/index.d.ts",
  "svelte": "./src/components/button/index.ts",
  "node": "./dist/server/components/button/index.js",
  "default": "./dist/components/button/index.js"
}
```

Which file a given consumer actually loads depends on the resolver and its
condition set. Resolvers stop at the first condition they match. The table below
captures what wins where.

| Consumer / resolver                        | Condition matched | File loaded                                |
| ------------------------------------------ | ----------------- | ------------------------------------------ |
| TypeScript (`moduleResolution: nodenext`)  | `types`           | `./dist/components/button/index.d.ts`      |
| TypeScript (`moduleResolution: bundler`)   | `types`           | `./dist/components/button/index.d.ts`      |
| Vite / SvelteKit dev + build               | `svelte`          | `./src/components/button/index.ts`         |
| `svelte-package` / Svelte-aware tooling    | `svelte`          | `./src/components/button/index.ts`         |
| Node SSR without Svelte tooling            | `node`            | `./dist/server/components/button/index.js` |
| Bun consumer                               | `default`         | `./dist/components/button/index.js`        |
| Browser bundler (esbuild, Rollup, Webpack) | `default`         | `./dist/components/button/index.js`        |

The `svelte` condition is the public contract for Svelte-aware tooling. Source
paths it names are stable. Any other path under `src/` is implementation detail
and may move at any time. `dist/` is the contract for all non-Svelte tooling.

## Styles — two consumption modes

`cinder` exposes CSS through dedicated subpaths. There are two supported ways
to pull styles in.

### Mode 1 — whole-system aggregator

```ts
// app.css or your global stylesheet entry
import 'cinder/styles';
```

`cinder/styles` is the full cascade. It declares the `@layer` order and pulls in
tokens, foundation (reset), components, and utilities — each wrapped in its own
layer. Use this when you want the design system "as shipped" and do not need to
tree-shake CSS by component.

### Mode 2 — à la carte

```ts
// Required: tokens and foundation must come first.
import 'cinder/styles/tokens';
import 'cinder/styles/foundation';

// Then import only the components you use.
import 'cinder/button/styles';
import 'cinder/badge/styles';
```

Per-component CSS exports (`cinder/<name>/styles`) ship **layer-unwrapped CSS**.
They contain only component-scoped selectors and `--cinder-*` custom properties.
They do **not** declare `@layer`, tokens, or resets — because those must be
imported once at the top of the cascade, not duplicated per component.

This mode lets the bundler tree-shake unused component CSS, but the contract is
strict:

- `cinder/styles/tokens` and `cinder/styles/foundation` are **required** when
  using per-component CSS. Without them, components reference `--cinder-*`
  variables that have no definitions and inherit no resets.
- Component JS modules (`cinder/button`, `cinder/badge`, etc.) do not pull CSS
  as a side effect. Importing the JS gives you the component; importing
  `cinder/<name>/styles` gives you its CSS. They are independent.

## The `files` whitelist contract

The npm tarball ships both `dist/` and a curated subset of `src/`. The full list
lives in `packages/components/package.json` under `files`. The contract:

- **`dist/`** is the contract for all non-Svelte tooling (TypeScript types, Node
  SSR, Bun, browser bundlers via the `default` condition). Anything published
  here is public API.
- **`src/`** paths named by a `svelte` condition in the `exports` map are public
  API for Svelte-aware tooling. They are stable: a rename in `src/` that breaks
  one of these references is a breaking change.
- **Any other `src/` path** that happens to be included by the glob patterns in
  `files` is implementation detail. We ship it because the Svelte source files
  reference relative neighbors (CSS imports, internal modules, etc.) that the
  consumer's bundler will follow. We do not guarantee its location or shape.

If you find yourself reaching for a `src/` path that is not named in the
`exports` map, file an issue — that path is not supported and may move without
warning.
