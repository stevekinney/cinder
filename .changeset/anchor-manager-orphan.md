---
'@lostgradient/editor': patch
---

Align the exported `createAnchorManager` with the orphan-preservation contract.

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
The manager's sync fingerprint also now includes `status`, so a thread that flips
between anchored and orphaned without moving still re-syncs to the plugin.
