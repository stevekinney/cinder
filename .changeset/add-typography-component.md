---
'cinder': minor
---

Add `Typography` — a text component that renders a named typographic variant
(`h1`–`h6`, `subtitle1/2`, `body1/2`, `caption`, `overline`, `label`) mapped to
the cinder design-token scale, on a semantically appropriate but overridable
HTML element.

- `variant` drives the type style; the element defaults to the semantically
  correct tag (`h1`→`<h1>`, `body1`→`<p>`, `caption`→`<span>`, subtitles→`<p>`).
- `component` overrides the rendered element while keeping the variant's style
  (e.g. `variant="h1" component="span"` for SEO/structure control).
- `gutterBottom` adds bottom margin; `noWrap` truncates to a single line with an
  ellipsis.
- Forwards native HTML attributes to the rendered element.
