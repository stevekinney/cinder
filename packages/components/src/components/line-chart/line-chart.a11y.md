# LineChart Accessibility

LineChart exposes one focusable SVG target per visible point when the point count is under `maximumInteractivePoints`. Use Tab to move between point targets, arrow keys to inspect adjacent points, Home and End to jump to the first or last point, and Escape to clear the active tooltip. High-cardinality charts disable point keyboard targets and rely on the semantic data table fallback as the reliable assistive technology representation.

## Rendering review (2026-08-10)

The implementation review compared LineChart with AreaChart and BarChart and retained LineChart for unfilled trends. Browser review in dark mode confirmed readable inherited text, distinct series colors, automatic guide spacing, and unclipped labels. Tooltips remain opt-in; keyboard focus follows stable point identities after updates, while the exact semantic data table remains the assistive-technology source when the SVG path is decimated. A custom `mark` snippet owns its visual shape and color contrast, but the component continues to provide the focus target, accessible value, and table row.
