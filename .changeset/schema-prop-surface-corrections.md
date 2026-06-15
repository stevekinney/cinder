---
'@lostgradient/cinder': patch
---

Correct generated schema/documentation prop surfaces flagged in the component audit (#393).

- **`Textarea`** — `required` and `maxlength` now appear as first-class typed props (`boolean` / `number`) in the schema and README props table instead of being silently dropped as inherited HTML attributes. Both already drive component behavior (form validation wiring and the `showCount` character counter).
- **`Timeline`** — the internal `role` escape-hatch is now typed `never` instead of `unknown`, matching the public contract (which omits `role` so consumers cannot clobber the `<ol>`'s implicit `list` role). No public API change.
- **`TreeItem`** — replaced a leaked internal note ("see tree.svelte plan for rationale") on the `branch` prop with a consumer-facing description of branch semantics.

Also regenerates schema artifacts that had drifted from their source types on `main`, surfacing two props that were already accepted but undocumented:

- **`AvatarGroup`** — `label` (`string`, default `"Collaborators"`) now appears in the schema and README as the accessible name for the avatar stack.
- **`Popover`** — `closeOnEscape` (`boolean`, default `true`) now appears in the schema and README; it controls whether the Popover registers its own handler on the shared Escape stack.
