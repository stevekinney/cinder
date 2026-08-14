---
'@lostgradient/chat': patch
---

Return focus when the artifact panel closes, instead of dropping it on `<body>`.

`ArtifactPanel` focuses its Close button on mount so a keyboard user lands inside the panel — deliberate and good — but nothing restored focus on unmount. Closing therefore left `document.activeElement` as `<body>`: the next Tab restarts at the top of the document, and a screen reader announces nothing. Reproduced identically in Chromium, Firefox, and WebKit, so this was never an engine quirk.

The attachment now captures the previously focused element before taking focus and restores it on teardown, guarded on `isConnected` — restoring to a detached node is a silent no-op that would leave the bug in place with no signal. Stated plainly because it is a real limit: a consumer whose close also removes the control that opened the panel still has to manage focus itself, since by teardown the panel has no surviving element of its own to offer either.

Fixes #1299.
