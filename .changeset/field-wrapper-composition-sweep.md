---
'@lostgradient/cinder': patch
---

Compose FormField across the remaining field wrappers — Radio, Combobox, DatePicker, JsonEditor, MultiSelect, Select, Textarea, and TimeField now render their label, description, and error text through the shared `FormFieldFrame` primitive instead of hand-rolled markup, matching Input/Checkbox/Toggle. `FormFieldFrame` gained `labelClass`, `errorAlwaysMounted`, and a `message` snippet slot to support the remaining shapes, plus generic HTML attribute passthrough on its root element.
