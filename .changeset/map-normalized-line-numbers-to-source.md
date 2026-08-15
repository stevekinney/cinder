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

The alignment recognizes a rewritten-but-surviving line by canonicalizing each line through the real
`normalize()` itself — not by re-deriving a second copy of its rewrite rules. That replaced an
earlier version of this fix that hand-coded the recognition one rewrite kind at a time: first a
Setext-fold special case, then a regex canonicalizing unordered list markers (`-`/`*`/`+`) only.
Each of those was a patch on an _instance_ of the same underlying problem — normalization rewrites
a surviving line in the same pass that deletes a genuinely-removed neighboring line (a blank
separator between tight list items, most commonly), and a strict-equality alignment that doesn't
recognize the rewrite treats the surviving line as "unmatched," letting the deletion get
misattributed onto the rewritten line's own position instead. `* one\n\n* old` normalizing to
`- one\n- old` is the shape: without marker recognition, the second item's line number came out as
the deleted blank line's, not `* old`'s own, later line. The unordered-marker patch fixed that one
case; the very next review round found the identical shape one rewrite kind later, with ordered
markers (`1)` → `1.`). Patching per rewrite kind is exactly the "two normalizers drift apart" defect
class `normalizeDocument()`/`splitDocument()` (cinder#1307, cinder#1318) already fixed once, for
front-matter handling — re-deriving a second, hand-maintained notion of "the normalizer's rewrite
rules" here was the same mistake in a different function. Calling the real `normalize()` per line
closes the class instead of the instance for any rewrite a single line can reproduce: every member
of `serializerOptions` (`@lostgradient/markdown`'s `pipeline/serializer.ts`) — `bullet`, `emphasis`,
`rule`, `listItemIndent`, `strong`, `tightDefinitions` — plus every `remark-stringify`/`remark-gfm`
default it doesn't override, notably `bulletOrdered` (`.` vs `)`), which is a _default_, not a
`serializerOptions` entry — exactly why the ordered-marker case was its own review-round finding
rather than falling out of the unordered-marker fix for free, and exactly the kind of gap calling
the real normalizer now closes instead of requiring a fifth round to find. Two `serializerOptions`
members — `fence`/`fences` and `setext` — are exceptions stated plainly rather than glossed over:
their rewrites need multi-line context (a Setext underline folding into the heading above it,
`~~~` becoming a fenced _pair_) that a single isolated line can't reproduce, so they hit a guard
that falls back to the original line instead of risking a false match, leaving those specific cases
exactly as approximate as they were before this fix — not a gap this fix claims to close, and not
untested by omission: it's the same guard the pre-existing Setext test already exercises.

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

Performance note: calling `normalize()` per line adds up to one full parse+serialize per distinct
line in the two documents being mapped (`O(m+n)` in the line counts), on top of the existing
`O(m×n)` LCS table. It's memoized per `buildSourceLineMap` call — most normalized lines are
byte-identical to some source line, so the cache hits constantly in practice — and scoped to that
one call rather than shared across export invocations, so it costs no persistent memory. This runs
only on user-triggered exports (generating a diff or summary), not on every keystroke.
