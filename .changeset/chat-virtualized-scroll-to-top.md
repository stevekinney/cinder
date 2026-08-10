---
'@lostgradient/chat': patch
---

Make virtualized scrollToTop()/scrollToBottom() actually navigate the transcript: guard settlement is now target-aware, so a stale scrollend left in flight by an auto-stick bottom correction can no longer settle the user-scroll guard mid-animation and let the next remeasurement re-pin the viewport to the bottom.
