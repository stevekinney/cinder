# Documentation

This directory holds long-form documentation that does not live inside a component's own folder: consumer references, cross-cutting policies, recipes, visual-regression notes, decisions, and historical plans.

## Consumer References

- [Packaging contract](./packaging.md): npm tarball contents, conditional exports, and CSS consumption modes.
- [Design tokens](./tokens.md): public `--cinder-*` tokens and their defaults.
- [Theming and dark mode](./theming.md): the `color-scheme` / `light-dark()` contract, a Svelte toggle recipe, and Storybook integration.
- [Recipes](./recipes/README.md): copy-paste patterns that compose existing primitives.

## Policies and Audits

- [Focus ring policy](./focus-ring-policy.md): approved `:focus-visible` strategies and enforcement.
- [Visual-regression baselines](./visual-regression/baselines.md): snapshot authoring, Docker requirements, and block-mode behavior.
- [Visual-regression inventory](./visual-regression/phase-0-inventory.md): read-only discovery behind the visual-regression rollout.
- [Design debt](./design-debt.md): resolved design decisions retained so future work does not reopen the same product questions.
- [Validation topology](./validation-topology.md): what commit/push/PR CI/main-green/release each run, why the boundaries sit where they do, and the guardrails that keep them honest.

## Decisions

- [Data grid buy-vs-build](./decisions/data-grid-buy-vs-build.md): evaluation record for data-grid dependency choices.
- [Segmented control tablist variant](./decisions/segmented-control-tablist-variant.md): decision record for the tablist-style segmented-control follow-up.

## Historical Plans

- [Phase 6 plan](./phase-6-plan.md): historical implementation plan for porting the domain-suite components.
- [Roadmap](../ROADMAP.md): historical design-system backlog. Prefer `packages/components/components.json` and the generated component READMEs for current package surface.
