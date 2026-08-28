---
'@lostgradient/cinder': patch
---

Fix Card's discarded elevation, rebuild ShareCard on the Input primitive, and give ColorField's
swatch an accessible name that carries its value.

Card's `well` and `danger` variants set `box-shadow: none` unconditionally, at equal specificity
after the elevation rules, so an explicit `elevation="md"` or `"lg"` was silently dropped on those
variants. The flat treatment is now scoped to `elevation="sm"`, leaving the default look unchanged
while letting a consumer-set elevation take effect.

ShareCard's value becomes a real, keyboard-reachable field: it composes `Input` with
`variant="code"` and carries the copy and share controls as an interactive trailing addon, so the
URL can be focused, selected, and copied without a pointer. Hand-rolled SVGs are replaced with
lucide icons, and the bespoke code-well styling is deleted rather than left to fight the primitive.
`ShareCardAction.label` remains the required string accessible name and `labelSnippet` remains
optional rich visible content.

ColorField's swatch button now names its current value — "Choose a color, current color #ff0000"
rather than a static label — so screen-reader users can tell what the swatch shows without
inspecting the adjacent input.

The blog-post-grid Card example stops muting its excerpt, which is primary content rather than a
secondary annotation, and composes `Link` for the post title so a link reads as a link.
