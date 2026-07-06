---
'@lostgradient/cinder': patch
---

Fix the published package manifest so Svelte-aware consumers resolve Cinder component source instead of compiled component output, while stripping TypeScript-only syntax from staged Svelte source files so Vite can optimize the package.
