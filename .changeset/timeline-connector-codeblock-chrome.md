---
'@lostgradient/cinder': patch
---

Fix two component CSS defects surfaced by the playground:

- **Timeline connector** now spans each marker's center to the next marker's
  center instead of stopping `space-1` short, so the rail reads as one
  continuous line through the dots rather than disconnected stubs (notably with
  custom marker snippets). The connector's `bottom` offset now accounts for the
  marker's own `margin-top` inside the next event grid.
- **Code block** no longer renders per-token background bands in dark mode. The
  generated `<code>` element (and Shiki line/token spans) are forced transparent
  so the single `<pre>` surface shows through as one uniform field; only token
  foreground colors apply. The header copy button also gains real button
  affordance — a 28px-square hit target (clearing WCAG 2.5.8) with a subtle
  resting chip background — instead of a bare floating glyph.
