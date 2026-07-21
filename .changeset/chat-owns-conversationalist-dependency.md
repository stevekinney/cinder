---
'@lostgradient/chat': minor
---

`@lostgradient/chat` now owns its `conversationalist` and `zod` dependencies instead of declaring them as `peerDependencies`. Host applications no longer need to `bun add conversationalist zod` (or pick a compatible version) themselves — both install automatically alongside `@lostgradient/chat`. `@lostgradient/cinder` and `svelte` remain peer dependencies, since your application must control which single copy of those renders.

`@lostgradient/chat` also re-exports `isJSONValue` from `conversationalist`, so consumers validating message content, metadata, or tool-call arguments before constructing a conversation no longer need to import `conversationalist` directly for it.

**Consumer impact:** if your app currently lists `conversationalist` and/or `zod` as direct dependencies solely to satisfy `@lostgradient/chat`'s former peer requirement, you can remove them — `@lostgradient/chat` now supplies its own compatible version. If your app also uses `conversationalist` directly for something beyond what `@lostgradient/chat` re-exports (e.g. its adapters or schemas), keep your own dependency; npm/bun will de-duplicate compatible versions in the tree.
