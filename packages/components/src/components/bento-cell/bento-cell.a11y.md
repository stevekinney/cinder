# Accessibility notes

- `BentoCell` is layout-only and does not assign interactive roles or keyboard
  handlers.
- Preserve semantic structure by choosing an appropriate element for the `as`
  prop (for example `li` when inside a list wrapper).
- Avoid using visual span changes as the only cue for information hierarchy;
  include meaningful headings and text in cell content.
