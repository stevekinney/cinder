---
'cinder': minor
---

`<Tabs>` now skips disabled tabs during keyboard navigation, in line with the WAI-ARIA tabs pattern. Arrow keys, Home, and End walk only over enabled tabs; an all-disabled tablist is a no-op. The `TabsContext` exposes a new `setDisabled(value, disabled)` method that `<Tab>` calls via a dedicated effect, so toggling `disabled` at runtime preserves the navigation order rather than re-inserting the tab at the end of the registry.
