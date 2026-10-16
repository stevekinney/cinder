---
'@lostgradient/cinder': minor
---

Add the `@lostgradient/cinder/tokens/runtime` subpath. It holds the pure token kernel that the Cinder generator and the theme builder share, so generated CSS and in-browser evaluation can no longer drift apart. It runs in memory and fetches nothing.

- `evaluateTheme` and `evaluateThemeProperties` validate a DTCG 2025.10 theme and evaluate all six light/dark and motion contexts. They return one public `--cinder-*` property map per context, revision-tagged diagnostics, and evaluated provenance (winning source, effective type origin, dependencies and dependents). `validateThemeSources` runs the same validation without evaluating.
- Browser validation uses standalone, eval-free DTCG schema validators.
- `CINDER_BASE` carries the shipped resolver and documents, the package version and a source digest. `AUTHORING_CATALOGUE` describes every public token's usage profile and its edit, CSS-export and DTCG-portability disposition.
- A WCAG contrast module (relative luminance, alpha compositing and the token pairing table) lets builder checks reuse Cinder's own contrast rules.
- `renderThemeStylesheet` emits a deployment stylesheet in a `cinder-theme` layer.

Other changes:

- The resolved token JSON now carries value-neutral `com.lostgradient.cinder` metadata: `scale` membership on the spacing and radius members, and `palette` family, role and anchor on color roles. No token value changes, and `tokens-base.css` is unchanged.
- Colors authored in Display P3 and other CSS Color 4 spaces now serialize as `color(<space> …)` instead of failing.
- `evaluateTheme` no longer crashes on a layer that `$extends` a group it also restates.
- `StylesheetError` now reports `name` as `'StylesheetError'`.
- The color picker's copy-format buttons now meet the 24 px minimum target size (WCAG 2.5.8).
