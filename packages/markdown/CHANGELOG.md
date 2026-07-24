# @lostgradient/markdown

## 0.1.0

### Minor Changes

- [#806](https://github.com/stevekinney/cinder/pull/806) [`1b80249`](https://github.com/stevekinney/cinder/commit/1b802498e71f799ceac44becd67fec73f8b7d74c) Thanks [@stevekinney](https://github.com/stevekinney)! - Publish `@lostgradient/markdown` (Phase 2 of the package-boundaries plan, see
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

### Patch Changes

- [#793](https://github.com/stevekinney/cinder/pull/793) [`62a9a75`](https://github.com/stevekinney/cinder/commit/62a9a75c321303f7f4c8cd8d429fc0d1a071f667) Thanks [@stevekinney](https://github.com/stevekinney)! - Internal reshuffle: dissolve the private `@cinder/editor` workspace package (Phase 1 of the
  package-boundaries plan, see `docs/decisions/package-boundaries.md`). The headless
  template-placeholder trio (`sanitize-html.ts`, `template-placeholders.ts`, `template-render.ts`,
  `placeholder-security.ts`) moved into `@cinder/markdown`'s new `templates/` directory. The
  ProseMirror/Milkdown editor integration moved into `@cinder/commentary`'s new `editor/`
  directory. `@lostgradient/cinder`'s published `./editor/*` subpaths are unaffected — the
  generated re-export shims now source from the new locations, but the exported symbol sets and
  `package.json#exports` entries are byte-identical to before. Pure internal code movement; no
  public API change.
