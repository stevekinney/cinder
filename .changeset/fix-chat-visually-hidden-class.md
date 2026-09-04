---
'@lostgradient/chat': patch
---

Fix visually-hidden status announcers rendering as ordinary visible text. Chat marked screen-reader-only content with the bare `sr-only` class, which had no CSS rule reaching most of the elements that used it — most visibly, a stray unstyled "Action required" line stacking above the intended tool-status chip. Every visually-hidden element now uses `cinder-sr-only`, the design system's utility (already required via `@lostgradient/cinder/styles`), and a guard script fails the build if a bare `sr-only` class reappears.
