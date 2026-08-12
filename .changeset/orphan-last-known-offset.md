---
'@lostgradient/editor': patch
---

Stop inventing a last-known position for orphans that never recorded one.

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
