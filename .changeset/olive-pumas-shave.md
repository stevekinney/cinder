---
'@lostgradient/cinder': minor
---

Publish the DTCG design-token corpus as package exports.

The token surface is now consumable without running Cinder's resolver or reading its CSS:

- `@lostgradient/cinder/tokens` — an index describing the surface and where each part is published.
- `@lostgradient/cinder/tokens/resolver` — the DTCG 2025.10 resolver document.
- `@lostgradient/cinder/tokens/sets/*`, `/themes/*`, `/modes/*` — the unresolved source documents, exactly as authored.
- `@lostgradient/cinder/tokens/resolved/{light,dark,light-reduced-motion,dark-reduced-motion}` — fully resolved token values, one file per context.
- `@lostgradient/cinder/tokens/registry` — a typed module mapping token paths to CSS custom properties, grouped by category and by component, with public/private, theme-aware, and deprecation status.

Resolved contexts now keep each token's identity metadata. Previously an overridden token lost its `$description` and its whole `$extensions` block during resolution, so most tokens in a resolved context could not be mapped back to a CSS custom property. Identity and documentation are inherited from the base token while the value and its `cssRecipe` come from the overriding context.

`forced-reduced-motion` is intentionally not published as a resolved context; the four exported contexts cover the default and reduced motion pairings.
