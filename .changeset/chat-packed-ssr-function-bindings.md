---
'@lostgradient/chat': patch
---

Prevent the packed Chat wrapper's bindable scroll state from forcing a second server render that breaks lifecycle registration and SSR hydration.
