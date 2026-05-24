# AreaChart Accessibility

AreaChart exposes one focusable SVG target per visible point when the point count is under `maximumInteractivePoints`. Use Tab to move between point targets, arrow keys to inspect adjacent points, Home and End to jump to the first or last point, and Escape to clear the active tooltip. High-cardinality charts keep pointer hover enabled and direct keyboard users to the semantic data table fallback.
