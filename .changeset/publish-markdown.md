---
'@lostgradient/markdown': minor
'@lostgradient/cinder': minor
'@cinder/commentary': patch
---

Publish `@lostgradient/markdown` (Phase 2 of the package-boundaries plan, see
`docs/decisions/package-boundaries.md`). `@cinder/markdown` is renamed to `@lostgradient/markdown`
and absorbs the former `@cinder/diff` package — its word/line-diff engine is now inlined at
`@lostgradient/markdown/diff/line-diff` rather than re-exported from a separate workspace package.
`@cinder/diff` no longer exists. The `@shikijs/engine-oniguruma` and `@shikijs/types` dependencies
are now shared between `@lostgradient/cinder` and `@lostgradient/markdown` (both import them
directly — cinder's own `./highlighters/shiki` adapter, and markdown's `./rendering` pipeline);
`@shikijs/langs` moves to `@lostgradient/markdown` only, the package that actually uses it for lazy
per-language grammar loading. `shiki` itself stays a direct dependency of both packages.
`@lostgradient/cinder`'s `./markdown/*` re-export shims are unaffected; the top-level `./diff` and
`./diff/line-diff` cinder aliases (sourced from the now-deleted `@cinder/diff` package) are
**removed** — `./markdown/diff/line-diff` was already the canonical, actually-used path for every
in-repo consumer, but this is a breaking change for any external consumer of those aliases, hence
the minor (not patch) bump on `@lostgradient/cinder`, which pre-1.0 treats a breaking removal as a
minor per semver's own pre-1.0 carve-out. `@cinder/commentary`'s `workspace:*` dependency on
markdown is repointed to the new package name.
