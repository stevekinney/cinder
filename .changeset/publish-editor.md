---
'@lostgradient/editor': minor
'@lostgradient/cinder': minor
---

Publish `@lostgradient/editor` (Phase 3 of the package-boundaries plan, see
`docs/decisions/package-boundaries.md`). `@cinder/commentary` is renamed to `@lostgradient/editor`
and absorbs the ProseMirror/Milkdown half of the former `@cinder/editor` package. Three components
move out of `@lostgradient/cinder` and into this new package: `markdown-editor`, `review-editor`,
and `diff-viewer` — `review-editor` composes the other two, so all three had to move together.

`@lostgradient/cinder`'s `markdown-editor`, `review-editor`, and `diff-viewer` subpaths (and their
`/schema`, `/variables`, `/styles`, `/examples` siblings) are **removed** — this is a breaking
change for any external consumer of those subpaths, hence the minor (not patch) bump on
`@lostgradient/cinder`, which pre-1.0 treats a breaking removal as a minor per semver's own
pre-1.0 carve-out (the same reasoning `@lostgradient/markdown`'s publish used for the removed
`./diff` aliases). Cinder's `./editor`, `./editor/component-runtime`, `./editor/test-utilities`,
and every `./commentary/*` subpath (`anchor-decorations`, `anchoring`, `comments`(+`/types`),
`export`(+`/types`), `session`(+`/types`), `shared/anchor-types`) are unaffected — they now mirror
`@lostgradient/editor`'s headless runtime instead of `@cinder/commentary`'s, with no change to
their public shape. The bare `./commentary` root key (which never resolved to anything anyone in
this repo imports) stays dropped, same as before this move.

We evaluated re-exporting the three Svelte components back through Cinder as generated shims (the
`derive-upstream-reexports.ts` / `CINDER_KEY_OVERRIDES` pattern used for the headless subpaths
above), but that mechanism only understands `.ts` value/type re-exports — `generate-exports.ts`'s
component pipeline requires a component to physically live under
`packages/components/src/components/`, and cannot re-export a compiled `.svelte` file from a
sibling package. A hand-authored shim `.svelte` file was rejected too: it is exactly the kind of
compatibility scaffolding this repo's conventions avoid on a pre-release package, and Phase 5 of
the package-boundaries plan deletes Cinder's remaining shims outright — so a temporary
`markdown-editor`/`review-editor`/`diff-viewer` shim here would be written only to be deleted in
the very next phase. Consumers of these three components should migrate their import specifier
from `@lostgradient/cinder/<component>` to `@lostgradient/editor/<component>` directly.

`@lostgradient/editor`'s peers are `@lostgradient/cinder` (`^0.17.0`), `@lostgradient/markdown`
(`^0.1.0`), `svelte`, and the milkdown/prosemirror stack — all host-supplied singletons. Its only
regular `dependencies` are `@floating-ui/dom` and `esm-env`, matching `@lostgradient/cinder`'s own
treatment of those same two vendored utilities (see `package-boundary.test.ts`): small, stateless
libraries where a duplicate copy across the install graph causes no functional issue, unlike the
singleton-sensitive peers above.
