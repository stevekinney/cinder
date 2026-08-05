---
'@lostgradient/cinder': patch
---

Migrate the internal Svelte build plugin (`packages/components/scripts/svelte-plugin.ts`, shared cross-package by chat, editor, and playground) to wrap the published `@lostgradient/bun-plugin-svelte` instead of invoking `svelte/compiler` directly for the common client/library-server case. No public API, runtime behavior, or published `dist/` output changed — verified byte-identical (file list + shasum) against a clean build of `main`, aside from the expected build-cache fingerprint file.
