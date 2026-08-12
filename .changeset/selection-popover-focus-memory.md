---
'@lostgradient/cinder': patch
---

Keep SelectionPopover's pre-open focus owner for the popover's whole open lifetime so an Escape that follows a cancel or submit still returns focus to it instead of dropping it on `<body>`.
