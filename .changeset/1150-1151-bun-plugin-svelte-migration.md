---
'@lostgradient/cinder': patch
---

Internal build-pipeline change: the Svelte build plugin (`packages/components/scripts/svelte-plugin.ts`, shared cross-package by chat, editor, and playground) now wraps the published `@lostgradient/bun-plugin-svelte` instead of invoking `svelte/compiler` directly for the common client/library-server case. No public component API changes. Published `dist/` output was verified byte-identical (file list + shasum) against a clean build of `main`, aside from the expected build-cache fingerprint file.
