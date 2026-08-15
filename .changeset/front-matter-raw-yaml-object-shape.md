---
'@lostgradient/editor': patch
---

Fix `ReviewEditor`'s front-matter raw-YAML field silently discarding an edit instead of either
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
