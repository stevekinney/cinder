---
'@lostgradient/markdown': minor
---

Fix `parseFrontMatter` treating any `---`-delimited prefix as front matter, even when the
content between the delimiters isn't valid YAML, or is valid YAML that isn't object-shaped
(cinder#1325).

`extractFrontMatterSegments` matched a closing `---` with no check on what was between the
fences, and `parseFrontMatter` caught a YAML parse failure but still returned `hasFrontMatter:
true` with `data: null`. That misclassified two very different things as "front matter":

- A document that starts with `---`, contains a Markdown list (`- one`, or `* one`), and closes
  with a second `---` — that's three ordinary Markdown blocks (a thematic break, a list, another
  thematic break), not front matter. `- one` even parses as valid YAML, just a sequence, not the
  key/value mapping front matter requires.
- A document whose `---`-delimited span genuinely isn't valid YAML at all (an unclosed bracket,
  an unresolvable alias reference).

The practical cost showed up one level up, in `@lostgradient/editor`: `normalizeDocument` /
`splitDocument` treat `hasFrontMatter: true` as license to preserve that span byte-for-byte
instead of running it through Markdown normalization. Two documents differing only in list-marker
style inside a false-positive "front matter" block (`* one` vs `- one` — the same Markdown list,
different marker character) normalized to two _different_ strings, so a diff between them
reported a real edit instead of the formatting-only no-op it is everywhere else in the document.

`parseFrontMatter` now requires the content between the delimiters to parse as YAML _and_ be
object-shaped (a key/value mapping, not a bare scalar, sequence, or `null`) before reporting
`hasFrontMatter: true`. Otherwise it returns `hasFrontMatter: false` and the entire document
(delimiters included) as `body` — the same result as when no closing delimiter is found at all.
An intentionally empty front-matter block (`---\n---\n`) is unaffected: blank content between the
delimiters was never a parse failure, so it still reports `hasFrontMatter: true` with `data:
null`.

This package's own `normalizeWithFrontMatter` and `contentEqualsWithFrontMatter` build on
`parseFrontMatter` and inherit the fix: `normalizeWithFrontMatter` used to silently drop a
false-positive span from its output entirely (its `!hasFrontMatter || !data` branch returned only
`normalize(body)`, and `body` was already everything _after_ the closing fence) — it now preserves
that span as normalized body content instead. `contentEqualsWithFrontMatter` used to compare only
what followed the closing fence, so two documents with different-but-both-invalid front-matter-shaped
content could compare equal without that content ever being examined; it now compares the whole
document as Markdown when neither side has real front matter.

This is a breaking change to `parseFrontMatter`'s public contract for the narrow case of
`---`-delimited content that previously reported `hasFrontMatter: true` with `data: null` on a
parse failure — it now reports `hasFrontMatter: false`. Minor rather than patch to flag that
explicitly, even though every public package here is still pre-1.0. One known downstream
consequence, called out rather than silently shipped: `@lostgradient/editor`'s ReviewEditor shows
its front-matter panel (with a raw-YAML recovery field) only when `hasFrontMatter` is true, so a
document loaded with genuinely broken front-matter YAML (not user-typed — the panel's own raw-YAML
editing path never commits invalid YAML into the document, only external/corrupted documents reach
this) now renders that span as plain Markdown body content in the main editor instead of surfacing
the friendlier raw-YAML recovery field. No data is lost — `combineFrontMatterAndBody` still
round-trips the document byte-for-byte — but the recovery affordance moves from a dedicated field
to inline editing of what displays as a thematic break, a paragraph, and a second thematic break.

**Follow-up (review finding): a `---`-delimited block containing only YAML comments is valid
front matter, not a false positive.** `# TODO: fill this in` between the delimiters is the standard
idiom for "an intentionally empty front-matter block with a note" — but `js-yaml`'s `load()` returns
`null` for it, the exact same value it returns for content that's genuinely blank, and the object-shape
gate above couldn't tell those two `null`s apart. Comment-only content fell into the _rejected_
branch, alongside a real Markdown list or scalar, even though a document doesn't ordinarily open
with `# ...` immediately followed by a second `---`. Fixed by a line-oriented check
(`isCommentOnlyYaml`: every line, trimmed, is either blank or starts with `#`) that routes
comment-only content to the same "empty, still front matter" treatment the whitespace-only case
already gets, without needing full YAML-comment-aware parsing (which would also have to reason
about `#` inside quoted strings) — it only has to recognize "nothing but comments," not parse
comments in general.

