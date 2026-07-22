---
'@lostgradient/cinder': patch
'@lostgradient/markdown': patch
---

Internal reshuffle: dissolve the private `@cinder/editor` workspace package (Phase 1 of the
package-boundaries plan, see `docs/decisions/package-boundaries.md`). The headless
template-placeholder trio (`sanitize-html.ts`, `template-placeholders.ts`, `template-render.ts`,
`placeholder-security.ts`) moved into `@cinder/markdown`'s new `templates/` directory. The
ProseMirror/Milkdown editor integration moved into `@cinder/commentary`'s new `editor/`
directory. `@lostgradient/cinder`'s published `./editor/*` subpaths are unaffected — the
generated re-export shims now source from the new locations, but the exported symbol sets and
`package.json#exports` entries are byte-identical to before. Pure internal code movement; no
public API change.
