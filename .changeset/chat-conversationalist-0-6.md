---
'@lostgradient/chat': minor
---

Bump Chat's `conversationalist` dependency to `^0.6.0` and re-export the new branch-rewind builders — `rewindBeforeMessage`, `rewindBeforePosition`, and the `RewindOptions` type — from the package root alongside the existing builder family.

The dependency bump is consumer-visible in two ways. `updateStreamingMessage` (re-exported via `@lostgradient/chat`) now guards against writing to a message that is no longer streaming, so the late-token-after-stop race no-ops at the library boundary instead of every consumer hand-rolling a `shouldStop()` guard. And the rewind helpers are the operation Chat's own `editMessage` adapter command asks consumers to perform — rewind to just before the edited message, discard the superseded branch, re-send — which previously required assembling `ids`/`messages`/`updatedAt` by hand.
