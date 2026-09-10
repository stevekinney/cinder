---
'@lostgradient/markdown': minor
---

Export `BUNDLED_LANGUAGE_LOADERS`, the curated per-language dynamic import map behind the markdown pipeline's Shiki highlighter.

It was already the shape this package uses to stay off `shiki/langs` — the default `shiki` entry resolves to `bundle-full.mjs`, which statically references all 253 bundled grammars, so a bundler ships every one of them (~10 MB) no matter which languages a document actually contains. Exporting the map lets a second highlighting surface be built from the same curated set instead of reaching for the full registry, with one list to maintain rather than two that drift.

Additive: no existing export changes shape, and the map remains exhaustive over `BUNDLED_LANGUAGES` by its `Record<BundledLanguage, …>` type.
