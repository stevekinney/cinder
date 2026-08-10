---
'@lostgradient/chat': patch
---

Preload the markdown rendering pipeline when Chat mounts so the first streamed message is formatted without a cold-import delay (#1238).
