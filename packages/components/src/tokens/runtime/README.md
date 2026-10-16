# Token runtime

`@lostgradient/cinder/tokens/runtime` is the pure token kernel. The generator scripts and the browser import the same code, so what the CLI writes into `tokens-base.css` and what the playground evaluates cannot drift apart.

```ts
import {
  CINDER_BASE,
  AUTHORING_CATALOGUE,
  evaluateTheme,
  validateThemeSources,
} from '@lostgradient/cinder/tokens/runtime';
```

It is an in-memory interface. It reads no files, fetches nothing, formats nothing, and imports no Node or Bun module. Loading source from disk, Prettier, and generation stay in `scripts/tokens/`.

## The interface

### `evaluateTheme(sources)`

Validates a theme, evaluates it in all six contexts, and projects each to CSS. `sources` is:

```ts
type ThemeSources = {
  revision: number | string; // echoed on every result and diagnostic
  resolver: unknown; // a DTCG 2025.10 resolver document
  documents: Record<string, unknown>; // token documents keyed by the path the resolver references
};
```

It returns one of two shapes:

```ts
// Success
{
  ok: true,
  revision,
  contexts,       // [{ id: 'light/default', theme: 'light', motion: 'default' }, ...]
  properties,     // context id -> { '--cinder-...': 'css value' }, keys in code-unit order
  diagnostics: [],
  provenance,     // EvaluatedProvenance, below
}

// Failure
{ ok: false, revision, diagnostics }
```

A failure carries no property map and no provenance. The six contexts are `light|dark` crossed with `default|reduced|forced-reduced-motion`; the two forced contexts are computed from source like the others, and the context id is `<theme>/<motion>`.

The property map holds exactly the public `--cinder-*` properties. Private `--_cinder-*` runtime variables and tokens with no `cssProperty` never appear. Values are written in the generated stylesheet's own syntax: a whole-token alias stays `var(--cinder-...)`, a trusted `cssRecipe` is emitted as written, and a typed value is serialized.

### `evaluateThemeProperties(sources, { contexts? })`

The edit-loop path. It validates exactly as `evaluateTheme` does, across all six contexts, so an edit that is invalid in any context is still rejected, but it projects only the requested context ids (default: all six) and traces no provenance. It returns `{ ok, revision, contexts, properties, diagnostics }`; the property maps equal `evaluateTheme`'s for the contexts they share (`evaluate-cache.test.ts` pins that). Provenance is the expensive part of a full evaluation, so a caller that needs only values should use this.

### Remembered validation

