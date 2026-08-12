---
'@lostgradient/editor': minor
---

Add `toRuntimeThreads`, the documented inverse of `toPersistedThreads`, so a saved `ReviewState` can be bound straight to ReviewEditor's `threads` prop without casting through `unknown`. It seeds `from`/`to` with a neutral unplaced sentinel and lets the anchor plugin place each thread by its quote. Both converters now preserve `anchor.type`, which fixes document-level threads being silently deleted when restored via `setState`. Anchor coordinate spaces are documented on the `threads` prop, and the `with-comments` example now seeds real ProseMirror positions instead of raw-Markdown indices.
