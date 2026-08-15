---
'@lostgradient/editor': patch
---

Fix `ReviewEditor`'s live toolbar diff badge costing ~30ms per recompute on a realistic large
document — about 1.8x the 16.67ms (60fps) frame budget — by no longer re-normalizing the review
session's fixed `original` baseline on every edit (cinder#1336).

`review-editor-impl.svelte`'s `diffStats` (`const diffStats = $derived.by(() =>
computeReviewEditorDiffStats(original, value))`) recomputes on every settled edit — roughly
2-3x/second while typing, once `MarkdownEditor`'s debounce chain is accounted for. A stage-level
breakdown, measured with `performance.now()` in a real Chromium production build against a
304-line/8,255-word document, attributed >99% of the ~30ms median cost to two calls to
`normalizeDocument` inside `computeReviewEditorDiffStats` — one for `original`, one for `current`
— that were "essentially identical in cost." `original` is a review session's fixed diff baseline:
it only changes if the consumer passes a new `original` prop, yet it was fully re-parsed from
scratch alongside `current` on every single call.

`computeReviewEditorDiffStats` now keeps a small, bounded (8-entry), LRU-evicted cache of
`original -> normalizeDocument(original)`, keyed by value rather than a single slot: the function
is shared, stateless, and has no per-instance identity to key off, and a page can legitimately
host more than one `ReviewEditor` with a different `original` each. A single-slot cache would stay
correct under that interleaving but would hit 0% of the time; the bounded LRU lets an `original` in
active use keep surviving cache pressure from other instances' unrelated `current` recomputations,
while an abandoned instance's entry ages out instead of growing the cache without bound. `current`
is intentionally left unmemoized — it changes on essentially every call, so caching it wouldn't
help and would just add overhead.

Re-measured (Node, against the built `dist` function directly, on a synthetic 428-line/13k-word
document — larger than the issue's own repro, so the absolute numbers move but the relative
comparison holds): median cost dropped ~48%, in line with removing one of two near-identical
normalization passes. Deliberately scoped to the toolbar's live `diffStats` path only —
`generateUnifiedDiff` and `generateMarkdownSummary` share `normalizeDocument` via the same module
but run per export action rather than per edit, and cinder#1336 scoped itself to the per-edit path
for that reason; extending this memoization to those call sites is a separate change, not bundled
here.

This is a performance fix only: `computeReviewEditorDiffStats`'s return value for any given
`(original, current)` pair is unchanged, cache hit or miss.
