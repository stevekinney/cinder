# Packaging contract

This document describes what `@lostgradient/cinder` ships in its npm tarball, how the `exports`
map is resolved by the tooling consumers use, and the two supported ways to pull
in CSS.

## Conditional exports — resolution table

Every component subpath is published with the same conditional shape. The
component JavaScript entry carries `types`, `svelte`, `node`, and `default`
conditions; the CSS sidecar lives behind its own `/styles` subpath:

```jsonc
"./button": {
  "types": "./dist/components/button/index.d.ts",
  "svelte": "./src/components/button/index.ts",
  "node": "./dist/server/components/button/index.js",
  "default": "./dist/components/button/index.js"
},
"./button/styles": {
  "default": "./dist/components/button/button.css"
}
```

Which file a given consumer actually loads depends on the resolver and its
condition set. Resolvers stop at the first condition they match. The table below
captures what wins where.

| Consumer / resolver                             | Subpath                              | Condition matched | File loaded                                |
| ----------------------------------------------- | ------------------------------------ | ----------------- | ------------------------------------------ |
| TypeScript (`moduleResolution: nodenext`)       | `@lostgradient/cinder/button`        | `types`           | `./dist/components/button/index.d.ts`      |
| TypeScript (`moduleResolution: bundler`)        | `@lostgradient/cinder/button`        | `types`           | `./dist/components/button/index.d.ts`      |
| Vite / SvelteKit dev + build                    | `@lostgradient/cinder/button`        | `svelte`          | `./src/components/button/index.ts`         |
| `svelte-package` / Svelte-aware tooling         | `@lostgradient/cinder/button`        | `svelte`          | `./src/components/button/index.ts`         |
| Plain Node SSR                                  | `@lostgradient/cinder/button`        | `node`            | `./dist/server/components/button/index.js` |
| Generic ESM resolver without `svelte` or `node` | `@lostgradient/cinder/button`        | `default`         | `./dist/components/button/index.js`        |
| Any resolver                                    | `@lostgradient/cinder/button/styles` | `default`         | `./dist/components/button/button.css`      |

The `svelte` condition is the public contract for Svelte-aware tooling. Source
paths it names are stable. Any other path under `src/` is implementation detail
and may move at any time. `dist/` is the contract for all non-Svelte tooling
and for every CSS sidecar.

## Styles — automatic component imports plus explicit CSS modes

`@lostgradient/cinder` exposes CSS through dedicated subpaths. Component entry
points automatically load their co-located sidecars. The base entry
(`@lostgradient/cinder/styles`) is a **slim base**: it declares the `@layer`
order and ships tokens, foundation (reset), shared internal chrome, and
utilities, but it **does not** import any per-component CSS. Import the base
once at the application entry, then import components normally; their
browser/Svelte entries pull their own styles. The explicit CSS modes below
remain available when you want to own the stylesheet graph.

### Mode 1 — whole-system aggregator

```ts
// app.css or your global stylesheet entry
import '@lostgradient/cinder/styles/all';
```

`@lostgradient/cinder/styles/all` is the full cascade as shipped. It declares the `@layer`
order and pulls in tokens, foundation (reset), **every** component's CSS, and
utilities — each in its correct layer. Use this when you want the design system
"as shipped" and do not need to tree-shake CSS by component. It ships the entire
component layer regardless of which components your app actually renders.

> [!NOTE] `@lostgradient/cinder/styles` alone is not enough
> `@lostgradient/cinder/styles` is the slim base and intentionally ships **no** per-component
> CSS. You still need to import the component modules you render; in browser/Svelte builds,
> those component entries automatically import their co-located sidecar CSS. The base alone
> does not style a `<Button>`. Use `@lostgradient/cinder/styles/all` when you want every
> component stylesheet up front.

### Explicit mode — à la carte

```ts
// Required: the slim base must come FIRST. It declares the @layer order and
// ships tokens, foundation, utilities, and shared internal chrome.
import '@lostgradient/cinder/styles';

// Optional: import only the component sidecars you choose to manage explicitly.
import '@lostgradient/cinder/button/styles';
import '@lostgradient/cinder/badge/styles';
```

Per-component CSS exports (`@lostgradient/cinder/<name>/styles`) ship **layer-wrapped CSS**.
Every sidecar self-declares its cascade layer — its rules live inside an
intrinsic `@layer cinder.components { … }` wrapper so the layer assignment
survives a direct subpath import. They contain only component-scoped selectors
and `--cinder-*` custom properties; they do **not** ship tokens or resets,
because those come from the base once at the top of the cascade, not duplicated
per component.

This mode lets the bundler tree-shake unused component CSS, but the contract is
strict:

- `@lostgradient/cinder/styles` (the slim base) is **required and must be imported first**.
  Sidecars carry layer _membership_ but not layer _ordering_ — the base declares
  the `@layer` order. If a sidecar lands before the base, the layers are created
  in insertion order and utilities can no longer override component defaults.
  The base is also what defines the `--cinder-*` tokens and resets the sidecars
  reference; without it components have no token definitions and inherit no
  resets.
- Component JS modules (`@lostgradient/cinder/button`, `@lostgradient/cinder/badge`, etc.) pull their
  sidecars automatically in browser and Svelte-aware builds. The explicit `/styles` imports are
  additive and remain available for consumers that intentionally manage CSS themselves.

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
