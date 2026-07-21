---
'@lostgradient/markdown': minor
'@lostgradient/cinder': patch
'@cinder/commentary': patch
---

Publish `@lostgradient/markdown` (Phase 2 of the package-boundaries plan, see
`docs/decisions/package-boundaries.md`). `@cinder/markdown` is renamed to `@lostgradient/markdown`
and absorbs the former `@cinder/diff` package — its word/line-diff engine is now inlined at
`@lostgradient/markdown/diff/line-diff` rather than re-exported from a separate workspace package.
`@cinder/diff` no longer exists. The `@shikijs/engine-oniguruma`, `@shikijs/langs`, and
`@shikijs/types` dependencies move from `@lostgradient/cinder` to `@lostgradient/markdown`, the
package that actually uses them for lazy syntax-highlighter loading — `shiki` itself stays in
both packages. `@lostgradient/cinder`'s `./markdown/*` re-export shims are unaffected; the removed
top-level `./diff` and `./diff/line-diff` cinder aliases (sourced from the now-deleted
`@cinder/diff` package) are gone — `./markdown/diff/line-diff` was already the canonical,
actually-used path for every in-repo consumer. `@cinder/commentary`'s `workspace:*` dependency on
markdown is repointed to the new package name.
