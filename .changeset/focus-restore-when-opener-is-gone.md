---
'@lostgradient/cinder': patch
'@lostgradient/editor': patch
---

Give `createFocusTrap` a `restoreFallback`, so closing an overlay whose opener has been removed no longer drops focus on `<body>`.

The trap captured the focused element on activation and handed it to `restoreFocusTo` on deactivation. That helper correctly refuses to focus a disconnected node — and its return value was discarded, so when the control that opened the overlay had been removed in the meantime, nothing else happened and focus landed nowhere. A screen reader says nothing; a keyboard user's next Tab restarts at the top of the document.

The reachable instance is `ReviewEditor`'s thread popover: deleting a thread from inside its own popover removes the sidebar item the popover was opened from, so the restore target is gone by the time the trap runs. It only bites a consumer that actually applies `onthreaddelete`, which is why notification-only demos never showed it — their sidebar item survives the delete.

`restoreFallback` is consulted only when restoring to the captured element fails, so supplying it can never override a restore that would have worked, and it is resolved against the document rather than the trap root because a restore target lives outside the trap by definition and the trap's own node is usually already detached by then. A restore now also counts as successful only when focus actually lands: `restoreFocusTo` reports success whenever `.focus()` did not throw, which is equally true of a still-connected element that has since become `disabled` or `inert`.

A companion `preferRestoreFallback` covers the asynchronous case. A consumer whose delete handler waits on a server keeps the opener mounted while the request is in flight, so restoration finds it perfectly focusable, hands focus back, and then watches it unmount — landing on `<body>` after all. `ThreadPopover` sets it once a delete has been requested. It reorders the candidates rather than discarding one, so a missing fallback still falls through to the captured element.

`ReviewEditor` points the popover at that editor instance's comments-sidebar toggle — always mounted, always focusable, adjacent to the work, and its label announces the changed comment count. The toggle gained an `id` so the target can be resolved with `getElementById` rather than an attribute selector: the editor `id` is consumer-supplied and only has to be a valid HTML id, so it may contain `"` or `\`, which would make an interpolated selector invalid and fail silently — back to `<body>`.

Fixes #1291.
