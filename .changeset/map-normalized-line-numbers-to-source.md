---
'@lostgradient/editor': patch
---

Fix `generateMarkdownSummary`'s `### Lines X-Y` headings and `generateUnifiedDiff`'s `@@` hunk
headers reporting line numbers computed against the _normalized_ document instead of the caller's
own `state.original`/`state.content` (cinder#1324).

Both functions diff `normalizeDocument(originalContent)` against `normalizeDocument(currentContent)`
rather than the raw inputs, deliberately, so formatting-only differences (blank-line padding, list
markers, CRLF) don't get reported as edits. But `normalizeDocument` also changes the document's
_line count_ — collapsing runs of 3+ blank lines to one, dropping the front-matter/body separator
down to at most one blank line, removing blank lines between tight list items, folding a Setext
heading's underline into its one-line ATX form — so a line index into the normalized text isn't
the same line in the source the caller is holding. Both functions reported the normalized-space
index directly, so any `### Lines` heading or `@@` header past a point where normalization changed
the line count pointed at the wrong line — confirmed reproducible with `git apply --check` against
the raw `original` string, which rejected the patch outright rather than merely disagreeing by an
offset.

A new `buildSourceLineMap` (in `packages/editor`, not `packages/markdown` — this is specific to how
this package's diff-like exports normalize, not a `normalizeDocument()` change) aligns the
normalized document's lines back to the source document's lines the same way the diff itself finds
sameness: matching identical lines in document order (a longest-common-subsequence alignment). A
normalized line that survives verbatim in the source maps to its exact source line; a line
normalization actually rewrote (a collapsed heading, a canonicalized list marker) has no verbatim
match, and interpolates forward from the nearest preceding match instead of freezing on it — a
frozen fallback would report the line _before_ a rewritten line (e.g. the blank line above a
collapsed Setext heading) rather than the rewritten line's own position. The forward interpolation
is itself clamped to the next real match, so a long unmatched run between two closely-spaced matches
can't push the map past where the alignment resumes and produce a decrease. Both `generateUnifiedDiff`
(hunk `originalStart`/`currentStart`) and `generateMarkdownSummary` (`startOriginalLine`/`endOriginalLine`,
mapped independently rather than derived by adding the normalized-space line count to the mapped
start — a collapsed run inside the displayed range makes that arithmetic undercount even after the
start itself is correctly mapped) now report source-space numbers. `normalizeInputs: false` needs
no mapping: the diffed strings already _are_ the (CRLF-folded) source text, so an identity map is
exact rather than an approximation.

A lookup past the end of the mapped range (the "insert after the last line" position both callers
use for a pure trailing addition) extrapolates from the _source_ document's own true line count,
not from the normalized document's line count or the map's last entry. Both matter independently:
clamping to the map's last entry loses the append-past-EOF position entirely (a one-line source
document with a trailing addition reported the addition on line 1, not line 2); anchoring only to
the normalized line count still undercounts when normalization strips trailing source content
_entirely_ rather than collapsing it to a representative line — a 3-line source ending in two blank
lines that normalize away completely produces a 1-line normalized document, and an addition appended
after it needs to land on source line 4, not line 2. `buildSourceLineMap` now tracks the source's own
line count alongside the map for exactly this.

One limitation, stated plainly rather than glossed over: this fixes the reported _line number_, not
universal `git apply` fidelity. The hunk _body_ is still rendered from the normalized documents (by
design — that's what keeps formatting-only differences out of the diff), so a hunk's line count
still describes how many lines its own body shows, not how many raw source lines that region spans.
When a blank-line collapse falls entirely before a hunk's start (the issue's own repro, and the
common case with `contextLines: 0`), the mapped start is exact and `git apply` succeeds. When a
collapse falls _inside_ a hunk's displayed context window (default `contextLines: 3` for
`generateUnifiedDiff`, `2` for `generateMarkdownSummary`), the source-mapped start and the
normalized-space body can still disagree on span, and `git apply` can still reject the patch — this
is a structural consequence of diffing normalized text while reporting source coordinates, not a
gap this fix left unclosed. Reporting the correct _number_ for every line still narrows the
original bug to exactly that structural case.
