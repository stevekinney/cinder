---
'@lostgradient/cinder': minor
---

Move the Worker-based Markdown rendering API to `@lostgradient/cinder/markdown/rendering/async` so sync-only consumers do not bundle the Worker entry and its dependencies.
