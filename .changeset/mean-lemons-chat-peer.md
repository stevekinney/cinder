---
'@lostgradient/cinder': minor
---

Move `conversationalist` from a transitive dependency to a required peer
dependency. Consumers that use Chat or Cinder's conversation helpers must
install `conversationalist@^0.2.1` and `zod@4.4.1` directly so the application
and Cinder share one conversation type/schema instance.
