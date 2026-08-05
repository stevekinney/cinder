---
'@lostgradient/cinder': patch
---

Fix eight accessibility defects: chart focus targets no longer tabbable while loading, media-controls stays focusable with aria-disabled, permission-matrix cell labeling is de-duplicated, capability-gate dismiss buttons are uniquely labeled, button-group/side-navigation/side-navigation-group/sidebar no longer render or throw on empty labels, checkbox-group's fieldset-disabled cascade dims child labels, and event-stream-viewer's scrollable log uses a plain suppressed element instead of svelte:element.
