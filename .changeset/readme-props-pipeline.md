---
'@lostgradient/cinder': minor
---

Fix the README/generated-props documentation pipeline end to end:

- Fix every README `## Usage` example that failed to compile, rendered nothing, or documented the API incorrectly (roughly 53 components).
- Add a `validate:consumer:readme-usage-examples` gate that compile-checks every component README's `## Usage` fence against the built package on every merge.
- Extend the Playground's default-value extractor to resolve negative numbers, static template literals, and object-literal defaults; fix `@default` JSDoc quote-handling so single-quoted tags (e.g. `@default 'auto'`) no longer render as doubled quotes; backfill missing `@default` tags across ~20 components so their generated README Default column is no longer a false `—`.
- Migrate `date-range-field`'s hand-authored README, and `faceted-filter-bar`'s and `resizable-panels`' READMEs, onto the standard `components:generate` markers so their prop tables stay in sync automatically.
- **Narrows `class` from a broad attribute-style type to `string`** on `Radio`, `Avatar`, `Card`, `Checkbox`, `ChoiceGrid`, `FileUpload`, `Image`, `Input`, `Label`, `NumberInput`, `SearchField`, `Select`, `SideNavigationGroup`, and `Textarea` — these components previously reported `class` as unclassifiable/opaque in their generated schema even though the runtime prop only ever accepted a plain string; array/object `class` values are no longer accepted on these 14 components. (`GridList`'s equivalent fix is blocked on a separate type-soundness issue and is not included here.)
