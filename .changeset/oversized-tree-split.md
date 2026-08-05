---
'@lostgradient/cinder': patch
---

Internal restructuring: extract Tree's search/filter state (controlled-vs-uncontrolled value, debounced results announcement, filter input keyboard shortcuts) into `TreeFilterController`, and pointer-drag autoscroll (edge detection, scroll nudging, drop-target re-resolution while scrolling) into `TreeAutoscrollController`, both under `src/_internal/` alongside Tree's existing companion modules. Typeahead dispatch and both render paths (DOM-registry and virtualized) are unchanged. No behavior or public API change.
