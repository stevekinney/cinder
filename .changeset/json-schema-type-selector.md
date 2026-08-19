---
"@lostgradient/cinder": patch
---

Add a type selector to the JSON Schema editor's property editor, covering string/number/integer/boolean/enum/object/array plus "Any" and an explicit "Multiple types" option that reveals the existing multi-type checkbox row. Selecting "enum" seeds a default value and expands the enum table without touching `type`; the previously separate "Enum values" checkbox is removed since the type select now covers that transition.
