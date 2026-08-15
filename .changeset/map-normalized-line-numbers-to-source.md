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

**Revision history on the alignment mechanism itself, because it changed twice more after the
initial fix, and the final shape is not what either earlier round shipped.**

Round 1 recognized a rewritten-but-surviving line by exact string match only, with an
interpolation fallback for anything that didn't match verbatim. Rounds 2-3 found that too narrow —
`normalize()` rewrites a surviving line (a collapsed heading, a canonicalized list marker) in the
same pass that deletes a genuinely-removed neighboring line (a blank separator between tight list
items, most commonly), and treating the rewritten line as "unmatched" let the deletion get
misattributed onto its position instead — so those rounds added canonicalization: first a
hand-rolled regex for unordered markers, then (when ordered markers turned out to need the exact
same treatment) calling the real `normalize()` per line instead of re-deriving its rewrite rules by
hand, closing that class of gap by construction for anything a single line can reproduce.

(Numbering note: "Round 1" through "Round 4" here count _shipped revisions to this mechanism_,
which is a narrower count than the PR's own review-round numbering used in its commit messages and
thread comments — this changeset's "Round 4" and the PR's "round 5" are the same event; the
"Round 6" section below is the PR's round 6, and is the first one this changeset's own numbering
and the PR's agree on, since no revision to this mechanism was needed in between.)

**Round 4 (a bot review round after the above shipped) proved that per-line-string approach
categorically unsound, not just incompletely enumerated.** A Setext heading's underline
(`Title\n---`) and a bare thematic break (`***`) are different mdast node types that can both
canonicalize to the identical string `---`. No amount of per-line canonicalization — however
complete its rewrite-rule coverage — can recover which source line a normalized `---` actually came
from once two structurally different nodes produce the same text; comparing strings after
serialization has already thrown away the one piece of information (which node produced the string)
that would disambiguate them. The same round also found that this machinery runs on every content
edit, not just a user-triggered export: `ReviewEditor`'s hidden `formDiff`/`formSummary` inputs are
reactive whenever the component has a `name`, so the per-line `normalize()` calls plus an `O(m×n)`
LCS table ran on every keystroke — a real perf claim this changeset previously stated incorrectly.

**The fix: stop reconstructing the map after the fact by comparing text, and build it from the AST
instead.** `parseOrThrow(source)` and `parseOrThrow(normalized)` (`@lostgradient/markdown/pipeline`)
each produce an mdast tree whose nodes carry their own source positions — the parse already runs as
part of `normalize()` itself, so this is reading positions the parser already computed, not adding
new work. `buildSourceLineMap` walks both trees in lockstep, pairing corresponding nodes by
structural _type_ (the same longest-common-subsequence shape the old string alignment used, now
comparing e.g. `heading` vs `thematicBreak` instead of rendered text) rather than by content, and
recurses into block containers (`root`, `blockquote`, `list`, `listItem`) for finer-grained pairing.
Each paired leaf node contributes an exact anchor — its source and normalized line spans, linearly
interpolated against each other when the spans differ in length (a Setext heading's two source
lines folding into the ATX form's one normalized line, for instance: a single-line normalized span
always resolves to the _start_ of its paired source span). Lines no anchor covers — gaps between
sibling nodes, any leading or trailing blank run — are still filled by forward interpolation
clamped to the next anchor, same as before, just now anchored by node boundaries instead of string
matches. The Setext/thematic-break collision is resolved by construction: `heading` and
`thematicBreak` are never "the same node" regardless of what text they serialize to, so pairing
can't confuse them.

This also settles the performance finding: the standalone `O(m×n)` LCS-over-lines table and the
per-line `normalize()` calls are both gone, replaced by two parses plus one tree walk — no worse
asymptotically, and now exact rather than heuristic. `buildSourceLineMapCached` (used by both
`generateUnifiedDiff` and `generateMarkdownSummary` in place of the raw builder) adds an LRU cache
over `(source, normalized)` pairs, mirroring `@lostgradient/markdown`'s own `normalizeWithCache` —
since only `current` changes on most keystrokes, the `original` side (rebuilt independently by both
functions when their hidden form inputs derive off the same edit) is a cache hit after the first
call. This keeps the exports in the reactive path rather than moving them out of it: native form
submission needs current hidden-input values, so removing the reactivity isn't the fix; making the
repeated computation free is.

**Full-inventory statement, not a claim that stops at "the reviewer stopped finding new cases":**
`normalize()`'s rewrites split into line-rewriting (everything `serialize()` does — `serializerOptions`
plus every `remark-stringify`/`remark-gfm` default) and line-deleting (`normalize()`'s own
post-serialization regex passes — tight-list separator removal, blank-run collapsing, leading/trailing
trim). AST alignment covers every line-rewriting case by construction, since it never compares text
at all, and line-deleting transforms never needed canonicalization in the first place (a surviving
line still matches itself structurally; deletions are what the gap-interpolation fallback is for).
Two genuine, deliberately-accepted limits remain, stated plainly: a node whose position span covers
multiple lines can't be split more finely than that span (a table row, a multi-line paragraph) —
interpolated within, exact at its boundaries; and if `parseOrThrow` ever fails on either document
(not expected, but not guaranteed), alignment degrades to treating the whole document as unanchored
rather than throwing, which is still monotonic and in-range, just fully approximate.

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

