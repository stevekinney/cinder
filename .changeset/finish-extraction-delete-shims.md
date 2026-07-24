---
'@lostgradient/cinder': minor
'@lostgradient/chat': minor
---

Finish the markdown/editor extraction (Phases 4 and 5 of the package-boundaries plan, see
`docs/decisions/package-boundaries.md`). This is the breaking-change release train that pays off
the whole extraction: `@lostgradient/cinder` no longer exposes `./markdown/*`, `./editor/*`, or
`./commentary/*` at all. Every consumer that used those subpaths must depend on
`@lostgradient/markdown` or `@lostgradient/editor` directly.

## Migration table

| Removed cinder subpath                                                                    | New home                                                                                                                                                                                                                                            |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@lostgradient/cinder/markdown` and every `./markdown/*` subpath                          | `@lostgradient/markdown` (same subpath shape, e.g. `./markdown/pipeline` → `@lostgradient/markdown/pipeline`, `./markdown/diff/line-diff` → `@lostgradient/markdown/diff/line-diff`, `./markdown/rendering*` → `@lostgradient/markdown/rendering*`) |
| `@lostgradient/cinder/editor`, `./editor/component-runtime`, `./editor/test-utilities`    | `@lostgradient/editor/editor`, `@lostgradient/editor/editor/component-runtime`, `@lostgradient/editor/editor/test-utilities`                                                                                                                        |
| `@lostgradient/cinder/editor/sanitize-html`, `/template-placeholders`, `/template-render` | `@lostgradient/markdown/templates/sanitize-html`, `/template-placeholders`, `/template-render`                                                                                                                                                      |
| `@lostgradient/cinder/commentary` (root) and every `./commentary/*` subpath               | `@lostgradient/editor` root barrel and its matching subpath (e.g. `./commentary/anchor-decorations` → `@lostgradient/editor/anchor-decorations`, `./commentary/comments` → `@lostgradient/editor/comments`)                                         |

(`@lostgradient/cinder/diff` and `./diff/line-diff` were already removed in the earlier
`@lostgradient/markdown` publish — see that changeset. `markdown-editor`, `review-editor`, and
`diff-viewer` were already removed from cinder in the `@lostgradient/editor` publish — import
those from `@lostgradient/editor` directly, unchanged by this release.)

## What else changed

- Deleted the generated re-export shim directories `src/markdown/`, `src/editor/`,
  `src/commentary/` and the `derive-upstream-reexports.ts` / `CINDER_KEY_OVERRIDES` machinery that
  generated them. Cinder's `dist/` no longer vendors `@lostgradient/markdown`'s or
  `@lostgradient/editor`'s compiled output at all.
- Two retained cinder files depend on `@lostgradient/markdown` directly now —
  `src/utilities/change-tracker.svelte.ts` and `src/components/json-schema-editor/diff-view.svelte`
  import `@lostgradient/markdown/pipeline` and `@lostgradient/markdown/diff/line-diff`.
  `@lostgradient/markdown` moves from a build-only `devDependency` to a real, published
  `dependencies` entry cinder's consumers install transitively — cinder exposes none of its
  subpaths, but genuinely depends on it now.
- `@lostgradient/editor` is no longer a cinder dependency of any kind (no `devDependency`, no
  runtime dependency) — no retained cinder source imports it.
- Dropped now-orphaned dependencies empirically verified unused by any retained cinder source:
  the full milkdown/prosemirror peer set (`@milkdown/ctx`, `@milkdown/kit`, `@milkdown/prose`,
  `prosemirror-inputrules`, `prosemirror-model`, `prosemirror-state`, `prosemirror-view`), the
  markdown-pipeline dependency stack (`comlink`, `diff-match-patch`, `hast-util-sanitize`,
  `js-yaml` — moved to a scripts-only `devDependency`, still used by workspace tooling that parses
  CI YAML — `rehype-katex`, `rehype-sanitize`, `rehype-stringify`, `remark-gfm`, `remark-math`,
  `remark-parse`, `remark-rehype`, `remark-stringify`, `unified`, `unist-util-visit`,
  `@types/hast`, `@types/mdast`, `@types/unist`), and `@shikijs/langs` (never imported by name in
  cinder's own source — only a transitive dependency of `shiki` itself). `shiki`,
  `@shikijs/engine-oniguruma`, and `@shikijs/types` are KEPT: cinder's own
  `src/highlighters/shiki/index.ts` imports all three directly.
- Cinder's published package weight dropped sharply: 3.81 MB packed / 18.71 MB unpacked / 4,498
  files, down from an 8 MB / 32 MB / 5,500-file budget beforehand.
- Chat's `markdown-preview.svelte` now dynamically imports `@lostgradient/markdown/rendering`
  directly instead of `@lostgradient/cinder/markdown/rendering` — this was the migration
  rehearsal the decision doc called for. `@lostgradient/markdown` joins chat's `peerDependencies`
  (required, not optional — chat always renders through it) and `devDependencies`.
