---
name: cinder-component-authoring
description: Use this skill when creating or substantially changing a Cinder component so it composes existing primitives, follows shared conventions, and completes required human design and accessibility review.
---

# Cinder component authoring

Use this pre-flight before writing a new component. The checklist is deliberately
short; the machine-readable source is
`packages/components/scripts/component-conventions.ts`, and `components:create`
links generated READMEs back to the live package guidance.

<!-- component-authoring-checklist:start -->

- [ ] Search the component inventory and compose an existing primitive before creating a new one. (#919, #929)
- [ ] Check docs/component-api-conventions.md before adding or naming a public prop. (#922)
- [ ] Apply the `cinder-_floating-surface` class to floating panels (defined in `_floating-surface.css`), and compose form controls from `Input` and `FormField`. (#921, #923)
- [ ] Use a rotating chevron for disclosure controls that render an indicator; use direction-aware lateral chevrons for nested submenus, keep intentionally text-only disclosures icon-free, and use icons from the lucide-svelte set. (#957)
- [ ] Add tests for resulting state and resting appearance, not only transitions. (#931)
- [ ] Get a design review for every new component; record its nearest neighbours, why it exists, and the review outcome in `*.a11y.md`. (#968)
- [ ] For a novel interaction model, get an accessibility review covering focus management, the keyboard matrix, and assistive-technology announcements; record the outcome in `*.a11y.md`. (#968)
<!-- component-authoring-checklist:end -->

These human reviews are required because tooling cannot decide whether a
component is drab, bulbous, ugly, poorly laid out, or built around the wrong
interaction model. Keep the durable outcome in the component's `*.a11y.md`;
pull-request discussion alone is not the record.

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
[#931](https://github.com/stevekinney/cinder/issues/931),
[#957](https://github.com/stevekinney/cinder/issues/957), and
[#968](https://github.com/stevekinney/cinder/issues/968).
