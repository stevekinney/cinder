---
name: cinder-component-authoring
description: Use this skill when creating or substantially changing a Cinder component so the component composes existing primitives and follows the shared API, styling, icon, disclosure, and testing conventions.
---

# Cinder component authoring

Use this pre-flight before writing a new component. The checklist is deliberately
short; the machine-readable source is
`packages/components/scripts/component-conventions.ts`, and `components:create`
prints the same checklist in the generated README.

<!-- component-authoring-checklist:start -->

- [ ] Search the component inventory and compose an existing primitive before creating a new one. (#919, #929)
- [ ] Check docs/component-api-conventions.md before adding or naming a public prop. (#922)
- [ ] Use `_floating-surface.css` for floating surfaces, and compose form controls from `Input` and `FormField`. (#921, #923)
- [ ] Use the rotating chevron for disclosure controls and icons from the lucide-svelte set. (#957)
- [ ] Add tests for resulting state and resting appearance, not only transitions. (#931)
<!-- component-authoring-checklist:end -->

Scaffold with
`bun run --filter=@lostgradient/cinder components:create <name>` and follow its
generated next steps. From the repository root, regenerate and verify artifacts
with:

```bash
bun run --filter=@lostgradient/cinder components:generate
bun run --filter=@lostgradient/cinder exports:generate
bun run --filter=@lostgradient/cinder components:check
bun run --filter=@lostgradient/cinder exports:check
```

Cross-referenced epics: [#919](https://github.com/stevekinney/cinder/issues/919),
[#921](https://github.com/stevekinney/cinder/issues/921),
[#922](https://github.com/stevekinney/cinder/issues/922),
[#923](https://github.com/stevekinney/cinder/issues/923),
[#929](https://github.com/stevekinney/cinder/issues/929),
[#931](https://github.com/stevekinney/cinder/issues/931), and
[#957](https://github.com/stevekinney/cinder/issues/957).
