---
'@lostgradient/cinder': minor
---

Enrich the component manifest (`components.json`) with structured accessibility metadata and restructure `avoidWhen` guidance.

- `avoidWhen` entries change from flat strings to `{ reason, alternative? }` objects, where `alternative` is the kebab-case id of the component to reach for instead. Authored as `@avoidWhen <reason> | <kebab-id>` (the alternative is optional). This is a breaking change to the published manifest schema for external consumers that read `avoidWhen`.
- New optional `a11y` metadata per component (`{ pattern?, keyboard?, notes? }`), authored via `@a11yPattern`, `@keyboardShortcut <keys> | <action>`, and `@a11yNote` JSDoc tags. Components without these tags omit the field entirely.

The manifest generator now also fails if an `avoidWhen.alternative` does not resolve to a real component id.
