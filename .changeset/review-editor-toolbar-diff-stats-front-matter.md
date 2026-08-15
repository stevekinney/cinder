---
'@lostgradient/editor': patch
---

Fix ReviewEditor's toolbar change counter over-counting front-matter edits (cinder#1307).

The toolbar's `diffStats` normalized the whole document — front matter and body together —
with `normalize()`, a Markdown pipeline with no front-matter step. Handed `---\ntitle: …\n---`
it read the fences as a thematic break plus a setext heading and re-emitted the closing
underline at the new content's width, so shortening `owner: jane` to `owner: bob` changed the
value line AND (because it no longer recognized the fence) the underline beneath it — one real
edit counted as two modified lines, while the diff panel and `exportUnifiedDiff()` (already
fixed for this in cinder#1285) correctly reported one.

`diffStats` is now computed by `computeReviewEditorDiffStats`, a small function pulled out of
`review-editor-impl.svelte` into its own module so it is testable without mounting the
component (which needs a real browser DOM for Milkdown). It calls the same front-matter-aware
`normalizeDocument` `generateUnifiedDiff` already used, split out of `unified-diff.ts` into
`export/normalize-document.ts` so it has exactly one implementation instead of one per
consumer — see the cinder#1318 changeset in this same batch for the second consumer that fix
reaches.
