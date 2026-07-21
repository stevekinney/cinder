---
'@lostgradient/chat': patch
---

Document that `ChatAdapter.subscribe` runs inside Chat's own internal mount `$effect`, so a synchronous `$state` write inside `subscribe` (or inside a handler it invokes synchronously before returning) can throw `effect_update_depth_exceeded`. The JSDoc on `ChatAdapter.subscribe` and `ChatPushHandlers` now names the working pattern — defer the write with `queueMicrotask`/`tick()` — with an example, and the README calls out the same constraint. Added a regression test that pins the documented workaround.