Validation results are remembered in module state, so a repeat evaluation only validates what changed. A document that passed is remembered by object identity and the identity of its ordered prefix (a document's validity depends on the documents before it, and on the rest of the stack only through `$extends`, so a stack that uses `$extends` anywhere is never remembered). A context whose ordered documents are all unchanged is not resolved again. Only passes are remembered, and both memos are bounded. The consequence for callers: **do not mutate a source document after passing it in**; replace it with a new object. The theme builder's override trees are already immutable.

### `validateThemeSources(sources)`

Runs the same validation without evaluating, and returns `{ revision, diagnostics }`. An empty list means the sources are valid.

### Diagnostics

```ts
type ThemeDiagnostic = {
  revision: number | string;
  severity: 'error';
  path: string; // a document path, a token path, or '$' for the whole input
  reason: string;
  context?: string; // set when the problem is specific to one context
};
```

Validation is not optional and cannot be split. Every document is checked against the generated standalone DTCG schema validators first and the semantic rules second. The package exports no way to validate against the schema alone, and none to project a document that has not passed both.

These fail before any CSS is projected, each with a path-addressed diagnostic: a value the schema rejects (an invalid `strokeStyle` such as `none` or `hidden`, a malformed composite), a type change that does not hold, a reference to a missing token, an alias or `$extends` cycle, a resolver that orders `motion` before `theme`, and a document the resolver never references.

A color is projected in the space it is authored in: `oklch` and `srgb` as before, and `display-p3`, the other predefined RGB and XYZ spaces (`color(<space> …)`), `lab`, `lch`, `oklab`, `hsl`, and `hwb` as their CSS Color 4 forms. Nothing is converted or clamped on the way to CSS. A value the CSS projection cannot express is a diagnostic as well. For example, a `strokeStyle`, `border`, `transition`, `gradient`, or `typography` token with no `cssRecipe` reports `No direct CSS serialization implemented for token type ...`. Nothing is skipped and nothing falls back to a default.

### Evaluated provenance

`provenance` is `{ revision, contexts, layerStacks, tokens }`. `revision` is the revision of the sources it was computed from, so a consumer can drop a result that no longer matches the current sources. `tokens[contextId]` lists one record per token:

```ts
type TokenEvaluation = {
  path: string;
  provenance: TokenContextProvenance; // winner, ordered layers, effective type and origin, inputs
  dependencies: TokenLocation[]; // tokens it reads directly
  dependents: TokenLocation[]; // tokens that read it, directly or transitively
};
```

`TokenContextProvenance` is the same shape the authoring catalogue stores per token and context. Tokens, dependencies, and dependents all sort by the position of the winning document in the context's layer stack, then by token path, and each token appears once per list. The traversal visits each token once, so it is bounded by the token count.

### Saved themes, and their stylesheet

A saved Cinder Theme v1 envelope (`format: "com.lostgradient.cinder.theme"`) embeds the base it was written against plus five override trees (`shared`, `light`, `dark`, `reduced`, `forcedReduced`) and per-context CSS-only edits.

- `buildThemeSources(envelope, revision)` composes it into `ThemeSources`: each override tree is appended to the resolver's own source lists, so layering stays the resolver's. `OVERRIDE_DOCUMENTS` names where they go.
- `applyCssOnlyOverrides(properties, cssOverrides, context, accept?)` lays CSS-only edits over a context's property map.
- `mergedContextDocument(sources, { theme, motion })` returns the merged source document for one context with aliases, `$extends`, descriptions and extensions intact. Portable DTCG export is built from it.
- `renderThemeStylesheet(maps, { identity? })` writes the six evaluated maps as a complete standalone stylesheet in the `cinder-theme` layer. It uses the generator's selector and media skeleton (`stylesheet-skeleton.ts`, shared with `tokens-base.css`), restates every alias whose input changes in a block (custom properties substitute `var()` where they are declared), and throws `StylesheetError` for a property outside `--cinder-*` or a value that could end a declaration, add a rule or comment, or fetch a resource. The layer order it declares puts `cinder-theme` after every Cinder layer.

`fixtures/tokens-consumer/` proves this through the public subpath only: `bun run --filter=@lostgradient/cinder validate:consumer` runs the browserless check and a Chromium computed-style comparison. The browserless half also runs in the default `test`.

## Data the runtime carries

- `CINDER_BASE`: the immutable Cinder base. `resolver`, `documents` keyed by relative path, `packageVersion`, and `sourceDigest`. A saved theme embeds these so it can tell when the base it was written against has changed. The documents are the package's own source files; the digest is generated and checked by `tokens:check`.
  - `sourceDigest` is `sha256:` over the canonical form of the resolver and documents only. Nothing outside them, the version included, can change it.
  - `packageVersion` is `workspace` inside the monorepo, because the workspace manifest carries no version. The published version is substituted by the mirror transform (`versionConstants` in `scripts/mirror/source.ts`), which rewrites `package-version.generated.ts` to the composed manifest's version when it builds the package. In an installed package it is the real version.
- `computeSourceDigest(source)` recomputes the digest in any environment with Web Crypto (`sha256:<hex>` over the canonical form of `{ resolver, documents }`), and `canonicalJson` is the canonical form.
- `AUTHORING_CATALOGUE`: the generated authoring catalogue, one record per public token with its per-context provenance, usage profile, and edit, CSS-export, and DTCG-portability disposition. `buildAuthoringCatalogue(resolver, documentsByPath)` builds the same catalogue over any in-memory corpus that already passed `validateThemeSources`; it throws on a token no usage profile covers, as the generator does.
- `PROFILES`, `selectProfile`, `profileRangeViolation`: the CSS usage profiles and their numeric ranges.
- `traceProvenance(layers)`, `authoringContexts`, `authoringLayerStack`, `evaluateContextProvenance`: the building blocks `evaluateTheme` uses. They expect sources that already passed `validateThemeSources` and throw raw errors on anything else; `evaluateTheme` is the entry point that turns failures into diagnostics.

- The contrast module (`contrast/`): WCAG relative luminance, unrounded ratios and thresholds (`AA_TEXT`, `NON_TEXT`, `isLargeText`, `requiredContrast`, `meetsContrast`), alpha compositing in gamma-encoded sRGB, the token pairing table (`CONTRAST_PAIRINGS`, each pairing classified as text, large text, non-text indicator, decorative separator or disabled, and scoped to WCAG or to Cinder's stricter advisory floors), a small evaluator for the CSS color syntax the projection emits (`evaluateCssColor`: `oklch()`, `var()`, `light-dark()`, `color-mix(in oklch, ...)`, relative `oklch(from ...)`), and `measurePairing`, which measures one pairing against one context's property map. A gradient, an image, a translucent background with no known backdrop, a missing value or unsupported syntax is reported as `needs-review` and is never given a ratio. Conversions use culori. The Cinder contrast suites and the theme builder's accessibility report read the same table and math.

Each color record carries `palette: { family, role, anchor }`. It comes from the explicit `palette` key in the token's `com.lostgradient.cinder` extension (value-neutral, never inferred from a token name), or is `unknown` when the token declares none. The generator rejects an unknown family, a family without exactly one anchor, a repeated role, a palette on a non-color, and a token that declares different memberships in different contexts.

Presentation grouping and friendly labels are not part of the runtime.

## What stays in `scripts/tokens/`

Reading the token files, the resolver, and the vendored schemas; Prettier; writing `tokens-base.css`, the resolved-context JSON, the registry, `tokens.md`, and this module's generated files; and the `tokens:check` drift gate. Generated here, by `tokens:generate`:

| File                                                                             | Source                                                                                                     |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `format-validator.generated.js`, `resolver-validator.generated.js` (and `.d.ts`) | Standalone Ajv validators for the vendored DTCG 2025.10 schemas. No `eval`, no `new Function`, no imports. |
| `authoring-catalogue.generated.ts`                                               | The authoring catalogue.                                                                                   |
| `base-corpus.generated.ts`                                                       | The source digest of the bundled base.                                                                     |
| `package-version.generated.ts`                                                   | The `workspace` version sentinel the mirror rewrites.                                                      |

## Tests

`theme-runtime.test.ts` is the parity suite. It checks that runtime evaluation, the CLI's generated stylesheet and resolved-context JSON, and the committed catalogue agree for all six contexts, on the bundled base and on the theme-builder fixtures (cross-context recipes, reset, and context precedence included). `applications/playground/src/theme-runtime-bundle.test.ts` bundles this subpath for the browser and checks that nothing from Node, Bun, or Prettier reaches it.
