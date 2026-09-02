---
'@lostgradient/cinder': patch
---

ShareCard renders its value field from a single `Input` call site. Previously the icon-only and `labelSnippet` layouts were two separate `Input` instances, so a parent that reactively changed `actions` across that boundary tore the field down and dropped the user's focus and selection. Now the actions move between the trailing addon and the sibling row as a prop update on the same element, and focus and the selection range survive.
