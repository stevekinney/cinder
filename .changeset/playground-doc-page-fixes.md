---
'@cinder/playground': patch
---

Fix the component documentation page's Playground and Props sections.

- **Live preview now re-renders when you change a prop control.** The live mount read the synthesized prop values inside the `{@attach}` body, which Svelte only runs once; the values are now read in the attach expression (`$state.snapshot(playgroundValues)`), so changing a control tears down and re-mounts the component with the new props. Previously only the copyable snippet updated.
- **The Props table no longer shows the "REQ" badge twice** for a required prop — the redundant inline badge in the Name column is removed; the dedicated Required column keeps it.
- **The Playground PROPS controls panel no longer wraps long prop names one character per line.** Each control stacks its label/description above a full-width input instead of squeezing them side by side in the fixed-width column; boolean toggles stay inline with their label.
- **The import-snippet copy button reads as a button**, with a proper hit target, surface, and padding, instead of a bare icon crammed against the code field's edge.
