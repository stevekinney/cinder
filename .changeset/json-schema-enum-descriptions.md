---
"@lostgradient/cinder": patch
---

Add a Description column to the JSON Schema editor's enum table. Standard JSON Schema `enum` has no per-value description slot, so typing a description promotes the enum to `oneOf: [{const, description?}, ...]` — real, valid JSON Schema — and clearing every description demotes it back to a bare `enum`. A `oneOf` that already looks like a real composition (any branch carrying a keyword other than `const`/`description`) is never reinterpreted as an enum.
