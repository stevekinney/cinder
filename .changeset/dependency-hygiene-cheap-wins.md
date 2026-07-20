---
'@lostgradient/cinder': patch
---

Deferred `ajv` in `json-schema-editor` the same way `schema-form` already does, so meta-schema validation and compile checks no longer ship Ajv in the base install path. `applyJsonDraft` is now async as a result.

Moved `zod` and `@modelcontextprotocol/sdk` from `dependencies` to optional `peerDependencies` — both are only used by the `mcp` CLI command (`bin.cinder mcp`), not by any component, so every consumer no longer has to install them. Running `mcp` without them now fails with an actionable message instead of a raw module-resolution error.
