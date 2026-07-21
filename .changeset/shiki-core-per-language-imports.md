---
'@lostgradient/cinder': patch
---

Fix the Shiki adapter behind `<CodeBlock>` (`highlighters/shiki`) to build on `shiki/core` + `@shikijs/engine-oniguruma`, resolving languages and themes through `shiki/langs` / `shiki/themes` instead of the default `shiki` barrel, converging on the same pattern `packages/markdown` already uses. This closes a build-time regression risk: cinder's own build (`splitting: false`) previously kept only the bare `shiki` specifier external, so any future `shiki/*` subpath import would have been inlined whole into cinder's published dist (measured at ~10 MB). `scripts/build.ts` now externalizes `shiki/*` and `@shikijs/engine-oniguruma` too. No change to the public `shikiHighlighter()` API, behavior, or supported language/theme set — and no change to what a consumer's own bundler ships, since `shiki` was already external there.
