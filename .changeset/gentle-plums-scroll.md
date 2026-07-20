---
'@lostgradient/chat': patch
---

Fix `scrollToTop()` (and the `Home` key jump-to-start shortcut) fighting the auto-stick-to-bottom effect in virtualized mode, where the viewport would oscillate and never reach the top. Both now suppress the auto-stick effect for the duration of the scroll, mirroring `jumpToLatest()`.
