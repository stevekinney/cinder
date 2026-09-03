---
'@lostgradient/chat': patch
---

Raise the `conversationalist` dependency floor to `^1.1.0`, matching what `@lostgradient/operative` requires, so a host running Chat alongside Operative resolves a single `ConversationHistory` implementation instead of two divergent nested copies.
