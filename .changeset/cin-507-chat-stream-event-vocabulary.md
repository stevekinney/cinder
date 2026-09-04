---
'@lostgradient/chat': minor
---

Extend `ChatStreamEvent` additively to carry Operative's full stream and run event vocabulary (`stream:*`, `tool.*`, `run.*`) plus a `wireVersion` / `sequence` wire envelope. The three original members (`text`, `tool_call`, `tool_result`) keep their exact current shapes and decode unchanged, with or without the new envelope fields.
