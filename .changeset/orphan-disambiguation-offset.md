---
'@lostgradient/editor': patch
---

Keep a restored orphan's disambiguation offset, so a recovered comment reattaches
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
