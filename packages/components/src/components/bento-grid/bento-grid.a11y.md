# Accessibility notes

- `BentoGrid` is layout-only and does not add landmark or widget roles by
  default; semantic meaning should come from the chosen `as` element and child
  content.
- Narrow-screen collapse preserves DOM order because placement is reset to
  natural auto-flow at the collapse breakpoint.
- When tiles represent list items, use semantic list wrappers and item tags
  (`as="ul"` with `BentoGrid.Cell as="li"`).
