---
'@lostgradient/cinder': minor
---

Remove the `brand` snippet from `Sidebar`. Consumers that used it should move that markup into their own shell chrome, such as a top bar or a region above `Sidebar`; there is no replacement API.
