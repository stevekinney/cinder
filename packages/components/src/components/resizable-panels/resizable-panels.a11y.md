# Accessibility notes

- Each handle is a focusable `span` with `role="separator"` and ARIA value attributes derived from the leading pane.
- The accessible name uses both adjacent pane labels: `Resize {leading} and {trailing}`.
- Keyboard support mirrors native splitters:
  - Horizontal layout: `ArrowLeft` and `ArrowRight`
  - Vertical layout: `ArrowUp` and `ArrowDown`
  - `Home` and `End` jump to the reachable pair minimum and maximum
