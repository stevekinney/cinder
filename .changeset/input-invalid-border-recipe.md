---
'@lostgradient/cinder': patch
---

Share one declaration of the Input's invalid-hover border between the input, its host wrapper, and the group. The three surfaces that can paint that edge each derived it separately, so they could drift apart, and the duplication pushed the file past its raw-color allowance.
