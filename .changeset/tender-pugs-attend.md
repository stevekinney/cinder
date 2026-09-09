---
'@lostgradient/editor': patch
---

Stop the review editor's selection popover from re-opening over text whose comment was just submitted. Submitting hands focus back to the editor, ProseMirror re-writes its stored, still non-collapsed selection into the DOM, and that `selectionchange` used to re-open the popover. The editor now holds the submitted range until a pointer or key inside it starts a new selection.
