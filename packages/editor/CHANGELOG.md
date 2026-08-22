# @lostgradient/editor

## 0.13.0

### Minor Changes

- [#1330](https://github.com/stevekinney/cinder/pull/1330) [`b86a1c9`](https://github.com/stevekinney/cinder/commit/b86a1c97d384b4657aefb85705038696bd3ee314) Thanks [@stevekinney](https://github.com/stevekinney)! - Widen internal peer ranges to follow the coordinated release.

### Patch Changes

- Updated dependencies [[`a002d0b`](https://github.com/stevekinney/cinder/commit/a002d0b504dc926beb9940c47648cff22eb36b13), [`13d1fbc`](https://github.com/stevekinney/cinder/commit/13d1fbc183c7df73ac7405ea599c796ffd11749d), [`d1c146b`](https://github.com/stevekinney/cinder/commit/d1c146bc48c5ee9d395fc379f32f71e8bbe9ddf2)]:
  - @lostgradient/cinder@0.25.0

## 0.12.3

### Patch Changes

- [#1378](https://github.com/stevekinney/cinder/pull/1378) [`c7c0961`](https://github.com/stevekinney/cinder/commit/c7c09610d574bf61c5c7a042d2eeffb1eff6702f) Thanks [@stevekinney](https://github.com/stevekinney)! - Enable npm provenance attestations on the trusted and emergency publish paths.

- Updated dependencies [[`c7c0961`](https://github.com/stevekinney/cinder/commit/c7c09610d574bf61c5c7a042d2eeffb1eff6702f)]:
  - @lostgradient/cinder@0.24.8
  - @lostgradient/markdown@0.3.1

## 0.12.2

### Patch Changes

- [#1353](https://github.com/stevekinney/cinder/pull/1353) [`d98dc65`](https://github.com/stevekinney/cinder/commit/d98dc65a5101720638d69c411cffc977f0ad89f5) Thanks [@stevekinney](https://github.com/stevekinney)! - Keep one-way MarkdownEditor consumers from overwriting a settled user edit while the public change callback is debounced.

- Updated dependencies [[`dc2c6e1`](https://github.com/stevekinney/cinder/commit/dc2c6e131ea12e3c4b3e30099f3ac2cc9475fe0c), [`70b59ba`](https://github.com/stevekinney/cinder/commit/70b59ba53c6e8640a7e103c456d44d36bfd75d64), [`710d400`](https://github.com/stevekinney/cinder/commit/710d40092a975711eed8f8149a64bca2d0ecc035)]:
  - @lostgradient/cinder@0.24.5

## 0.12.1

### Patch Changes

- [#1337](https://github.com/stevekinney/cinder/pull/1337) [`6cf3948`](https://github.com/stevekinney/cinder/commit/6cf3948bf5933a992f0b55667bfe45eef1ebedb7) Thanks [@stevekinney](https://github.com/stevekinney)! - Fix `ReviewEditor`'s live toolbar diff badge costing ~30ms per recompute on a realistic large
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

## 0.12.0

### Minor Changes

- [#1330](https://github.com/stevekinney/cinder/pull/1330) [`b86a1c9`](https://github.com/stevekinney/cinder/commit/b86a1c97d384b4657aefb85705038696bd3ee314) Thanks [@stevekinney](https://github.com/stevekinney)! - Widen internal peer ranges to follow the coordinated release.

  This PR's own `frontmatter-requires-valid-object-yaml` changeset bumps `@lostgradient/markdown`
  0.2.x → 0.3.0 (minor), but both `@lostgradient/editor` and `@lostgradient/chat` still declare
  `peerDependencies: { "@lostgradient/markdown": "^0.2.0" }`. Under semver's 0.x caret rules,
  `^0.2.0` resolves to `>=0.2.0 <0.3.0` and excludes 0.3.0 — a coordinated release publishing
  Markdown 0.3.0 alongside Editor/Chat still declaring `^0.2.0` means a consumer can resolve an
  older Markdown lacking this patch's stricter front-matter parsing entirely (review finding).

  This changeset is generated by `bun run packages/components/scripts/prepare-internal-peer-changesets.ts`
  (committed here rather than left for the release PR to generate on its own, per this campaign's
  DV-2 lesson: a peer-range fix that ships in a follow-up cycle instead of the PR that needed it is
  the mistake this exists to avoid) — it doesn't itself change `peerDependencies` in `package.json`.
  The actual widening happens automatically, later, when `bun run changeset:version` runs
  `reconcile-internal-peers.ts` **after** `changeset version` has bumped `packages/markdown/package.json`'s
  real version: that script reads the post-bump version and sets each dependent's peer range to
  `^<that version>`. Editing `peerDependencies` by hand in this PR instead would set it to `^0.3.0`
  while `packages/markdown/package.json` still reads `0.2.0` (the bump hasn't happened yet at this
  point in the pipeline), which fails `package-boundary.test.ts`'s own
  "keeps Editor's/Chat's Markdown peer range covering the current Markdown version" guards --
  verified by trying exactly that and watching it fail, then reverting.

### Patch Changes

- [#1330](https://github.com/stevekinney/cinder/pull/1330) [`b86a1c9`](https://github.com/stevekinney/cinder/commit/b86a1c97d384b4657aefb85705038696bd3ee314) Thanks [@stevekinney](https://github.com/stevekinney)! - Fix `ReviewEditor`'s front-matter raw-YAML field silently discarding an edit instead of either
  committing it or reporting an error, for input that's syntactically valid YAML but not
  object-shaped (a list or a bare scalar) — a UI consumer this PR's own `@lostgradient/markdown`
  front-matter fix (cinder#1325) exposed by making `parseFrontMatter` stricter without this
  component's raw-YAML commit path keeping up.

  `front-matter-fields.svelte`'s `handleRawInput` gated committing an edit on `validateFrontMatter`,
  which only checks that the input parses as YAML _at all_ — it says "valid" for `- one` (a sequence)
  exactly as readily as for `title: Hello` (a mapping). After cinder#1325, `parseFrontMatter` — the
  actual source of truth for whether something is front-matter data — disagrees for the sequence
  case, returning `hasFrontMatter: false` and `data: null`. `handleRawInput` still committed that
  `null` via `onchange`, which the parent (`review-editor-impl.svelte`'s `handleFrontMatterChange`)
  round-trips through `stringifyFrontMatter(null, ..., { preserveEmptyFrontMatter: true })`, landing
  back on the document's _previous_ (usually empty) front-matter block. The net effect: the textarea
  keeps showing what the user typed, no error appears, and the actual document silently reverts —
  the input was never saved, with nothing to tell the user that happened.

  `handleRawInput` now confirms `parseFrontMatter(...).hasFrontMatter` before committing, in addition
  to `validateFrontMatter`'s syntax check, and surfaces a validation error instead of silently
  discarding the input when the YAML is syntactically valid but not object-shaped. Clearing the field
  back to empty is unaffected — that still hits `parseFrontMatter`'s existing "blank content between
  the delimiters" branch, which reports `hasFrontMatter: true` with `data: null`, the intentional
  "empty front matter" case, not a rejection.

  **Follow-up (review finding): the commit path above still lost a comment-only edit, a different bug
  in the same file.** `@lostgradient/markdown`'s round-6 comment-only-YAML fix (see the
  `@lostgradient/markdown` changeset) means `parseFrontMatter` now correctly reports
  `hasFrontMatter: true` for a block like `# TODO: fill this in` — so the fix above, which gates on
  exactly that boolean, lets it through as intended. But `handleRawInput` then called
  `onchange(parsed.data)`, and `parsed.data` is `null` for comment-only content, indistinguishable
  from the genuinely-empty case `onchange` is also expected to send `null` for. The parent
  (`replaceFrontMatterData`, `review-editor-front-matter.ts`) received only that `null` and collapsed
  the block to a bare `---\n---\n`, discarding whatever the user actually typed — the textarea showed
  no error, so editing `# TODO` to `# DONE` looked like it saved.

  `data` alone can never resolve this: both "recognized front matter with no data" and "genuinely
  empty" produce it. Fixed by threading `parsed.raw` through as a second argument —
  `FrontMatterFieldsProps.onchange` is now `(data, raw?) => void`, `handleFrontMatterChange` forwards
  it, and `replaceFrontMatterData` gained a `raw` parameter: when `data` is null but `raw` is a
  non-blank string, it preserves `raw` verbatim (`` `---\n${raw}\n---\n${body}` ``) instead of falling
  into `stringifyFrontMatter`'s null-data collapse — the same `data === null && raw !== null` pattern
  `combineFrontMatterAndBody` already used elsewhere in this file for the identical reason. Genuinely
  empty input (`raw: null`, or whitespace-only) still collapses correctly; only comment-only content
  changes behavior.

- [#1330](https://github.com/stevekinney/cinder/pull/1330) [`b86a1c9`](https://github.com/stevekinney/cinder/commit/b86a1c97d384b4657aefb85705038696bd3ee314) Thanks [@stevekinney](https://github.com/stevekinney)! - Fix `generateMarkdownSummary`'s `### Lines X-Y` headings and `generateUnifiedDiff`'s `@@` hunk
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

- [#1331](https://github.com/stevekinney/cinder/pull/1331) [`f31d402`](https://github.com/stevekinney/cinder/commit/f31d40249cc4fe6789619daa480e5fceebd346e8) Thanks [@stevekinney](https://github.com/stevekinney)! - Fix `MarkdownEditor.setMarkdown()` permanently disconnecting the one-way `value` sync for consumers like `ReviewEditor` that pass `value` down without `bind:value`, so a later unrelated parent-driven change (e.g. `ReviewEditor.reset()`) never reached the live document again.

  `setMarkdown()` writes its own `$bindable` `value` so a `bind:value` consumer sees an imperative content change immediately, the same as a typed one — that part is correct and unchanged. The bug was that it wrote UNCONDITIONALLY. `ReviewEditor.setMarkdown()` (a one-way `value={editorValue}` consumer, not `bind:value`) writes its own `value` immediately before calling `editorRef.setMarkdown()`, so the two writes land back-to-back in one synchronous script execution. That pairing corrupts, not just races, Svelte's prop machinery for the bindable: writing to its backing derived while it is already `MAYBE_DIRTY` from the parent's own pending write forces the derived `CLEAN` without ever re-executing it, leaving its `WAS_MARKED` propagation flag set. Any later, unrelated parent-driven `value` change then finds that flag already set, and Svelte's own reactivity graph silently stops propagating it to this prop at all — permanently, not just until the next render. `ReviewEditor.reset()` writes `value = original`, but with this bug, `MarkdownEditor`'s own "sync external value changes" effect never re-fires to push that reset into the live ProseMirror document, so `getMarkdown()`, `getAst()`, the rendered DOM, and the undo stack all kept showing the earlier imperative content.

  This was not a debounce race — it reproduced with zero elapsed time between the two calls (and with an added tick of separation) and stayed broken indefinitely afterward, confirmed with a harness mirroring `ReviewEditor`'s actual dual write, swept across a wide range of delays between the two calls.

  Fixed by guarding the write with a read-compare (`if (value !== content) value = content;`) instead of writing unconditionally. The read resolves whatever the parent already wrote through Svelte's ordinary (non-corrupting) path first, since the parent's own write always happens earlier in the same script — so the follow-up write becomes a no-op in exactly the case that used to corrupt the prop, and there is nothing left to force-write. The `bind:value` contract this line exists for is unchanged: the write still happens synchronously, with the caller's literal string, whenever it actually differs.

- Updated dependencies [[`b86a1c9`](https://github.com/stevekinney/cinder/commit/b86a1c97d384b4657aefb85705038696bd3ee314)]:
  - @lostgradient/markdown@0.3.0
  - @lostgradient/cinder@0.24.4

## 0.11.0

### Minor Changes

- [#1327](https://github.com/stevekinney/cinder/pull/1327) [`4f34b76`](https://github.com/stevekinney/cinder/commit/4f34b764190b05be221aec8a0eea789a369eb9af) Thanks [@stevekinney](https://github.com/stevekinney)! - Fix three defects found exercising `ReviewEditor`/`MarkdownEditor` from a standalone consumer app: a keyboard trap inside lists, unreachable comment anchors, and a placeholder that silently never painted.

  Inside a list, Tab was swallowed and silently indented the item instead of moving focus, with no escape — a WCAG 2.1.2 keyboard trap. `[#1285](https://github.com/stevekinney/cinder/issues/1285)`'s Escape-then-Tab release (`TabEscapeLatch` in `keymap-plugin.ts`) never actually reached the key: the commonmark preset's own `listItemKeymap` (and, one node type over, the GFM preset's `tableKeymap`) binds plain Tab/Shift-Tab to sink/lift-list-item and next/prev-table-cell independently of `createEditorKeymap`. Milkdown's `KeymapManager` merges every registered keymap into one ProseMirror plugin, and the preset's handler is registered first, so a successful sink/lift returned `true` and ended the chain before the latch-aware handler ever ran — the latch's own bookkeeping was correct, but it was unreachable in a real editor. Fixed at the merge itself, not the latch: `editor.ts` reconfigures both presets' keymaps so Tab/Shift-Tab are no longer bound there at all, moving list indent/outdent (and table-cell navigation) onto `Mod-]`/`Mod-[` instead, which do not collide with focus movement and cannot be shadowed by the escape latch. Plain Tab/Shift-Tab now always reach `createEditorKeymap`'s own sink/lift-or-move-focus chain, so the existing latch finally governs the key it was written for, in both lists and tables. A review round on this fix caught a second, more severe problem the `Mod-]`/`Mod-[` move introduced: on macOS, `Mod-` maps to Cmd, so `Cmd+]`/`Cmd+[` are the browser's own Back/Forward shortcuts. The presets' own `sinkListItem`/`liftListItem`/cell-navigation commands (still bound to these same shortcuts — the earlier fix only stripped Tab/Shift-Tab from them) return `false`, not `preventDefault()`, whenever they don't apply — sinking the first item in a list, lifting outside a list, or cell-navigating outside a table — so a `false` there was falling through to the browser and silently navigating away from the editor, discarding unsaved work. `createKeymapBindings` (`keymap-plugin.ts`) now binds `Mod-]`/`Mod-[` itself, trying the same sink/lift/cell-nav commands and then unconditionally returning `true`: while the editor has focus, these chords are always consumed and never reach the browser, whether or not list/table navigation had anything to do. This is consumer-visible beyond the original Tab change: `Mod-]`/`Mod-[` now do nothing (rather than navigating the browser) when pressed with focus in the editor but outside any list or table. Fixes [#1302](https://github.com/stevekinney/cinder/issues/1302).

  `ReviewEditor`'s `.comment-anchor` decorations carried only `class` and `data-thread-id` — no `role`, `tabindex`, or `aria-*` — so an anchored comment was invisible to a screen reader and unreachable by keyboard; the only way to open a thread was to click the highlighted span directly. Fixed by giving each decoration `role="mark"` (the correct semantic for "this span of text has an annotation," without implying it is itself interactive) and an `aria-description` naming it as commented text, and by adding a genuine keyboard route — `Ctrl+Alt+ArrowDown`/`ArrowUp` (`Cmd+Option+ArrowDown`/`ArrowUp` on macOS) inside the editor now moves the selection to the next/previous anchored comment in document order and opens its thread, wrapping at the ends. The chord is platform-aware rather than a literal `Ctrl+Alt` on every platform: `Control+Option` is macOS VoiceOver's own modifier prefix, so a literal `Ctrl+Alt` chord would be consumed by VoiceOver before ever reaching the page on a Mac — defeating the one keyboard route this fix gives assistive-technology users, on the one platform where that route matters most. `tabindex` was deliberately rejected: making an inline mark focusable inside a contenteditable surface, one stop per comment, is the fragile route the issue itself warns against — it multiplies the surface's tab stops by comment count and fights ProseMirror's own selection model. `aria-details` pointing at the sidebar's comment id was also rejected: `CommentSidebar` mounts its panel conditionally, so the id an anchor would reference is not reliably present in the DOM, which is exactly the dangling-reference shape axe flags. Verified against the real Chromium accessibility tree (`page.accessibility.snapshot()`/axe-core), not just DOM attribute presence — per the cinder#1292 precedent, an a11y fix proven only by asserting the right strings landed in markup is not proof of anything a screen reader actually does with them. Fixes [#1304](https://github.com/stevekinney/cinder/issues/1304).

  Two further review findings on the [#1304](https://github.com/stevekinney/cinder/issues/1304) fix, both in `review-editor-impl.svelte`. First, the chord's caret navigation (`navigateToAdjacentComment`) already read a thread's position from the anchor plugin's live, per-transaction-mapped state rather than the possibly-stale cached `thread.anchor`, but the popover it opens (`handleSidebarThreadSelect`, reached via the sidebar as well as this chord) computed its screen position from the stale cached anchor directly — so after an edit shifted an anchor, the caret could land correctly while the popover opened beside unrelated text at the anchor's former position. `anchorCoords` now resolves through the same `resolveAnchorSelectionRange` helper the caret path already used, so both agree on the same live position. Second, the chord's focus-scoping guard — added to keep the chord from firing inside the sidebar, a comment composer, or front-matter fields — checked only `editorDom.contains(event.target)`, which excludes a real ancestor: in readonly mode ProseMirror's `contenteditable="false"` removes the editor DOM's own native tab-stop (it was never given an explicit `tabindex`), so a real Tab press lands on `MarkdownEditor`'s outer `.markdown-editor.surface` wrapper instead — the element the editor DOM is mounted inside, i.e. its parent. `editorDom.contains(wrapper)` is false for a parent, so the chord was silently dead for read-only consumers specifically, the audience most likely to rely on a keyboard-only review flow. The guard now also accepts `target.contains(editorDom)`, safe because the wrapper is the only focusable ancestor of the editor DOM and the sidebar/toolbar/composers this guard excludes are never ancestors either way.

  `MarkdownEditor`'s `placeholder` prop was written as an inline `--editor-placeholder` custom property on every render regardless of document state, but the CSS that reads it is gated on an `.is-editor-empty` class an internal decoration plugin is supposed to add — and that plugin, `createLazyProsePlugin` in `milkdown-plugin-runtime.ts`, raced `EditorState.create()`'s one-time snapshot of `prosePluginsCtx`: it registered itself via a dynamic `import()` with no synchronous timer, so Milkdown's own startup sequence usually finished snapshotting the active plugin list before the import resolved, silently dropping the plugin from the live editor. The placeholder therefore never painted on an empty document, in a way that reproduced only some of the time depending on module-loading speed, and looked from the outside like a CSS bug rather than a plugin that was simply never running. Fixed by mirroring Milkdown's own pattern for a genuinely async plugin: register a `createTimer` synchronously and record it into `editorStateTimerCtx` before the async registration begins, so `EditorState.create()` waits for it rather than racing it. `--editor-placeholder` itself remains an unconditional inline property, as it always was — an earlier version of this fix gated it on document emptiness, reasoning a populated document shouldn't carry a dead custom property, but review caught that the gate read a component-level `value` that lags the live document by a debounce window, so it could read "not empty" for a span where the document genuinely was empty, painting the CSS's own fallback text instead of the real placeholder. The property is inert on a populated document either way (the `::before` rule that reads it only paints when the empty-decoration is present), so leaving it unconditional trades a cosmetic non-issue for closing a real, visible one. This package's own happy-dom harness cannot reproduce the race — measured directly, the suite stays green even with the fix reverted, because Bun's dynamic `import()` for an already-loaded module resolves fast enough locally to win the race regardless — so the closing proof is real-browser Playwright against the playground's actual Vite/Chromium module graph, not the happy-dom suite. Fixes [#1306](https://github.com/stevekinney/cinder/issues/1306).

  Minor, not patch: [#1302](https://github.com/stevekinney/cinder/issues/1302) changes default Tab/Shift-Tab behavior inside lists and tables (indent/outdent moves to `Mod-]`/`Mod-[`) and [#1304](https://github.com/stevekinney/cinder/issues/1304) adds new keyboard shortcuts and ARIA attributes to `ReviewEditor` — both are consumer-visible behavior changes, not just internal fixes.

- [#1323](https://github.com/stevekinney/cinder/pull/1323) [`0c4e790`](https://github.com/stevekinney/cinder/commit/0c4e79078d49ad68cdf8666647c5e08ea4a5587c) Thanks [@stevekinney](https://github.com/stevekinney)! - Fix four thread-selection/scroll/popover defects in `ReviewEditor`, all clustered in the sidebar and scroll-to-thread path.

  `scrollToThread(threadId)` called `view.dom.scrollTo(...)`. `view.dom` is the `.ProseMirror` contenteditable, which has no `overflow` in any shipped stylesheet — the ancestor that actually scrolls is `.markdown-editor` — so the call was clamped to 0 and never moved anything, even for a thread genuinely off-screen. The sibling function `scrollAnchorIntoView` a few lines above already scrolled correctly via `anchorElement.scrollIntoView(...)`; `scrollToThread` now delegates to it instead of computing its own (wrong) scroll target. Fixes [#1316](https://github.com/stevekinney/cinder/issues/1316).

  `scrollToThread` given an unknown thread id returned silently — no throw, no return value, nothing observable — indistinguishable from a known id whose anchor happened to already be in view. A caller driving navigation from a deep link, a notification, or a "jump to comment" action had no way to tell a stale id from a real bug in its own code. `scrollToThread` now throws for an unknown id. This is a deliberate departure from this package's mutation methods (`deleteThread`, `deleteComment`, ...), which document a silent no-op on a missing id as intentional — that convention supports declarative UI patterns where a caller doesn't pre-check state before issuing a delete. `scrollToThread` is a one-shot imperative navigation call with no equivalent use case, so failing loudly is the right default. Internal callers already guard on thread existence before calling it. Fixes [#1317](https://github.com/stevekinney/cinder/issues/1317).

  Selecting a thread from the comment sidebar scheduled a ~350ms popover-position timer that was never stored in the component's own cancelable `selectTimeoutId` — so `handleAnchorClick`'s existing cancellation of that timer (guarding exactly this race) was a no-op against it. Selecting a different thread by clicking its document anchor within 350ms of a sidebar click opened the anchor-clicked thread correctly, and then the stale sidebar timer fired anyway ~350ms later and silently reverted the popover back to the thread the user had already left. The timer is now stored where the rest of the component already expected it to be. Fixes [#1319](https://github.com/stevekinney/cinder/issues/1319).

  Re-clicking the sidebar row for the thread that is already open destroyed and recreated its popover, discarding any unsent reply text sitting in `CommentComposer`'s draft state. `ThreadPopover` dismisses via a capture-phase `document` click-outside listener, which runs before the row's own bubble-phase `onclick` — so every sidebar click, including a re-click of the active row, closed the popover before the row's own selection handler ever ran. `ThreadPopover` now accepts an `ignoreClickOutsideRef` that resolves the currently-active sidebar row (scoped per editor instance), so a click on that specific row no longer counts as "outside." Paired with a no-op guard in the sidebar-select handler for re-selecting the already-active thread, so the fix doesn't just avoid destroying the popover — it also stops rescheduling a redundant scroll and reposition for a click that changes nothing. Clicking a _different_ row is unaffected: it still closes the current popover immediately and opens the new one. Fixes [#1320](https://github.com/stevekinney/cinder/issues/1320).

  Minor, not patch: `scrollToThread` throwing on an unknown id is consumer-visible behavior for any caller not already guarding thread existence, and `ThreadPopoverProps` gained a new optional `ignoreClickOutsideRef` prop.

  All four were pinned in `review-editor-threads.svelte.ts` too — an experimental, currently-unwired module whose own docblock asks for behavior fixes to be mirrored there until the component is refactored to use it. [#1316](https://github.com/stevekinney/cinder/issues/1316)/[#1317](https://github.com/stevekinney/cinder/issues/1317) apply directly; [#1320](https://github.com/stevekinney/cinder/issues/1320)'s popover-teardown wiring has no equivalent in that state-only module (there is no `ThreadPopover`/click-outside component to patch), but [#1319](https://github.com/stevekinney/cinder/issues/1319)'s timer-cancellation race is present in this module's own `handleSidebarThreadSelect` and is fixed there too, along with the same follow-up review finding described below.

  Four follow-up fixes from review, in the same area:
  - `handleSidebarThreadSelect` now clears any timer from a _previous_ sidebar selection before scheduling a new one, in both `review-editor-impl.svelte` and its mirrored `review-editor-threads.svelte.ts` copy. Choosing a second thread within the ~350ms delay of a first previously orphaned that first timer instead of cancelling it — a narrower recurrence of the [#1319](https://github.com/stevekinney/cinder/issues/1319) race, this time between two sidebar selections rather than a sidebar selection and an anchor click.
  - The re-select no-op guard now checks that the popover is _actually open_ for the clicked thread (`activeThreadId` **and** `popoverThreadId` both match), not just `activeThreadId`. A guard keyed on `activeThreadId` alone could in principle block a legitimate retry after a failed popover open (e.g. the deferred timer running while the editor view was unmounted). In the live component this specific scenario already self-heals via the separate deep-linking `$effect`, independent of this guard — verified empirically — but the guard is still tightened to match what it was always meant to check.
  - `scrollAnchorIntoView` now escapes `threadId` with `CSS.escape()` before interpolating it into the `[data-thread-id="..."]` attribute selector. `Thread.id` is consumer-supplied and not guaranteed to avoid CSS-meaningful characters; routing `scrollToThread` through this function (the [#1316](https://github.com/stevekinney/cinder/issues/1316) fix) made a pre-existing selector-injection risk reachable from the public, throwing imperative API rather than only from the internal deep-linking effect.

### Patch Changes

- [#1321](https://github.com/stevekinney/cinder/pull/1321) [`e1853df`](https://github.com/stevekinney/cinder/commit/e1853dff365b029e549ad5a65bed8cbfb6a0dee6) Thanks [@stevekinney](https://github.com/stevekinney)! - Fix `generateMarkdownSummary` disagreeing with `generateUnifiedDiff` about whether an edit
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

- [#1322](https://github.com/stevekinney/cinder/pull/1322) [`adfccbb`](https://github.com/stevekinney/cinder/commit/adfccbbda75a01086a268f859fa4642027860306) Thanks [@stevekinney](https://github.com/stevekinney)! - Fix three `ReviewEditor` a11y/state-liveness defects, all found by
  `stevekinney/chatroom`'s `/exercises/review-*` suite carrying them as pinned
  known-bug regression tests.

  `data-ready` was a latch (`editorViewReady`) set true on the inner editor's
  first `onready`/selection-change and never cleared. Switching to the Diff or
  Summary tab destroys the `MarkdownEditor` instance behind the `{#if
activeView === 'editor'}` branch, but `data-ready` kept reporting `"true"`
  with no editor mounted — a consumer that waits on `data-ready` after a view
  switch was acting on an editor that no longer existed. Fixed by deriving the
  reset from `editorRef` itself (which Svelte's own `bind:this` unbinds to
  `undefined` on unmount) rather than from a one-way latch, so `data-ready`
  means "an editor is available right now" and comes back once the editor view
  remounts and finishes initializing. Fixes [#1301](https://github.com/stevekinney/cinder/issues/1301).

  Two of the three view tabs (`Diff`, `Summary`) always pointed `aria-controls`
  at a panel id that was not in the document, because the view area renders
  exactly one panel via an `{#if}`/`{:else if}`/`{:else}` chain — the inactive
  views' panels are removed entirely, not hidden. A screen reader following the
  tab-to-panel relationship on an inactive tab found nothing. Fixed by only
  passing `controls` to the ACTIVE segment; the inactive tabs now claim no
  panel at all instead of a dangling one, which axe's `aria-valid-attr-value`
  rule (every IDREF-valued ARIA attribute must resolve) confirms is clean.
  Fixes [#1303](https://github.com/stevekinney/cinder/issues/1303).

  The thread popover declared `role="dialog" aria-modal="true"` while nothing
  outside it — `.review-editor-main`, the comment sidebar — was made `inert` or
  `aria-hidden`, and the component's own F6 landmark navigation deliberately
  moves focus OUT of the popover into `.review-editor-main` while it stays
  open. `aria-modal="true"` is a promise that everything outside the dialog is
  unavailable; this popover never kept that promise, and F6 proves it was never
  meant to. Chose to drop `aria-modal="true"` (rather than making the popover
  genuinely modal by adding `inert` to the surrounding regions and removing
  F6) because F6-out-without-closing is the popover's actual, intended
  behavior — an anchored, non-modal comment popover, the same pattern as
  Google Docs or a GitHub PR review thread, not a page-blocking dialog. The
  existing Tab-trap-within-the-popover and Escape-to-restore behavior needed no
  change either way and are unaffected. Fixes [#1305](https://github.com/stevekinney/cinder/issues/1305).

  Review follow-up on [#1305](https://github.com/stevekinney/cinder/issues/1305): the thread popover's anchor only exists in the
  editor view, so leaving it (Diff/Summary) unmounts `editorRef` — the same
  unbind [#1301](https://github.com/stevekinney/cinder/issues/1301)'s fix relies on. That turned F6's `customFocusHandler` for the
  `'editor'` region into a no-op (`editorRef?.getView()?.focus()` on a null
  ref) that still returned `true`, suppressing the region navigator's fallback
  and stranding focus inside a popover pointing at content that was no longer
  rendered — precisely the failure mode dropping `aria-modal` was supposed to
  keep escapable. Fixed by closing the thread popover in the same
  "left the editor view" branch that already clears the (separate) selection
  popover for the same reason.

  That popover-close, in turn, unmounts `ThreadPopover`, and its own focus trap
  unconditionally restores focus on deactivate — even when the SAME
  interaction that triggered the close (arrow-key roving-tabindex on the view
  switcher) had already moved focus to the newly active tab a moment earlier
  in the same call stack, stealing it back to the trap's `restoreFallback`
  (the sidebar toggle). Corrected by re-asserting focus on the active tab
  after `tick()`, once the trap's own restore has had its say — there is no
  reactive hook into the trap's restore decision from the outside, so this
  corrects the result rather than preventing the race.

  Verified against the real Chromium accessibility tree (via the CDP
  `Accessibility` domain), not just DOM attribute presence, for all three:
  `role="textbox"` appearing/disappearing on the ProseMirror node in step with
  `data-ready` ([#1301](https://github.com/stevekinney/cinder/issues/1301), an implicit ARIA role from `contenteditable` with no DOM
  attribute to assert on directly), an `aria-valid-attr-value` axe pass on the
  tablist ([#1303](https://github.com/stevekinney/cinder/issues/1303)), and the computed `modal` AX property on the popover node
  ([#1305](https://github.com/stevekinney/cinder/issues/1305)) — the same category of gap that made cinder#1292's first fix attempt
  wrong until it was checked against the computed tree instead of attribute
  presence alone.

- [#1321](https://github.com/stevekinney/cinder/pull/1321) [`e1853df`](https://github.com/stevekinney/cinder/commit/e1853dff365b029e549ad5a65bed8cbfb6a0dee6) Thanks [@stevekinney](https://github.com/stevekinney)! - Fix ReviewEditor's toolbar change counter over-counting front-matter edits (cinder#1307).

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

  The same fix also reaches `createReviewEditorState` (`@lostgradient/editor/review-editor`'s
  exported state-manager factory): it had its own copy of the same bare-`normalize()` `diffStats`
  computation, a second public API path that disagreed with the fixed toolbar about the same
  content until it was routed through `computeReviewEditorDiffStats` too.

## 0.10.0

### Minor Changes

- [#1311](https://github.com/stevekinney/cinder/pull/1311) [`7dcc81c`](https://github.com/stevekinney/cinder/commit/7dcc81cbce38220b3ed0ff20729d083aeeb06b2c) Thanks [@stevekinney](https://github.com/stevekinney)! - Fix two multi-instance defects in `DiffViewer`, found building a standalone `/exercises/diff-viewer` route with more than one instance on a page.

  `DiffToolbar` hardcoded `id="diff-view-mode"` on every instance instead of deriving one per instance. `SegmentedControl` derives its label element's id as `${id}-label` from whatever id it's given, so with more than one `DiffViewer` rendering its default toolbar, every instance produced the identical `id="diff-view-mode"` / `id="diff-view-mode-label"` pair. `getElementById` resolves only the first match in the document, so `aria-labelledby` on every instance after the first pointed at the FIRST instance's label — a screen-reader user opening the second or third viewer's view-mode radiogroup was announced the first viewer's label, not its own. Fixed by deriving the id from `$props.id()` (with an optional `id` prop for a consumer to override), matching the rest of the package's id-generation convention — the same convention `diff-viewer.svelte` already used for its front-matter block, just never extended to the toolbar. Fixes [#1309](https://github.com/stevekinney/cinder/issues/1309).

  `DiffViewer` also bound its `]` / `[` / `Ctrl+Shift+D` shortcuts with a bare `<svelte:window onkeydown>`, guarded only against typing into a form field. With more than one `DiffViewer` on a page, every instance's listener fired on the same keystroke regardless of which one — if any — had focus: pressing `]` with focus on the page body, or on a button inside one viewer's own toolbar, advanced every viewer on the page at once. Fixed by moving the listener onto the component's own root element instead of `window`: a `keydown` only reaches an element listener when the event's target is that element or one of its descendants, and DOM focus is exclusive to a single element in the whole document, so at most one `DiffViewer` instance can ever react to a given keystroke. This is a genuine behavior change, not just a bug fix — with a single `DiffViewer` on a page, the shortcuts previously worked with focus anywhere on the page, including the body; they now require focus somewhere inside that instance first (e.g. a toolbar button). Fixes [#1310](https://github.com/stevekinney/cinder/issues/1310).

  Minor, not patch: the id `DiffToolbar` renders is no longer the literal `"diff-view-mode"` (a selector-contract change for any consumer querying it directly, as chatroom's own exercise suite did), and the keyboard-shortcut scoping change is consumer-visible behavior even on a page with a single `DiffViewer`.

  Also documents, in this package's README, that `DiffViewer`'s `toolbar` snippet prop is intentionally total replacement (unlike `@lostgradient/chat`'s `renderDefault`-based row/part overrides) — a judgement call recorded rather than a defect, with no code change attached.

## 0.9.3

### Patch Changes

- [#1296](https://github.com/stevekinney/cinder/pull/1296) [`885f92a`](https://github.com/stevekinney/cinder/commit/885f92a672145d08f9ea4ba5c7e2fadfc9e85769) Thanks [@stevekinney](https://github.com/stevekinney)! - Make `snapshotMode` actually suppress the selection in the editor content, which it never did in any engine.

  The rule was authored as `[data-snapshot-mode] *`, and inside a Svelte `<style>` a bare `*` compiles to `:where(.svelte-…)` — so the descendant half could only match elements the component itself rendered. `.milkdown` and `.ProseMirror` are created at runtime by Milkdown with no scope class, so it never applied to them. Chromium looked correct only because Blink inherits `user-select`, which css-ui-4 defines as non-inherited and Gecko implements as such; Firefox reporting `auto` there is the spec-correct value, and is what surfaced this.

  `:global(*)` alone is not the whole fix. A real drag inside a snapshot-mode editor selected and repainted in **both** Chromium and Firefox even where `user-select` computed to `none`, because ProseMirror's contenteditable stays selectable regardless. A transparent `::selection` is what makes the surface pixel-stable, which is what the prop documents.

  Fixes [#1298](https://github.com/stevekinney/cinder/issues/1298).

- [#1296](https://github.com/stevekinney/cinder/pull/1296) [`885f92a`](https://github.com/stevekinney/cinder/commit/885f92a672145d08f9ea4ba5c7e2fadfc9e85769) Thanks [@stevekinney](https://github.com/stevekinney)! - Make the comment composer's inline submit button clickable in WebKit, where it did nothing at all.

  The button is revealed by `:focus-within` on its container, which also flips it from `pointer-events: none` to `auto`. WebKit does not focus a `<button>` on mousedown — so mid-gesture the textarea blurred, `:focus-within` dropped, `pointer-events` returned to `none` before mouseup, and the mouseup hit-tested to the textarea instead. Per spec the `click` then retargeted to the nearest common ancestor, the wrapper `<div>`, so the button never saw a click and the form never submitted. In Safari the composer's primary affordance was dead and the only working path was the undiscoverable Cmd+Enter.

  Worth stating because it decides where the fix belongs: the engine behavior is benign on its own. A minimal page with no component code submits an ungated textarea+button form identically in all three engines; only the `:focus-within` gate breaks it, and only in WebKit. The stylesheet is what turned a spec-legal engine behavior into a broken control.

  Fixed by suppressing mousedown's default focus change on the submit, so the textarea keeps focus for the whole gesture and `:focus-within` never drops. Not fixed by keeping `pointer-events: auto` while `opacity: 0`, which would leave an invisible click target over the textarea. `CommentComposer` is shared, so this covers the inline composer, the thread popover, and the selection popover.

  Fixes [#1295](https://github.com/stevekinney/cinder/issues/1295).

## 0.9.2

### Patch Changes

- [#1293](https://github.com/stevekinney/cinder/pull/1293) [`5bd476a`](https://github.com/stevekinney/cinder/commit/5bd476a74c1f04bf76e4689268d2256ee490dc58) Thanks [@stevekinney](https://github.com/stevekinney)! - Give `createFocusTrap` a `restoreFallback`, so closing an overlay whose opener has been removed no longer drops focus on `<body>`.

  The trap captured the focused element on activation and handed it to `restoreFocusTo` on deactivation. That helper correctly refuses to focus a disconnected node — and its return value was discarded, so when the control that opened the overlay had been removed in the meantime, nothing else happened and focus landed nowhere. A screen reader says nothing; a keyboard user's next Tab restarts at the top of the document.

  The reachable instance is `ReviewEditor`'s thread popover: deleting a thread from inside its own popover removes the sidebar item the popover was opened from, so the restore target is gone by the time the trap runs. It only bites a consumer that actually applies `onthreaddelete`, which is why notification-only demos never showed it — their sidebar item survives the delete.

  `restoreFallback` is consulted only when restoring to the captured element fails, so supplying it can never override a restore that would have worked, and it is resolved against the document rather than the trap root because a restore target lives outside the trap by definition and the trap's own node is usually already detached by then. A restore now also counts as successful only when focus actually lands: `restoreFocusTo` reports success whenever `.focus()` did not throw, which is equally true of a still-connected element that has since become `disabled` or `inert`.

  A companion `preferRestoreFallback` covers the asynchronous case. A consumer whose delete handler waits on a server keeps the opener mounted while the request is in flight, so restoration finds it perfectly focusable, hands focus back, and then watches it unmount — landing on `<body>` after all. `ThreadPopover` sets it once a delete has been requested. It reorders the candidates rather than discarding one, so a missing fallback still falls through to the captured element.

  `ReviewEditor` points the popover at that editor instance's comments-sidebar toggle — always mounted, always focusable, adjacent to the work, and its label announces the changed comment count. The toggle gained an `id` so the target can be resolved with `getElementById` rather than an attribute selector: the editor `id` is consumer-supplied and only has to be a valid HTML id, so it may contain `"` or `\`, which would make an interpolated selector invalid and fail silently — back to `<body>`.

  Fixes [#1291](https://github.com/stevekinney/cinder/issues/1291).

- [#1293](https://github.com/stevekinney/cinder/pull/1293) [`5bd476a`](https://github.com/stevekinney/cinder/commit/5bd476a74c1f04bf76e4689268d2256ee490dc58) Thanks [@stevekinney](https://github.com/stevekinney)! - Convey `readonly` to assistive technology in the WYSIWYG editor, which previously announced a read-only document as an ordinary editable text box.

  `setEditorReadonly` set ProseMirror's `editable` prop, giving the node `contenteditable="false"`. That stops edits but does not convey read-only-ness: Chromium still computed the resulting textbox as `readonly=false, settable=true` — the same state an editable editor reports. So a screen reader announced an editable field, and typing into it did nothing and said nothing.

  The same component already got this right in source mode, where the `<textarea>` carries the native `readonly` attribute. Switching an editor between its two view modes should not change whether a user is told the document is read-only.

  The state is now mirrored onto `view.dom` as `aria-readonly`, alongside the `aria-label` that is applied there for the same reason. That placement is not incidental: measured with CDP `Accessibility.getFullAXTree`, `aria-readonly` on the wrapping `role="application"` host changes nothing, because the textbox role lives on the ProseMirror node and ARIA states do not inherit down to it.

  Fixes [#1292](https://github.com/stevekinney/cinder/issues/1292).

- Updated dependencies [[`5bd476a`](https://github.com/stevekinney/cinder/commit/5bd476a74c1f04bf76e4689268d2256ee490dc58)]:
  - @lostgradient/cinder@0.24.3

## 0.9.1

### Patch Changes

- [#1289](https://github.com/stevekinney/cinder/pull/1289) [`3c41f9e`](https://github.com/stevekinney/cinder/commit/3c41f9e3c985cc40878de7d920cff7fa34ae1f35) Thanks [@stevekinney](https://github.com/stevekinney)! - Use Milkdown's live selection payload for selection-change notifications so review anchors and toolbar state do not lag one transaction behind.

## 0.9.0

### Minor Changes

- [#1285](https://github.com/stevekinney/cinder/pull/1285) [`bfcd9ed`](https://github.com/stevekinney/cinder/commit/bfcd9ed490ebfb19ed9c1f14c9c7032bef5efdee) Thanks [@stevekinney](https://github.com/stevekinney)! - Keep a comment when its anchored text is cut, stop trapping Tab inside lists,
  fix front-matter diffs, and make soft comment deletion work.

  **Cutting and pasting commented text no longer destroys the comment**
  (cinder#1284). Re-anchoring is debounced 300ms, and deletion is indistinguishable
  from a cut at the moment the text disappears — so a person who cut a commented
  paragraph and pasted it back a second later lost the comment, with no undo.
  `AnchorStatus` gains `'orphaned'`: a vanished quote now marks the anchor orphaned
  and KEEPS the thread, rendering no decoration and retrying on every later pass, so
  restoring the text restores the anchor. The comment sidebar marks such threads and
  says their quoted text is missing. Removing a thread is now the consumer's
  decision — the component no longer does it on the user's behalf, and
  `onAnchorDeleted` is deprecated and never called.

  **Tab is no longer a keyboard trap inside list items** (WCAG 2.1.2). Tabbing in
  put the caret at the end of the document; if that block was a list item, the
  sink/lift keymap consumed both Tab and Shift+Tab, so the only way out was to keep
  re-indenting the bullet. Tab still indents inside a list, but there is now an
  escape.

  **`generateUnifiedDiff` no longer corrupts YAML front matter.** `normalize()`
  re-read the `---` fences as a thematic break plus a setext heading, injecting
  8-dash lines and wrong hunk headers and producing a patch `git apply` rejects —
  through `exportUnifiedDiff()`, the `<name>-diff` hidden input, and the Copy Diff
  menu item, while the docs promise git-appliable output. Front matter is parsed
  off, only the body is normalized, and the front matter is re-attached verbatim.

  **`deleteComment` no longer silently no-ops on the event the component emits.**
  It bailed when a soft delete omitted `deletedAt`, but `CommentDeleteEvent` has no
  such field, so the obvious wiring typechecked and did nothing — after the
  component had already announced "Comment deleted". The reducer now stamps the
  timestamp itself; an explicit `deletedAt` still wins.

  **The editor's loading placeholder is no longer visible text.** `EditorSkeleton`
  hid it with a bare `sr-only` class that Cinder does not ship, so "Loading
  editor..." rendered as body copy during load and permanently without JavaScript.

### Patch Changes

- [#1285](https://github.com/stevekinney/cinder/pull/1285) [`bfcd9ed`](https://github.com/stevekinney/cinder/commit/bfcd9ed490ebfb19ed9c1f14c9c7032bef5efdee) Thanks [@stevekinney](https://github.com/stevekinney)! - Align the exported `createAnchorManager` with the orphan-preservation contract.

  `AnchorStatus` gained an `orphaned` member so a thread whose quoted text goes
  missing is kept and retried rather than destroyed — deletion and cut-and-paste
  are indistinguishable at the moment the text disappears. The inline ReviewEditor
  implementation was updated for that; the separately exported
  `createAnchorManager` (`@lostgradient/editor/review-editor`) was not, leaving one
  shipped path that still deleted the thread and fired `onthreaddelete`. Restoring
  a saved review against a document whose text had since changed silently lost
  those comments.

  Re-anchoring there now keeps every thread: a missing quote yields a collapsed
  `orphaned` anchor that renders nothing and re-anchors if the text returns.

  Two related gaps in the same function are fixed with it. Document-level anchors
  now short-circuit before the quote search, since an empty quote can never be
  "found" and they were being deleted despite not being lost. And a quote that
  resolves in the text but whose offsets do not map back to positions now orphans
  the thread instead of dropping it silently, with no event at all.

  `AnchorManagerOptions.onthreaddelete` is removed rather than left in place. It
  reported a deletion that no longer happens, so it would never fire, and a
  consumer wiring cleanup to an event that never arrives has no way to notice.
  The manager also now propagates `status` in both directions. `handleAnchorsUpdate`
  copies the plugin's reported status onto the thread, so an anchor orphaned during
  live editing actually reaches consumers instead of continuing to read `anchored`
  while the plugin has already stopped decorating it. And the sync fingerprint
  includes `status`, so a thread that flips between anchored and orphaned without
  moving still re-syncs to the plugin.

- [#1285](https://github.com/stevekinney/cinder/pull/1285) [`bfcd9ed`](https://github.com/stevekinney/cinder/commit/bfcd9ed490ebfb19ed9c1f14c9c7032bef5efdee) Thanks [@stevekinney](https://github.com/stevekinney)! - Keep a restored orphan's disambiguation offset, so a recovered comment reattaches
  to the occurrence it was written against.

  `anchor.lastKnownOffset` is the proximity hint re-anchoring uses to choose
  between repeated occurrences of the same quote. When the surrounding context is
  identical (a repeated checklist row, boilerplate, near-identical table entries),
  context scoring ties and that offset is the only thing left to break it.

  `toRuntimeThreads`/`setState` restore a persisted anchor at the unplaced `0`/`0`
  sentinel while keeping the saved offset: the range says "nowhere", the offset
  says where the quote used to live. For an orphaned thread that offset is the
  whole record of its location, and the first document edit after the restore was
  throwing it away. Mapping the sentinel yields position 0, which was written back
  as the new hint, so re-anchoring then measured proximity from the top of the
  document. Restore a review, type the deleted sentence back where it belonged, and
  the comment reappeared on the FIRST copy of that sentence instead of yours.

  The hint is now preserved while an orphan is still unplaced, through both the
  collapsed-range path and the drifted path a new top-of-document paragraph takes.
  An anchor that collapsed at a real position during the session keeps updating its
  offset as before, so a hint that legitimately tracks the document still moves
  with it.

- [#1285](https://github.com/stevekinney/cinder/pull/1285) [`bfcd9ed`](https://github.com/stevekinney/cinder/commit/bfcd9ed490ebfb19ed9c1f14c9c7032bef5efdee) Thanks [@stevekinney](https://github.com/stevekinney)! - Stop inventing a last-known position for orphans that never recorded one.

  `lastKnownOffset` is optional on a persisted anchor, so a review saved before it
  was recorded genuinely has no offset. `generateCommentsJSON` read it as
  `lastKnownOffset ?? 0`, which was harmless while that number only ever fed
  `selection` on a thread whose quote was still in the document — a consumer that
  distrusted the offset could search for the quote. Once such a state loads as
  `orphaned`, the same `0` is exported as `lastKnownSelection`, and it now asserts
  that the missing text was last seen at the very start of the document. Nothing
  supports the claim and nothing can contradict it, because the quote is by
  definition no longer there to search for; a JSON consumer following it applies
  the feedback to whatever the document opens with.

  `lastKnownSelection` is therefore omitted entirely when the anchor carries no
  offset, which leaves the absence consumers already handle for document-level
  threads. `status: 'orphaned'` is still emitted either way, so the thread remains
  identifiable as one whose text is gone — losing that would be worse than the
  invented number. When `lastKnownOffset` is missing but `originalPosition` is
  present, its `offset` is used instead: it is a real historical offset in the same
  `doc.textBetween()` space, and is the fallback re-anchoring itself uses. That
  also settles a contradiction, since those exports previously paired `from: 0`
  with the original position's own `line` and `column`.

  Anchored threads are untouched, and an orphan that does carry a
  `lastKnownOffset` still exports `lastKnownSelection` as before. The Markdown
  export and the summary were already honest here — the former prints an offset
  only when one exists, and the latter prints no coordinates at all — so only the
  JSON export changes.

- [#1285](https://github.com/stevekinney/cinder/pull/1285) [`bfcd9ed`](https://github.com/stevekinney/cinder/commit/bfcd9ed490ebfb19ed9c1f14c9c7032bef5efdee) Thanks [@stevekinney](https://github.com/stevekinney)! - Tell comment exports apart from the document they no longer describe.

  A thread whose quoted text goes missing is now kept and marked `orphaned`
  instead of being deleted. Orphans consequently reach code that never used to see
  them, and the comment exports were the worst place for that: they described an
  orphaned thread as an ordinary text selection. `generateCommentsJSON` built
  `selection.from`/`selection.to` out of the stale `lastKnownOffset`, the Markdown
  export headed the thread `Comment at Line 12:4` and printed `*Position: Line 12,
Column 4*`, and the summary wrote `### On "the quoted text"` as though that text
  were still there. All three were byte-identical to a healthy thread. Copy
  Comments output, form summaries, and JSON consumers therefore had no way to know
  the anchor was lost, and applying the feedback at those coordinates lands it on
  whatever occupies that position now.

  The comments stay in every format, because the feedback is still worth reading.
  What changes is that the positional claim is withdrawn:
  - JSON emits `status: 'orphaned'` and moves the stale offsets from `selection` to
    `lastKnownSelection`. Dropping `selection` is deliberate: document-level
    threads already have none, so consumers branch on its absence today and orphans
    reuse a path they must already handle rather than a new one they would have to
    learn.
  - The Markdown export heads the thread "Comment on text no longer in the
    document" and replaces the position line with "This text was not found in the
    current document. Last known position: ...", so the coordinates read as
    history.
  - The summary appends `(no longer in the document)` to the quote heading. It
    carries no line numbers, so the bare quote was its only misleading signal.

  Anchored threads are untouched, byte for byte. `status` is emitted only when it
  is not `anchored`, so an absent `status` still means what it has always meant.

- [#1285](https://github.com/stevekinney/cinder/pull/1285) [`bfcd9ed`](https://github.com/stevekinney/cinder/commit/bfcd9ed490ebfb19ed9c1f14c9c7032bef5efdee) Thanks [@stevekinney](https://github.com/stevekinney)! - Stop the Escape-then-Tab focus escape from outliving focus. Pressing Escape inside a list arms a
  one-shot latch that lets the next Tab leave the editor (WCAG 2.1.2), and the latch was validated
  only against editor state. Leaving the editor and returning to the same caret applies no
  ProseMirror transaction, so the document and selection still looked untouched and the latch stayed
  armed indefinitely: press Escape to dismiss a menu, click away, click back, then press Tab meaning
  "indent this bullet" and focus is thrown out of the editor instead. The latch now clears when focus
  leaves the editable surface. Escape immediately followed by Tab still escapes, and a Tab with no
  Escape before it still indents.

## 0.8.1

### Patch Changes

- [#1281](https://github.com/stevekinney/cinder/pull/1281) [`5bd00b1`](https://github.com/stevekinney/cinder/commit/5bd00b14ef77e4d224ccc576df29c16433db6193) Thanks [@stevekinney](https://github.com/stevekinney)! - Stop a mis-seeded anchor from being cemented at the wrong text, warn about one in
  dev, and prefer Svelte source exports during SvelteKit SSR.

  **A seeded anchor whose range overlapped its own quote was adopted, not corrected**
  ([#1275](https://github.com/stevekinney/cinder/issues/1275)). Flagging an anchor for re-anchoring only schedules work 300ms out, and
  Milkdown's `syncHeadingIdPlugin` stamps `id` attributes onto every heading inside
  that window. Its step spans the whole heading, so `didTransactionAffectAnchorRange`
  was true and the "follow the edit" branch overwrote the anchor's `quote` with
  whatever text sat at the bad range. The anchor then looked internally consistent,
  the deferred pass skipped it, and `{from: 2, to: 14}` for `Release Plan` rendered
  `elease Plan` permanently — while the identical mistake in a paragraph, which that
  transaction does not touch, repaired correctly. That branch is now gated on the
  anchor having verifiably described its own text before the transaction.

  **Nothing told a consumer their coordinates were wrong.** A dev-only warning now
  fires the first time the plugin sees a thread whose range does not describe its
  quote, naming the three coordinate spaces involved. It is scoped to threads the
  plugin has not tracked before, which keeps it off ordinary editing drift.

  **ReviewEditor emitted a `hydration_mismatch` on every SSR load** ([#1277](https://github.com/stevekinney/cinder/issues/1277)). The
  package listed `node` before `svelte` in the conditional exports for
  `./markdown-editor`, `./review-editor` and `./diff-viewer`. Conditional exports
  resolve to the first matching key and SvelteKit SSR activates both, so the server
  loaded the precompiled `dist/server` bundle while the browser compiled the same
  components from source — two independent compilations of one page, disagreeing on
  hydration anchor comments. This is the same defect fixed for `@lostgradient/chat`
  and `@lostgradient/cinder`; editor was missed by that sweep. The order is corrected
  in the source manifest and in `pack-for-publish`, and pinned by an invariant over
  every conditional export rather than a per-subpath list.

## 0.8.0

### Minor Changes

- [`8c3065a`](https://github.com/stevekinney/cinder/commit/8c3065a5889811bc3315e3a7fcbfa1bfc816b62c) Thanks [@stevekinney](https://github.com/stevekinney)! - Add `toRuntimeThreads`, the documented inverse of `toPersistedThreads`, so a saved `ReviewState` can be bound straight to ReviewEditor's `threads` prop without casting through `unknown`. It seeds `from`/`to` with a neutral unplaced sentinel and lets the anchor plugin place each thread by its quote. Both converters now preserve `anchor.type`, which fixes document-level threads being silently deleted when restored via `setState`. Anchor coordinate spaces are documented on the `threads` prop, and the `with-comments` example now seeds real ProseMirror positions instead of raw-Markdown indices.

### Patch Changes

- Updated dependencies [[`8c3065a`](https://github.com/stevekinney/cinder/commit/8c3065a5889811bc3315e3a7fcbfa1bfc816b62c)]:
  - @lostgradient/cinder@0.24.2

## 0.7.0

### Minor Changes

- [#1266](https://github.com/stevekinney/cinder/pull/1266) [`fca6dee`](https://github.com/stevekinney/cinder/commit/fca6deecda88bef233a982b8fe1eb12755aef940) Thanks [@stevekinney](https://github.com/stevekinney)! - Fix ReviewEditor's seeded-thread anchoring, wire the documented thread
  auto-delete, expose the imperative surface, and collapse the editor view's
  stacked toolbars into one row.

  Found by exercising the published package as a consumer would — rendering
  `ReviewEditor` with persisted `threads` already in the prop, which is the most
  common way an app loads a saved review.

  **Seeded threads highlighted the entire document.** Milkdown sets the initial
  document with a single step spanning the whole doc. Anchors present at that
  moment were mapped through it, so `map(from, -1)` collapsed to 0 and
  `map(to, 1)` expanded to the document end, and every seeded thread decorated
  every block. The mapping's "follow the edit" branch then overwrote the anchor's
  `quote` with the entire document text without raising `needsReanchor`, so
  deferred re-anchoring never ran and the only data that could have recovered the
  anchor was gone. A wholesale replacement now bypasses position mapping entirely
  and defers to re-anchoring, which locates anchors by quote.

  Syncing threads into the plugin also verifies each anchor against the document
  instead of trusting its `from`/`to`, and raises re-anchoring for any that do not
  check out. `from`/`to` are ProseMirror positions — not raw-Markdown indices and
  not `doc.textBetween()` offsets, which sit in the same object as
  `lastKnownOffset` — and no prop documentation said so, so seeded anchors were
  routinely in the wrong coordinate space with nothing to signal it.

  **Threads whose anchor text was deleted were never removed.** `comments/types.ts`
  documents that threads have no "orphaned" state because "When anchor text is
  deleted, threads are automatically removed". The plugin detected the condition
  and called `onAnchorDeleted`, but ReviewEditor constructed the plugin without
  that handler. The decoration vanished while the thread stayed in the bindable
  `threads` array pointing at text that no longer existed, and `onthreaddelete`
  never fired. The handler is now wired.

  **The imperative surface was unreachable.** The implementation exports ~22
  instance methods, but the public wrapper rendered it without `bind:this` and
  re-exported nothing, so `bind:this` on `<ReviewEditor>` produced a component
  with no methods — putting the whole `getState`/`setState` persistence
  round-trip out of reach from the published entry point. The wrapper now forwards
  them.

  **Announcements rendered as visible text.** `LiveRegion` hid itself with
  `class="sr-only"`; Cinder ships `.cinder-sr-only`, a bare `.sr-only` is defined
  nowhere, and the component has no `<style>` block of its own.

  **The comments toggle's `aria-controls` never resolved.** It derived the
  sidebar's id from its own (`{id}-controls`), advertising
  `{id}-controls-sidebar` while the sidebar is `{id}-sidebar`. The id is now
  passed in explicitly.

  **The editor view stacked two toolbars.** The diff view already passes
  DiffViewer an empty toolbar snippet ("controls are in the unified bar above")
  and the summary view passes `showToolbar={false}`, but the editor view passed
  neither — costing ~90px of chrome before any document content. The formatting
  controls now render inside the unified bar, halving that to ~41px.

  To make that possible, `MarkdownEditor` gains `ontoolbarcontextchange`, and
  `ToolbarContext` now also carries `onUndo`, `onRedo`, `onLinkClick`, and
  `linkPopoverOpen`. Both are additive. The handlers close a real gap: the
  documented `toolbar` snippet claims to replace the default toolbar, but without
  them a caller could not reproduce undo, redo, or the link popover.

  The unified bar's `role` changes from `toolbar` to `group`. It contains a
  `tablist` — never a valid child of `toolbar` — and now the editor's own
  `toolbar`, and a `toolbar` may not nest inside a `toolbar`. A labelled `group`
  describes what the bar is and keeps its children valid.

### Patch Changes

- Updated dependencies [[`c89a8b8`](https://github.com/stevekinney/cinder/commit/c89a8b88b62349baadeaf205546dcc3cca139613)]:
  - @lostgradient/cinder@0.24.1

## 0.6.0

### Minor Changes

- Widen internal peer ranges to follow the coordinated release.

### Patch Changes

- Updated dependencies [[`d13d4cd`](https://github.com/stevekinney/cinder/commit/d13d4cd39bea7b3024793ea8996021b2c8eafc68), [`b0583e2`](https://github.com/stevekinney/cinder/commit/b0583e2e0a44a3757000167ac4cc4171f5a7473b)]:
  - @lostgradient/cinder@0.24.0

## 0.5.0

### Minor Changes

- Widen internal peer ranges to follow the coordinated release.

### Patch Changes

- Updated dependencies [[`0db00f8`](https://github.com/stevekinney/cinder/commit/0db00f891e94ab9c9c4776af1608654b03003de0), [`649a5ee`](https://github.com/stevekinney/cinder/commit/649a5eea8056501f009aeee2b7f32e52ed67c595)]:
  - @lostgradient/cinder@0.23.0

## 0.4.0

### Minor Changes

- [#1232](https://github.com/stevekinney/cinder/pull/1232) [`539d240`](https://github.com/stevekinney/cinder/commit/539d240ac2a752136a95f09ff3e2b94111e969a4) Thanks [@stevekinney](https://github.com/stevekinney)! - Add unified-diff copy to DiffViewer and move secondary MarkdownEditor formatting controls into a labeled overflow popover so editor toolbars never wrap.

### Patch Changes

- Updated dependencies [[`8069fc5`](https://github.com/stevekinney/cinder/commit/8069fc5cf551a7cea8481136703e3dbb10d9db05), [`8069fc5`](https://github.com/stevekinney/cinder/commit/8069fc5cf551a7cea8481136703e3dbb10d9db05), [`539d240`](https://github.com/stevekinney/cinder/commit/539d240ac2a752136a95f09ff3e2b94111e969a4), [`539d240`](https://github.com/stevekinney/cinder/commit/539d240ac2a752136a95f09ff3e2b94111e969a4), [`8069fc5`](https://github.com/stevekinney/cinder/commit/8069fc5cf551a7cea8481136703e3dbb10d9db05), [`28113fc`](https://github.com/stevekinney/cinder/commit/28113fcceb35150ece09325bcf627bf0931e9871), [`3641205`](https://github.com/stevekinney/cinder/commit/3641205ff964173a7c2913b77f8511e94fb0896d), [`8069fc5`](https://github.com/stevekinney/cinder/commit/8069fc5cf551a7cea8481136703e3dbb10d9db05), [`8069fc5`](https://github.com/stevekinney/cinder/commit/8069fc5cf551a7cea8481136703e3dbb10d9db05), [`539d240`](https://github.com/stevekinney/cinder/commit/539d240ac2a752136a95f09ff3e2b94111e969a4), [`8069fc5`](https://github.com/stevekinney/cinder/commit/8069fc5cf551a7cea8481136703e3dbb10d9db05), [`8069fc5`](https://github.com/stevekinney/cinder/commit/8069fc5cf551a7cea8481136703e3dbb10d9db05), [`8069fc5`](https://github.com/stevekinney/cinder/commit/8069fc5cf551a7cea8481136703e3dbb10d9db05)]:
  - @lostgradient/cinder@0.22.0

## 0.3.0

### Minor Changes

- [#1222](https://github.com/stevekinney/cinder/pull/1222) [`e86d40e`](https://github.com/stevekinney/cinder/commit/e86d40e79d0b313feeabd85f33b1dc6dded942a3) Thanks [@stevekinney](https://github.com/stevekinney)! - Widen Editor's and Chat's peer ranges to the Cinder and Markdown minors releasing
  alongside them: `@lostgradient/cinder` `^0.20.0` → `^0.21.0`, and
  `@lostgradient/markdown` `^0.1.0` → `^0.2.0`.

  Without this the release ships Editor and Chat declaring peer ranges that exclude
  the very Cinder and Markdown versions published in the same batch — `^0.1.0`
  resolves to `>=0.1.0 <0.2.0` under semver's 0.x rule, so Markdown 0.2.0 falls
  outside it, and every consumer installing the set together gets an unmet-peer
  error. This is a coordinated minor across all four packages, which is also what
  the package-boundary tests' `pendingCoordinatedMinorRelease` escape expects.

### Patch Changes

- Updated dependencies [[`bf6eeb9`](https://github.com/stevekinney/cinder/commit/bf6eeb9e6c287f360c6ed4fe9a0ded7a909e4b8a), [`bf6eeb9`](https://github.com/stevekinney/cinder/commit/bf6eeb9e6c287f360c6ed4fe9a0ded7a909e4b8a), [`bf6eeb9`](https://github.com/stevekinney/cinder/commit/bf6eeb9e6c287f360c6ed4fe9a0ded7a909e4b8a), [`bf6eeb9`](https://github.com/stevekinney/cinder/commit/bf6eeb9e6c287f360c6ed4fe9a0ded7a909e4b8a), [`06ffb18`](https://github.com/stevekinney/cinder/commit/06ffb181cf73c2984613f93571b037dd721c7734), [`61bcfbc`](https://github.com/stevekinney/cinder/commit/61bcfbce232427b03b7d11ae552c134800d026a4), [`68370b1`](https://github.com/stevekinney/cinder/commit/68370b1d5ac2046855a77f95db36f316eaafa35a), [`38a43a0`](https://github.com/stevekinney/cinder/commit/38a43a0cccf557aafbaee2a39486a050a2979854), [`0fb8912`](https://github.com/stevekinney/cinder/commit/0fb891210be26c2675de870beb931d9f39cdff4c), [`4531af8`](https://github.com/stevekinney/cinder/commit/4531af81295cec74f50a20b33fa45492ee037bc4)]:
  - @lostgradient/cinder@0.21.0
  - @lostgradient/markdown@0.2.0

## 0.2.0

### Minor Changes

- [#1001](https://github.com/stevekinney/cinder/pull/1001) [`7f924e1`](https://github.com/stevekinney/cinder/commit/7f924e1c3f4eca10530606d14bf6c8778f998455) Thanks [@stevekinney](https://github.com/stevekinney)! - Standardize component prop API vocabulary across handlers, bindable values,
  boolean props, polymorphic `as` props, and component names. This removes
  `defaultValue` public props in favor of bindable `value`, splits value
  interceptors to `onValueChangeRequest`, renames lowercase custom callbacks to
  camelCase notification props, and adds an AST guard that prevents these
  conventions from drifting.

### Patch Changes

- [#1112](https://github.com/stevekinney/cinder/pull/1112) [`cdd0215`](https://github.com/stevekinney/cinder/commit/cdd0215ae3f843c5d0ebf665a3791400ebc904d6) Thanks [@stevekinney](https://github.com/stevekinney)! - Document the distinct ownership boundaries for editor and Cinder diff viewers plus Cinder and Chat message surfaces.

- [#1022](https://github.com/stevekinney/cinder/pull/1022) [`6bd8d76`](https://github.com/stevekinney/cinder/commit/6bd8d76074bf471898a476bde91041a7cc9ca047) Thanks [@stevekinney](https://github.com/stevekinney)! - Use a directional chevron icon for MenuBar submenu indicators.

- [#972](https://github.com/stevekinney/cinder/pull/972) [`7b9be9d`](https://github.com/stevekinney/cinder/commit/7b9be9d9d76024df7af698f96e760c725af2dd9a) Thanks [@stevekinney](https://github.com/stevekinney)! - Strengthen light and dark surface hierarchy, standardize form-control fills, and enforce muted interior dividers with stylelint guardrails.

- Updated dependencies [[`9faa142`](https://github.com/stevekinney/cinder/commit/9faa1422658ceddac3b758e313be3c2d6696bada), [`7ab0910`](https://github.com/stevekinney/cinder/commit/7ab091009749ccaf39b24ce3548b7374c2353e92), [`67f51a7`](https://github.com/stevekinney/cinder/commit/67f51a73a603d04f1858050a60abfed793a0a178), [`899801b`](https://github.com/stevekinney/cinder/commit/899801bdb9192e0b62799c184b74681fbfb72136), [`dca8fbf`](https://github.com/stevekinney/cinder/commit/dca8fbfd7fb5fad5cb429e346e5f13e9af789518), [`92d17da`](https://github.com/stevekinney/cinder/commit/92d17da743f17902a87645cd5c92b8b0ce35e4c4), [`a1f1880`](https://github.com/stevekinney/cinder/commit/a1f1880703e0e0f941b4a348555f009af9630796), [`8ea6973`](https://github.com/stevekinney/cinder/commit/8ea69733a09812ee81ace349d4289e3011ad07b2), [`91eb73c`](https://github.com/stevekinney/cinder/commit/91eb73c6a336e652b7033f75a1c27d051c18a4de), [`cf18ed7`](https://github.com/stevekinney/cinder/commit/cf18ed74fd31ebc90b2a06fa36a7c2588b529e92), [`7f6de70`](https://github.com/stevekinney/cinder/commit/7f6de7056bbfe347aa7b7fe019efaea8bc06c6f0), [`76c3da6`](https://github.com/stevekinney/cinder/commit/76c3da6ccc1356dfa0687129fe1b3bfb40f7a4ce), [`4766190`](https://github.com/stevekinney/cinder/commit/47661907620f26eb61f50b3592c73c013b94e6ea), [`6983b8e`](https://github.com/stevekinney/cinder/commit/6983b8e8c00a05e948ff0f02abe4d50c6c7e0a30), [`c58514f`](https://github.com/stevekinney/cinder/commit/c58514f6c636695e795c93867f508a896ec9aa32), [`5ff29c6`](https://github.com/stevekinney/cinder/commit/5ff29c6acdd8040e09b613f1cb05cccea2713c24), [`c5d2235`](https://github.com/stevekinney/cinder/commit/c5d22353105f1ea52cefc8ad34a1e348342094f7), [`fca6b6a`](https://github.com/stevekinney/cinder/commit/fca6b6a3c9aa212c84f37cf15d63a1962c37eeef), [`761cd8e`](https://github.com/stevekinney/cinder/commit/761cd8e9ea529866a32e0496699917822c20b1c1), [`16671d8`](https://github.com/stevekinney/cinder/commit/16671d86f9b467ddae8f9aee5b36ed1d0d662d84), [`6418308`](https://github.com/stevekinney/cinder/commit/641830824c085af3cb50e24075bbebef75d99f78), [`115705d`](https://github.com/stevekinney/cinder/commit/115705d23092b7663d3045a07327b04b2e77d1fc), [`6bffc7d`](https://github.com/stevekinney/cinder/commit/6bffc7d07e6c7d390a6f111bc85f396201fc36e0), [`abce2be`](https://github.com/stevekinney/cinder/commit/abce2bedbef200211a2aa1f19b8643949cb0291f), [`b22ee52`](https://github.com/stevekinney/cinder/commit/b22ee527c2cab50b2eec851e0b8991316d8a0d21), [`05f9d06`](https://github.com/stevekinney/cinder/commit/05f9d0632018b8ba8c2cdfd5c1ad9bcaa149820c), [`7ec4689`](https://github.com/stevekinney/cinder/commit/7ec46892c9d467f932fe32086a6e47312a48b107), [`1fb92e0`](https://github.com/stevekinney/cinder/commit/1fb92e05faf5660103124a8520aaa31443286746), [`1a9b577`](https://github.com/stevekinney/cinder/commit/1a9b5779c07023ca263d8a34f0365307d00129af), [`e1a27b8`](https://github.com/stevekinney/cinder/commit/e1a27b82c650fc8efe71598227e9afad94cb2188), [`898dcda`](https://github.com/stevekinney/cinder/commit/898dcda4009d7d7c21b51ad35c2c7e549f568fdd), [`cdd0215`](https://github.com/stevekinney/cinder/commit/cdd0215ae3f843c5d0ebf665a3791400ebc904d6), [`76759d3`](https://github.com/stevekinney/cinder/commit/76759d3175b26b664d345e803c7ec5431516aa51), [`81f7b91`](https://github.com/stevekinney/cinder/commit/81f7b91c8c8e80be88a058f47bb3547fd716abd2), [`e113c49`](https://github.com/stevekinney/cinder/commit/e113c49dd2206e1893c0ba970d0f182fbdf0b20c), [`323399a`](https://github.com/stevekinney/cinder/commit/323399ab5e8bbbb7f2118d5163bb607db71340b8), [`6130fbb`](https://github.com/stevekinney/cinder/commit/6130fbbb97181e26df63e080a070567f5d964c8b), [`b12595e`](https://github.com/stevekinney/cinder/commit/b12595e2a16db3d497fcbb5a831db95a9ac84187), [`a1b532b`](https://github.com/stevekinney/cinder/commit/a1b532b827a6304c249eb32e3d1b226d31c2b602), [`5ff75da`](https://github.com/stevekinney/cinder/commit/5ff75da61a812351849333db0f51abef4ac71896), [`b26c1b4`](https://github.com/stevekinney/cinder/commit/b26c1b4089030a0b995fe66339df376634af5c7a), [`490098c`](https://github.com/stevekinney/cinder/commit/490098c0d8647bae9e51177ac6e1017456ec73a2), [`74a58e6`](https://github.com/stevekinney/cinder/commit/74a58e6cc68f7b5db632090f80e0f81a7d62c66b), [`5bf2b09`](https://github.com/stevekinney/cinder/commit/5bf2b09d59b62dc7cd61b01aafd076c5133977ca), [`dc90b46`](https://github.com/stevekinney/cinder/commit/dc90b4675e59f263ea6ee402e5375ec01fa9620b), [`4a279a2`](https://github.com/stevekinney/cinder/commit/4a279a28b9423559e6e33fe5123696a275ea2006), [`b12595e`](https://github.com/stevekinney/cinder/commit/b12595e2a16db3d497fcbb5a831db95a9ac84187), [`44e11a5`](https://github.com/stevekinney/cinder/commit/44e11a52cd1b1169dc2dd075964114aa32f318d4), [`2b92897`](https://github.com/stevekinney/cinder/commit/2b92897a03395096d185d6545435fb2554bbd0f7), [`d4a63dc`](https://github.com/stevekinney/cinder/commit/d4a63dcf0d40d9f6dae52962a8a30e6893c1675d), [`06d7002`](https://github.com/stevekinney/cinder/commit/06d7002e9a0356dd922eb236772e06789a978b6f), [`b33f757`](https://github.com/stevekinney/cinder/commit/b33f7575e87f1226f603f2e122fae3942a3d349f), [`6166a73`](https://github.com/stevekinney/cinder/commit/6166a73d90e71745d4357a2a0d3a536d327b10a7), [`e81880b`](https://github.com/stevekinney/cinder/commit/e81880b47717b07fb83830faee4ee91204d16727), [`876c600`](https://github.com/stevekinney/cinder/commit/876c60083dc674b648f47c99aeff59d62e15b4aa), [`6bd8d76`](https://github.com/stevekinney/cinder/commit/6bd8d76074bf471898a476bde91041a7cc9ca047), [`41fdd11`](https://github.com/stevekinney/cinder/commit/41fdd11644884db69b7cffe8ee9bf1b1921d8974), [`40bd219`](https://github.com/stevekinney/cinder/commit/40bd219c80a4411f81d82a2105f477c1554a45dd), [`412f275`](https://github.com/stevekinney/cinder/commit/412f27521e7f339c5e62649c3980eeb355f38cd7), [`f5d2ec6`](https://github.com/stevekinney/cinder/commit/f5d2ec62a878282f9faa10c9c3d67819b77f7213), [`a96c5c0`](https://github.com/stevekinney/cinder/commit/a96c5c09fd5ef025d79d97006bd6ea0b71a78db3), [`462b85b`](https://github.com/stevekinney/cinder/commit/462b85b8cad5859bbcd97c86428fc10d839aa255), [`a39d748`](https://github.com/stevekinney/cinder/commit/a39d74892a06cae40f13aa663f0d250598cc094b), [`2dc6c75`](https://github.com/stevekinney/cinder/commit/2dc6c75fcbb74a87d8fc179ca4f16c24b93055f6), [`2dc6c75`](https://github.com/stevekinney/cinder/commit/2dc6c75fcbb74a87d8fc179ca4f16c24b93055f6), [`2dc6c75`](https://github.com/stevekinney/cinder/commit/2dc6c75fcbb74a87d8fc179ca4f16c24b93055f6), [`2dc6c75`](https://github.com/stevekinney/cinder/commit/2dc6c75fcbb74a87d8fc179ca4f16c24b93055f6), [`2dc6c75`](https://github.com/stevekinney/cinder/commit/2dc6c75fcbb74a87d8fc179ca4f16c24b93055f6), [`2dc6c75`](https://github.com/stevekinney/cinder/commit/2dc6c75fcbb74a87d8fc179ca4f16c24b93055f6), [`2dc6c75`](https://github.com/stevekinney/cinder/commit/2dc6c75fcbb74a87d8fc179ca4f16c24b93055f6), [`2dc6c75`](https://github.com/stevekinney/cinder/commit/2dc6c75fcbb74a87d8fc179ca4f16c24b93055f6), [`7d069b6`](https://github.com/stevekinney/cinder/commit/7d069b6cac6287737fa7623c8e8b3e99249e1ea8), [`dbcc986`](https://github.com/stevekinney/cinder/commit/dbcc986919d2bddb3dd4e3bda0c2089699595dfc), [`925a0fc`](https://github.com/stevekinney/cinder/commit/925a0fc905c80ec6663f22d908d31ad7d3fdbe9a), [`3897000`](https://github.com/stevekinney/cinder/commit/389700023af97651b11ff4bf1d21962a935a76ba), [`034413c`](https://github.com/stevekinney/cinder/commit/034413cf9591d1c31ad439349cab6d0bbed6df5a), [`7f924e1`](https://github.com/stevekinney/cinder/commit/7f924e1c3f4eca10530606d14bf6c8778f998455), [`d99561f`](https://github.com/stevekinney/cinder/commit/d99561fe37c49ef4791109e220d242cde11b67db), [`e7e92ad`](https://github.com/stevekinney/cinder/commit/e7e92ad8d59b11864bb10a5f915afc5ddacfc192), [`42262d1`](https://github.com/stevekinney/cinder/commit/42262d1f7378ce6c85dc4ac60123991fee0004a1), [`4c6455c`](https://github.com/stevekinney/cinder/commit/4c6455c84e97cce49a2e2defd8f823e2903e8a0f), [`f621c7e`](https://github.com/stevekinney/cinder/commit/f621c7e0fd98dd76982575c5e55ae901018bcb55), [`277503a`](https://github.com/stevekinney/cinder/commit/277503a78d7b3cdad23a6b3b10ad4b7ea4a1415d), [`3b3685f`](https://github.com/stevekinney/cinder/commit/3b3685f63ca518a6006a5212c78c837b2e4ba91f), [`fad8c3f`](https://github.com/stevekinney/cinder/commit/fad8c3f7a5a618534c71b413a82db7d88f290c0f), [`928ce6a`](https://github.com/stevekinney/cinder/commit/928ce6a3e26a0a101f1cb7a8b6a94d6708a88ab9), [`057b1ee`](https://github.com/stevekinney/cinder/commit/057b1ee1d0a1f82eed05e682565fc8d7d6f9745a), [`cfc7fa8`](https://github.com/stevekinney/cinder/commit/cfc7fa80cfa2e21150830c7f66d68b78da37f99e), [`09ab845`](https://github.com/stevekinney/cinder/commit/09ab8459df15bcdbddec2737e0f98bafb1c2f796), [`4aa510d`](https://github.com/stevekinney/cinder/commit/4aa510d7a59382a53c1344ba79df43313b91fde9), [`4fe3131`](https://github.com/stevekinney/cinder/commit/4fe313159e6ee88d13ec6a10a15acb5347c00bbe), [`a73801c`](https://github.com/stevekinney/cinder/commit/a73801c4ffc5d651e358b9e36fea9fb51dcf3059), [`f59f9f9`](https://github.com/stevekinney/cinder/commit/f59f9f93ce3f209a20e46ebb1891b5ebeeec757e), [`1f6f63e`](https://github.com/stevekinney/cinder/commit/1f6f63e78b1f23a6000d8ffba790976804f43b49), [`cb2e132`](https://github.com/stevekinney/cinder/commit/cb2e13237a014058a5adbad8a6ff1768040f25a1), [`7b9be9d`](https://github.com/stevekinney/cinder/commit/7b9be9d9d76024df7af698f96e760c725af2dd9a), [`912c785`](https://github.com/stevekinney/cinder/commit/912c785c93286da98c93f58e38e7e13ae5614292), [`74a58e6`](https://github.com/stevekinney/cinder/commit/74a58e6cc68f7b5db632090f80e0f81a7d62c66b), [`0a43737`](https://github.com/stevekinney/cinder/commit/0a43737b4cc04a8d13628fbb47879fb5f5ba117b), [`5b640a3`](https://github.com/stevekinney/cinder/commit/5b640a3b043c33667a243c526c79ddd72e6912a2), [`dc3dc20`](https://github.com/stevekinney/cinder/commit/dc3dc20153e59b03cceb5c0d6c505111af44f4e9), [`c5bd054`](https://github.com/stevekinney/cinder/commit/c5bd05414313548118fe9c8aa5eab645ba1ec6dd), [`43eb35b`](https://github.com/stevekinney/cinder/commit/43eb35bb96c50cefdeb61c121a540eec5049fc9f)]:
  - @lostgradient/cinder@0.20.0

## 0.1.0

### Minor Changes

- [#856](https://github.com/stevekinney/cinder/pull/856) [`006641e`](https://github.com/stevekinney/cinder/commit/006641ebfd998a78e0c2d0459b503c750f9a014c) Thanks [@stevekinney](https://github.com/stevekinney)! - Publish `@lostgradient/editor` (Phase 3 of the package-boundaries plan, see
  `docs/decisions/package-boundaries.md`). `@cinder/commentary` is renamed to `@lostgradient/editor`
  and absorbs the ProseMirror/Milkdown half of the former `@cinder/editor` package. Three components
  move out of `@lostgradient/cinder` and into this new package: `markdown-editor`, `review-editor`,
  and `diff-viewer` — `review-editor` composes the other two, so all three had to move together.

  `@lostgradient/cinder`'s `markdown-editor`, `review-editor`, and `diff-viewer` subpaths (and their
  `/schema`, `/variables`, `/styles`, `/examples` siblings) are **removed** — this is a breaking
  change for any external consumer of those subpaths, hence the minor (not patch) bump on
  `@lostgradient/cinder`, which pre-1.0 treats a breaking removal as a minor per semver's own
  pre-1.0 carve-out (the same reasoning `@lostgradient/markdown`'s publish used for the removed
  `./diff` aliases). That is the ONLY subpath removal in this release — Phase 3's scope is those
  three Svelte components, nothing else. Cinder's `./editor`, `./editor/component-runtime`,
  `./editor/test-utilities`, the bare `./commentary` root barrel, and every `./commentary/*` subpath
  (`anchor-decorations`, `anchoring`, `comments`(+`/types`), `export`(+`/types`), `session`
  (+`/types`), `shared/anchor-types`) are unaffected — they now mirror `@lostgradient/editor`'s
  headless runtime instead of `@cinder/commentary`'s, with no change to their public shape.

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

### Patch Changes

- Updated dependencies [[`ffbbb2f`](https://github.com/stevekinney/cinder/commit/ffbbb2f3b6fc9ac8bbb14c598716e49cff72c517), [`fdecd5e`](https://github.com/stevekinney/cinder/commit/fdecd5e63a0ea2e3ca8e3d997efa3f815d1bd664), [`955adb0`](https://github.com/stevekinney/cinder/commit/955adb0459272b9d08ed8a5eb13b579ce83997a7), [`30feaa5`](https://github.com/stevekinney/cinder/commit/30feaa509548f436e77c47520d9b49193f76c6f4), [`f86e857`](https://github.com/stevekinney/cinder/commit/f86e8577f03cedad95858f5fb60a20f3265a2407), [`204928e`](https://github.com/stevekinney/cinder/commit/204928e8b07e6e1e7ea7f16c994ae3e201933bf9), [`62a9a75`](https://github.com/stevekinney/cinder/commit/62a9a75c321303f7f4c8cd8d429fc0d1a071f667), [`0ef0a27`](https://github.com/stevekinney/cinder/commit/0ef0a272568e716e0dac034e60347f5cf3f611d6), [`caa5b36`](https://github.com/stevekinney/cinder/commit/caa5b36ea46511a8e62f514d89e2f4a5726f9fc9), [`23a5ebc`](https://github.com/stevekinney/cinder/commit/23a5ebc161be56d1198829fb269372e67f85d5bb), [`35732d8`](https://github.com/stevekinney/cinder/commit/35732d8d15240082ccb5d7b4be6d6216a05c40ea), [`d7ecfc4`](https://github.com/stevekinney/cinder/commit/d7ecfc4cece464edddef9e027ae5176d40313766), [`fffa0ab`](https://github.com/stevekinney/cinder/commit/fffa0abf2ee41c9cf0a0e100eb5ee99447f5d5f4), [`e9c1146`](https://github.com/stevekinney/cinder/commit/e9c11464ca1ef5af0801439270f4e0e09411ad41), [`006641e`](https://github.com/stevekinney/cinder/commit/006641ebfd998a78e0c2d0459b503c750f9a014c), [`1b80249`](https://github.com/stevekinney/cinder/commit/1b802498e71f799ceac44becd67fec73f8b7d74c), [`4376c18`](https://github.com/stevekinney/cinder/commit/4376c18e2f0dd055ec629cd02035447f8f6e13b2), [`2174be0`](https://github.com/stevekinney/cinder/commit/2174be0182d834d8aa3f1dbe82a2b3fe54b153db), [`280ba3e`](https://github.com/stevekinney/cinder/commit/280ba3e9eed6e76d7534bd0f4f78ff8890cf05df), [`7e9d2f6`](https://github.com/stevekinney/cinder/commit/7e9d2f65b1b464762f6858a0e6429c1c6c52d4d1), [`356c5d7`](https://github.com/stevekinney/cinder/commit/356c5d7f7a4d3a7e9306b71e6039ce05382c7aa7), [`282b380`](https://github.com/stevekinney/cinder/commit/282b38060b765340a58f07487c53a0f9710d4033), [`31fd201`](https://github.com/stevekinney/cinder/commit/31fd20103079bc6cebeadab8c0e11390119754f3), [`88d8b17`](https://github.com/stevekinney/cinder/commit/88d8b17d99e74742d0819094b3c6a5740079d6c3), [`09bdd26`](https://github.com/stevekinney/cinder/commit/09bdd2627ef2a36edf502add662ffd08a9b6ae41)]:
  - @lostgradient/cinder@0.17.0
  - @lostgradient/markdown@0.1.0
