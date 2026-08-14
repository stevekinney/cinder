---
'@lostgradient/cinder': patch
'@lostgradient/editor': patch
---

Give `createFocusTrap` a `restoreFallback`, so closing an overlay whose opener has been removed no longer drops focus on `<body>`.

The trap captured the focused element on activation and handed it to `restoreFocusTo` on deactivation. That helper correctly refuses to focus a disconnected node — and its return value was discarded, so when the control that opened the overlay had been removed in the meantime, nothing else happened and focus landed nowhere. A screen reader says nothing; a keyboard user's next Tab restarts at the top of the document.

The reachable instance is `ReviewEditor`'s thread popover: deleting a thread from inside its own popover removes the sidebar item the popover was opened from, so the restore target is gone by the time the trap runs. It only bites a consumer that actually applies `onthreaddelete`, which is why notification-only demos never showed it — their sidebar item survives the delete.

`restoreFallback` is consulted only when restoring to the captured element fails, so supplying it can never override a restore that would have worked, and it is resolved against the document rather than the trap root because a restore target lives outside the trap by definition and the trap's own node is usually already detached by then. `ThreadPopover` takes it as a prop and `ReviewEditor` points it at that editor instance's comments-sidebar toggle — always mounted, always focusable, and adjacent to the work.

Fixes #1291.
