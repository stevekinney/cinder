---
name: cinder-component-authoring
description: Use this skill when creating or substantially changing a Cinder component so the component composes existing primitives and follows the shared API, styling, icon, disclosure, and testing conventions.
---

# Cinder component authoring

Use this pre-flight before writing a new component. The checklist is deliberately
short; the machine-readable source is
`packages/components/scripts/component-conventions.ts`, and `components:create`
prints the same checklist in the generated README.

1. Search the component manifest, CLI/MCP inventory, and nearby source for an
   existing primitive. Compose it when it already covers the job. Read the
   rationale in [#919](https://github.com/stevekinney/cinder/issues/919) and
   [#929](https://github.com/stevekinney/cinder/issues/929) when the new component
   overlaps an existing family.
2. Read [`docs/component-api-conventions.md`](../../../docs/component-api-conventions.md)
   before adding props. Use the shared vocabulary and the denylist enforced by
   `scripts/component-conventions.ts` ([#922](https://github.com/stevekinney/cinder/issues/922)).
3. For a floating surface, use the shared `cinder-_floating-surface` class and
   `_floating-surface.css`; do not invent another positioning/ring recipe. Use
   `Input` and `FormField` when composing form controls
   ([#921](https://github.com/stevekinney/cinder/issues/921),
   [#923](https://github.com/stevekinney/cinder/issues/923)).
4. Use the established rotating chevron for disclosure affordances and icons
   from `lucide-svelte` ([#957](https://github.com/stevekinney/cinder/issues/957)).
5. Add tests that assert the resulting state and resting appearance as well as
   interaction transitions ([#931](https://github.com/stevekinney/cinder/issues/931)).
6. Scaffold with `bun run --filter=@lostgradient/cinder components:create <name>`
   and follow its generated next steps. Run `components:generate`, then
   `components:check` and `exports:check` after adding the component to the
   manifest/barrel.

Cross-referenced epics: [#919](https://github.com/stevekinney/cinder/issues/919),
[#921](https://github.com/stevekinney/cinder/issues/921),
[#922](https://github.com/stevekinney/cinder/issues/922),
[#923](https://github.com/stevekinney/cinder/issues/923),
[#929](https://github.com/stevekinney/cinder/issues/929),
[#931](https://github.com/stevekinney/cinder/issues/931), and
[#957](https://github.com/stevekinney/cinder/issues/957).
