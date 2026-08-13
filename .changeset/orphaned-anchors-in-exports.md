---
'@lostgradient/editor': patch
---

Tell comment exports apart from the document they no longer describe.

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
