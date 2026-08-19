---
"@lostgradient/cinder": patch
---

Fix two accessibility bugs in the JSON Schema editor's enum value table: an undo/redo could leave a stale invalid draft attached to a row index that no longer exists (which then resurfaced on a newly added row at that index), and two consecutive identical reorder moves could fail to re-announce to assistive technology because the live region's text didn't change.
