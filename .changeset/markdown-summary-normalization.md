---
'@lostgradient/editor': patch
---

Fix `generateMarkdownSummary` disagreeing with `generateUnifiedDiff` about whether an edit
happened (cinder#1318).

`generateMarkdownSummary` ran `computeLineDiff` directly on the raw `original`/`current`
strings, with no normalization at all — no CRLF handling, no front-matter awareness, no
blank-line collapsing. `generateUnifiedDiff` normalizes both inputs by default
(`normalizeInputs: true`) through `normalizeDocument`, which strips leading blank lines from the
body before re-serializing and reattaches front matter through a single canonical separator. So
two documents whose front matter and body were byte-identical, differing only in how many blank
lines separated the closing `---` from the body (or only in line-ending style), made
`generateUnifiedDiff` report zero hunks ("nothing changed") while `generateMarkdownSummary`
reported a two-line edit — genuinely disagreeing outputs for a `ReviewState` no consumer-visible
edit had touched.

`generateMarkdownSummary` now takes a `normalizeInputs` option, defaulting to `true` to match
`generateUnifiedDiff`'s own default, and normalizes through the same shared `normalizeDocument`
(now factored out of `unified-diff.ts` into `export/normalize-document.ts` so `diffStats`, this
function, and `generateUnifiedDiff` share one implementation — see the cinder#1307 changeset in
this same batch). Pass `normalizeInputs: false` for a byte-for-byte raw comparison, including
CRLF line endings — stricter than `generateUnifiedDiff`'s own `normalizeInputs: false`, which
still folds CRLF to LF even with normalization off (a pre-existing quirk of that function, not a
contract this new option inherits).

This changes `generateMarkdownSummary`'s default output for formatting-only and
blank-line-only edits: they no longer appear in the "Changes Made" section or count toward
`changeCount`, matching what `generateUnifiedDiff` and the diff panel already reported for the
same input. CRLF line endings no longer leak a literal `\r` into the ` ```diff ` code fence.
