---
'@lostgradient/markdown': minor
'@lostgradient/cinder': minor
'@lostgradient/chat': patch
'@cinder/commentary': patch
---

Publish `@lostgradient/markdown` (Phase 2 of the package-boundaries plan, see
`docs/decisions/package-boundaries.md`). `@cinder/markdown` is renamed to `@lostgradient/markdown`
and absorbs the former `@cinder/diff` package — its word/line-diff engine is now inlined at
`@lostgradient/markdown/diff/line-diff` rather than re-exported from a separate workspace package.
`@cinder/diff` no longer exists. `@lostgradient/markdown` now declares `@shikijs/engine-oniguruma`,
`@shikijs/langs`, and `@shikijs/types` as its own runtime dependencies (previously these existed
only as transitive dependencies of `@lostgradient/cinder`, which vendors and re-exports markdown's
compiled output). `@lostgradient/cinder` keeps declaring all three too: `engine-oniguruma` and
`types` because cinder's own `./highlighters/shiki` adapter imports them directly, and `langs`
because cinder's build vendors markdown's `./rendering` pipeline (which lazily loads per-language
grammars from `@shikijs/langs`) into its own published dist under `./markdown/rendering*`. `shiki`
itself stays a direct dependency of both packages, as before.
`@lostgradient/cinder`'s `./markdown/*` re-export shims are unaffected; the top-level `./diff` and
`./diff/line-diff` cinder aliases (sourced from the now-deleted `@cinder/diff` package) are
**removed** — `./markdown/diff/line-diff` was already the canonical, actually-used path for every
in-repo consumer, but this is a breaking change for any external consumer of those aliases, hence
the minor (not patch) bump on `@lostgradient/cinder`, which pre-1.0 treats a breaking removal as a
minor per semver's own pre-1.0 carve-out. `@cinder/commentary`'s `workspace:*` dependency on
markdown is repointed to the new package name. `@lostgradient/chat`'s `peerDependencies` on
`@lostgradient/cinder` widens from `^0.16.0` to `^0.16.0 || ^0.17.0` — cinder's minor bump here
would otherwise leave chat's declared peer range unsatisfied against the version this release
actually produces, per `.changeset/README.md`'s "keep that peer range aligned with the Cinder
version released alongside it" contract.
