---
'@lostgradient/chat': patch
---

Export typed immutable helpers for marking failed message delivery and clearing
the marker after a successful retry. Document how adapter consumers keep Chat's
Retry affordance synchronized with their conversation snapshot (#1240).
