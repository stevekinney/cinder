---
'@lostgradient/cinder': patch
---

Tame the overlay entrance/exit motion. The shared `--cinder-ease-spring` timing function was a back-ease (`cubic-bezier(0.34, 1.56, 0.64, 1)`) whose `y1` control point of `1.56` overshot to 156% of the animated travel before settling. On `Sheet` and `Drawer` — where the panel translates a full 100% of its own width/height — that overshoot flung the panel well past the viewport edge mid-transition. `Modal` and `CommandPalette` (which share the token) showed the same pop on a smaller scale. The token is now a settled ease-out (`cubic-bezier(0.22, 1, 0.36, 1)`): the same snappy decelerate-in feel with no overshoot, so overlays slide cleanly to rest. No API change.
