---
'@lostgradient/chat': patch
---

Correct the published install instructions: `lucide-svelte` is no longer a peer dependency that
host applications install themselves. Cinder owns it as a pinned regular dependency, so a consumer
following the old guidance could resolve a different version than the one baked into Cinder's
prebuilt SSR bundle and hit a `hydration_mismatch` on first load.

Documentation only — no runtime change. Needs its own release so the corrected README actually
ships; `publish-release` skips the package when its current version already exists.