**Round 6 (review finding): the AST-pairing fix above traded the old line-based `O(m×n)` table for
a new one, still built unconditionally.** `pairChildrenByType` — the per-container node-type LCS —
built a full `(m+1) x (n+1)` table on every call, even in the single most common case: content
edited _within_ an existing node (typing inside a paragraph, say) changes no top-level node
_types_ at all, so `source` and `normalized` have the identical children-type sequence throughout,
and the table's answer was always going to be a plain diagonal zip.

Fixed by trimming a common _suffix_ first — walking both children arrays backward from their ends,
matching greedily while `nodeKey`s agree — before falling back to the table for whatever's left.
This is provably _exactly_ equivalent to the untrimmed backtrace, not an approximation of it: the
backtrace already starts at `(m, n)` — the very end of both arrays — and its first action every
iteration is an unconditional matching step whenever the trailing types agree, before it ever
consults the DP table. Replaying that same walk directly for the trailing run the table doesn't
need to arbitrate reproduces the identical matches, just without paying for the table cells
underneath it. In the common typing-edit case, this suffix walk alone consumes the entire array
and the table never runs at all.

A mirror-image _prefix_ trim (walking forward from index 0) was considered and rejected: it is
**not** equivalent, because a duplicate type run at the front can make the real backtrace match a
_later_ occurrence of that type than a naive forward walk would pick. Worked counterexample:
`source = [A, A, B]`, `normalized = [A, B]` (types, not literal node kinds). The untrimmed
backtrace matches normalized's lone `A` against source's _second_ `A`, not its first, because by
the time the walk — which starts from the end — reaches index 0, it has already consumed the first
`A` via a different path. A naive prefix trim would match the first `A` instead: a different,
wrong answer, not merely a different-but-equally-valid one, since which specific source node a
normalized line anchors to is exactly what this module exists to get right. Pinned as a regression
test (`source-line-map.test.ts`, `pairChildrenByType suffix-trim optimization`) against an
independent, deliberately-not-imported untrimmed-LCS oracle, across 12 shape-varied and
shape-mismatched cases including this exact one.

Measured, not just asymptotically argued: `pairChildrenByType` called directly on two identical
2000-element type arrays went from ~28.4ms/call (untrimmed) to ~0.083ms/call (trimmed) — roughly
340x. End-to-end, `generateUnifiedDiff` on a 2000-paragraph document with a single paragraph edited
(the `original`-side line map cache warm, as it is after the first keystroke in a real editing
session) went from ~477ms to ~399ms — a real but much smaller ~16% improvement, because parsing,
`normalize()`'s own serialization, and the pre-existing `computeLineChanges` line-diff in
`unified-diff.ts` dominate the total cost at this scale far more than the matcher does
post-fix. The asymptotic fix matters most as documents grow relative to those fixed costs, not as
a claim that the matcher was ever the dominant cost end-to-end — this changeset's earlier
"Performance" framing (in the PR body, not duplicated here) previously implied otherwise and has
been corrected.

This is a pure optimization: its output is identical to the untrimmed version by construction, so
there is no test that fails without it — a timing assertion would be exactly the kind of
threshold-padding this repo's own rules prohibit. Its test coverage is the equivalence check
above, which exists to catch a _future_ regression in the trim's soundness (e.g. someone later
"simplifying" it into the unsound prefix-trim shape), not to prove the optimization currently
exists; that proof is the benchmark numbers above, run manually and reported here and in the PR
thread, not committed as an assertion.
