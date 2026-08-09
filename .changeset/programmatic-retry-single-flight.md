---
'@lostgradient/chat': patch
---

Single-flight message retries at the dispatch layer and expose a guarded programmatic `retryMessage(messageId)` on the Chat instance, so a second retry for an id whose retry is still in flight is ignored regardless of entry point (UI Retry button or direct call).
