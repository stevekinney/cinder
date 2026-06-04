# Packaging contract

This document describes what `@lostgradient/cinder` ships in its npm tarball, how the `exports`
map is resolved by the tooling consumers use, and the two supported ways to pull
in CSS.

## Conditional exports — resolution table

Every component subpath is published with the same conditional shape. The
component JS lives behind two conditions; the CSS sidecar lives behind its own
`/styles` subpath:

```jsonc
"./button": {
  "svelte": "./src/components/button/index.ts",
  "types": "./dist/components/button/index.d.ts"
},
"./button/styles": {
  "default": "./dist/components/button/button.css"
}
```

Which file a given consumer actually loads depends on the resolver and its
condition set. Resolvers stop at the first condition they match. The table below
captures what wins where.

| Consumer / resolver                       | Subpath                              | Condition matched | File loaded                           |
| ----------------------------------------- | ------------------------------------ | ----------------- | ------------------------------------- |
| TypeScript (`moduleResolution: nodenext`) | `@lostgradient/cinder/button`        | `types`           | `./dist/components/button/index.d.ts` |
| TypeScript (`moduleResolution: bundler`)  | `@lostgradient/cinder/button`        | `types`           | `./dist/components/button/index.d.ts` |
| Vite / SvelteKit dev + build              | `@lostgradient/cinder/button`        | `svelte`          | `./src/components/button/index.ts`    |
| `svelte-package` / Svelte-aware tooling   | `@lostgradient/cinder/button`        | `svelte`          | `./src/components/button/index.ts`    |
| Any resolver                              | `@lostgradient/cinder/button/styles` | `default`         | `./dist/components/button/button.css` |

The `svelte` condition is the public contract for Svelte-aware tooling. Source
paths it names are stable. Any other path under `src/` is implementation detail
and may move at any time. `dist/` is the contract for all non-Svelte tooling
and for every CSS sidecar.

Consumers using Bun, Node SSR, or a browser bundler without Svelte tooling
will resolve via `types` for typechecking, but the component subpaths do not
currently expose a runtime `node` or `default` JS condition. Track 4 ships
the underlying per-component browser-ESM and SSR builds; wiring those into
the exports map is a follow-up track.

## Styles — two consumption modes

`@lostgradient/cinder` exposes CSS through dedicated subpaths. The base entry (`@lostgradient/cinder/styles`)
is a **slim base**: it declares the `@layer` order and ships tokens, foundation
(reset), shared internal chrome, and utilities, but it **does not** import any
per-component CSS. Renders without component CSS appear unstyled. There are two
supported ways to add the component layer on top of that base.

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
> CSS. A consumer that imports only `@lostgradient/cinder/styles` and renders a `<Button>`
> gets the button **unstyled**. Either import `@lostgradient/cinder/styles/all` (this mode) or
> the slim base plus per-component sidecars (Mode 2).

### Mode 2 — à la carte

```ts
// Required: the slim base must come FIRST. It declares the @layer order and
// ships tokens, foundation, utilities, and shared internal chrome.
import '@lostgradient/cinder/styles';

// Then import only the components you use.
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
- Component JS modules (`@lostgradient/cinder/button`, `@lostgradient/cinder/badge`, etc.) do not pull CSS
  as a side effect. Importing the JS gives you the component; importing
  `@lostgradient/cinder/<name>/styles` gives you its CSS. They are independent.

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
