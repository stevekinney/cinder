# BarChart Accessibility

BarChart exposes one focusable SVG target per visible bar when the bar count is under `maximumInteractivePoints`. Use Tab to move between bar targets, arrow keys to inspect adjacent bars, Home and End to jump to the first or last bar, and Escape to clear the active tooltip. Large charts disable bar keyboard targets while leaving pointer hover and the semantic data table fallback available.

## Rendering review (2026-08-10)

The implementation review compared BarChart with LineChart and retained BarChart for discrete category comparisons. Browser review of the horizontal orientation in dark mode confirmed readable inherited text, distinct series colors, automatic space for long labels, and unclipped marks. Tooltips remain opt-in and the semantic data table preserves exact values. A custom `mark` snippet owns its visual shape and color contrast, but the component continues to provide the focus target, accessible value, and table row.
