---
'@lostgradient/chat': patch
---

Preload the markdown rendering pipeline when streaming begins so the first streamed message is formatted without a cold-import delay (#1238).
