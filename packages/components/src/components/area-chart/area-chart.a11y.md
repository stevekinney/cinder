# AreaChart Accessibility

AreaChart exposes one focusable SVG target per visible point when the point count is under `maximumInteractivePoints`. Use Tab to move between point targets, arrow keys to inspect adjacent points, Home and End to jump to the first or last point, and Escape to clear the active tooltip. High-cardinality charts disable point keyboard targets while leaving pointer hover and a bounded semantic data table sample available; the caption discloses the displayed and total point counts.

## Rendering review (2026-08-10)

The implementation review compared AreaChart with LineChart and retained AreaChart for magnitude encoded by a filled baseline. Browser review in dark mode confirmed readable inherited text, unique per-instance gradients, automatic guide spacing, and unclipped labels. Keyboard focus is also conveyed by a rendered point focus-ring (connector line and dot) and pointer/active state by a crosshair line, independent of color. Tooltips remain opt-in; keyboard focus follows stable point identities after updates, while the bounded semantic data table remains the assistive-technology summary when the SVG path is decimated. A custom `mark` snippet owns its visual shape and color contrast, but the component continues to provide the focus target, accessible value, and sampled table row.
