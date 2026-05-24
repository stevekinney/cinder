# BarChart Accessibility

BarChart exposes one focusable SVG target per visible bar when the bar count is under `maximumInteractivePoints`. Use Tab to move between bar targets, arrow keys to inspect adjacent bars, Home and End to jump to the first or last bar, and Escape to clear the active tooltip. Large charts disable bar keyboard targets while leaving pointer hover and the semantic data table fallback available.
