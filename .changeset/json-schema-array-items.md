---
"@lostgradient/cinder": patch
---

Give array properties in the JSON Schema editor a fully editable `items` schema: expanding an array row reveals the same type selector, enum table, and nested properties table as a top-level property, scoped to `items`. The Type cell now summarizes item type inline at rest (`array of string`, `array of object`, `array of enum`). Also fixes a bug where reordering or renaming a property could silently fail to commit: the property list built its patched schema with `Object.create(null)` to safely handle a literal `__proto__` key, but a null-prototype object isn't structured-cloneable, and the editor's undo-history snapshot uses `structuredClone` — so every reorder and rename since the table rework was throwing inside that clone and being dropped.