**Follow-up (review finding, more consequential): callers deciding whether to prepend a new
front-matter block must not use `hasFrontMatter === false` to mean "there's no fence here to
collide with."** After the fix above, that's also true for a document whose `---` span exists but
is invalid or non-object YAML — so a caller using `!hasFrontMatter` as its "safe to prepend" guard
(`@lostgradient/editor`'s `generateUnifiedDiff` with `includeFrontMatter`, and
`reviewStateToMarkdown`) could stringify a _second_ `---`...`---` block onto content that already
starts with one, duplicating the prefix. The realistic trigger is persisted state saved before this
patch shipped, whose `frontMatterRaw` field is stale relative to what the document's own content now
parses as. This is the same defect class the front-matter corruption bug this whole area exists to
prevent (cinder#1285) — fixed by inventory, not by patching the two call sites a bot review named:
`FrontMatterParseResult` gains a third state, `fencePresent` (`@lostgradient/markdown/pipeline`),
`true` whenever a `---`...`---` span exists at all regardless of validity, distinct from
`hasFrontMatter` (`true` only when that span is _valid_ front matter). Every consumer of
`hasFrontMatter`/`parseFrontMatter` across `@lostgradient/markdown` and `@lostgradient/editor` was
audited (`@lostgradient/chat` has none): the two "is it safe to prepend" call sites now check
`fencePresent`; the remaining consumers (`normalizeDocument`/`splitDocument`,
`computeDiffWithFrontMatter`, `front-matter-fields.svelte`'s raw-YAML validation, and a hand-rolled,
entirely separate `DiffViewer`-local implementation that never called the shared `parseFrontMatter`
in the first place) only ever _conditionally split or validate_, never prepend, so `hasFrontMatter`
stays the correct check for them.

**Follow-up (round-6 review finding): the comment-only fix above reopened the exact silent-drop bug
the `fencePresent` fix just closed, in a new spot.** `# Title\n## Subtitle` between `---` fences is
simultaneously valid as "nothing but YAML comments" _and_ as two ordinary ATX headings sandwiched
between thematic breaks — the same irreducible ambiguity a Markdown list has with a YAML sequence,
except here there's no object-shape test to resolve it, since neither reading produces YAML data.
`parseFrontMatter` classifies it as front matter (`hasFrontMatter: true, data: null`, same shape as
a genuinely blank block) either way, which is correct for the "note" reading — but `normalizeWithFrontMatter`
and `contentEqualsWithFrontMatter` (`@lostgradient/markdown/pipeline`) both treated `data: null` as
"nothing here to preserve or compare," a shortcut that was true when only genuinely-blank content
could reach that branch and became false once comment-only content could too: `normalizeWithFrontMatter`
silently dropped the `# Title\n## Subtitle` span from its output, and `contentEqualsWithFrontMatter`
reported two documents differing only in that span as equal.

Fixed the same way as the earlier "preserved as body instead of silently dropping it" fix in this
same changeset, not by re-litigating whether comment-only content should count as front matter:
both functions now fall back to the parsed `raw` text (the literal bytes between the fences) whenever
`hasFrontMatter` is true but `data` is null and `raw` is non-null, rather than assuming there's
nothing there. `normalizeWithFrontMatter` re-wraps `raw` verbatim in the output instead of discarding
it; `contentEqualsWithFrontMatter` compares `raw` byte-for-byte before falling through to the body
comparison. Neither treats `raw` as YAML or Markdown at this point — it's opaque preserved text either
way, so misclassifying ATX headings as a comment-only block costs a display affordance (they round-trip
as part of the front-matter span rather than rendering as headings in the body), never the underlying
bytes, matching the precedent this changeset already established for invalid front matter losing its
dedicated recovery affordance without losing data. One deliberately-accepted, documented edge case:
comparing `raw` byte-for-byte means `---\n{}\n---` (`raw: '{}'`, an empty YAML mapping) no longer
compares equal to `---\n---` (`raw: null`), even though both have `data: null` — a spurious "changed"
rather than a missed one, the safe side to be wrong on.
