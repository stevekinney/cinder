---
'@lostgradient/cinder': minor
---

Promote the Stardust agent-operations components based on promotion-gate evidence.

`EventStreamViewer`, `PayloadInspector`, and `SecretValueField` are now marked stable. `InvocationRuleBuilder` is now marked beta after passing the same readiness gate with tests, accessibility coverage, and prop-name checks passing.

`SecretValueField` also now uses Svelte's explicit untracked initial-state capture for `initiallyRevealed`, preserving its initial-only behavior while avoiding a local-state warning.
