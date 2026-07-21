---
'@lostgradient/cinder': patch
---

Teach `check:pipeline-coverage` and `validate:release-workflow` to recognize `turbo run <task>` (including repeated `--filter=<pkg>` flags) as equivalent to `bun run --filter=<pkg> <task>`, so the workspace's move to Turborepo-orchestrated build/test/typecheck/lint doesn't silently blind the CI-gate coverage map. No published runtime behavior changes — dev-tooling scripts only.
