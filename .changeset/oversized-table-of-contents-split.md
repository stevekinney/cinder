---
'@lostgradient/cinder': patch
---

Internal restructuring: extract `TableOfContents`'s heading-derivation and active-heading-tracking observer state machines into `table-of-contents-heading-registry.svelte.ts` and `table-of-contents-active-heading.svelte.ts`. No behavior or public API change; adds unit test coverage for logic that was previously only reachable through a full component mount.
