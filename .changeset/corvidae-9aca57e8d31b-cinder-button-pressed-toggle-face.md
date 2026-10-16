---
'@lostgradient/cinder': minor
---

A `Button` with `aria-pressed="true"` now shows that it is on.

Until now a toggle button that was pressed looked the same as one that was not, so the state reached assistive technology and nobody else. A pressed `Button` takes the filled accent face that `SegmentedControl` gives a pressed option, with the page-coloured gap before the focus ring that filled faces get, a hover face, and `Highlight` on `HighlightText` under forced colors. `primary` and `danger` are already filled and are unchanged, and a disabled pressed button keeps its disabled look.

The style applies to every `Button` that carries `aria-pressed="true"`, including your own. Cinder's own `KanbanBoard` sets it on a column's reorder handle while that column is lifted, so a lifted column's handle now takes the filled face. A `Button` with `aria-pressed="false"` or without the attribute is unchanged.
