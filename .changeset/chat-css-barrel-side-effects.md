---
'@lostgradient/chat': patch
---

Keep each component's stylesheet in a consumer's client bundle. The package listed only `**/*.css` under `sideEffects`, so a Rolldown-based bundler (Vite 8) treated the component barrels that import those stylesheets as side-effect-free re-export modules and skipped them entirely, dropping the `chat.css` sidecar from production client output while the Vite dev server still served it. The barrels (`src/lib/components/*/index.ts` and `dist/components/*/index.js`) are now declared side-effectful too.
