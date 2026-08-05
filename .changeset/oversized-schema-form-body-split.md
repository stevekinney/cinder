---
'@lostgradient/cinder': patch
---

Internal restructuring: extract SchemaFormBody's path-keyed editing state (form value, validation errors, and five auxiliary draft maps) into `SchemaFormState`, instantiated fresh on every schema remount. No behavior or public API change; `renderField` and all markup are unchanged.
