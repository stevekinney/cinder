---
'@lostgradient/cinder': patch
---

Fix Node SSR export condition precedence so resolvers with both `node` and `svelte` active load compiled server artifacts instead of source entries.
