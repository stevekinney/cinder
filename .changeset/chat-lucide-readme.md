---
'@lostgradient/chat': minor
---

Require `@lostgradient/cinder@^0.17.0` and correct the install instructions.

`lucide-svelte` is no longer a peer dependency host applications install themselves — Cinder owns it
as a pinned regular dependency. The peer range previously accepted every `0.16.x` release,
where Lucide is still a peer, so a project updating only Chat could read the corrected README while
still resolving its own Lucide version against Cinder's prebuilt SSR bundle and hitting a
`hydration_mismatch` on first load. Requiring the fixed release closes that gap.
