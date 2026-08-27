---
'@lostgradient/cinder': patch
---

Fix `tokens-base.css` so an explicit `data-reduced-motion="on"` override always wins over the `@media (prefers-reduced-motion: reduce)` block, even when the OS also prefers reduced motion. The media block's selector now also excludes `[data-reduced-motion='on']`, making the two reduced-motion blocks mutually exclusive instead of relying on specificity, which previously let the media block win and silently discard the user's explicit override.

Also retires the pre-DTCG `tokens:inventory` generator and `token-inventory.md` (dev tooling only, no published change): the discovery artifact it produced predates the corpus-driven pipeline and is now fully superseded by the generated `docs/tokens.md`.
