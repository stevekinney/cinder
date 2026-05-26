# [SegmentedControl](../../packages/components/src/components/segmented-control/segmented-control.svelte) tablist variant decision

Task id: `a55a410f-a0e2-4705-a7c6-ff429ab914c1`
Task base commit: 19b1545b527d1382cb762ea20877c294fd673ff0

This document records the decision for whether
`SegmentedControl variant="tablist"` should become a real visual variant or be
removed. **No component, CSS, ARIA, keyboard, or screenshot-baseline change ships
from this decision task.** The follow-up implementation task is `eef4318f`:
"Execute tablist variant decision."

## Decision

Keep `variant="tablist"` and implement it as a real visual variant in the
follow-up task. This is Option A from the task: keep the prop and add the
missing tab-strip treatment instead of removing the API.

The prop is not a no-op. It already switches the control from radio semantics
to tab semantics:

- the SegmentedControl container role becomes `tablist`
- each Segment role becomes `tab`
- selected state moves from `aria-checked` to `aria-selected`
- Segment `controls` values are emitted as `aria-controls`

The missing piece is visual, not semantic. Today the tablist variant looks like
the default radiogroup variant: a surface-inset container with a filled pill
selected state. The follow-up should make the visual affordance match the
existing semantics: no surface-inset container background, no enclosing border,
and an underline-style selected indicator.

## Why not remove it?

Removing the prop would delete the only
[cinder](../../README.md)-owned way to express tab semantics for panels that are
not owned by the tab component.

The [review editor](../../packages/components/src/components/review-editor/review-editor-controls.svelte)
is the concrete first-party use case. Its controls switch between editor, diff,
and summary views. Those panels are rendered elsewhere in the layout and are
connected by ID, so cinder
[`Tabs`](../../packages/components/src/components/tabs/tabs.svelte) is the wrong
abstraction: `Tabs` owns its `Tabs.Panel` children. A plain SegmentedControl is
also wrong: it exposes radio-button semantics and cannot wire `aria-controls`
for visible panel switching.

`variant="tablist"` is the bridge between those two primitives: a picker-shaped
control with tab semantics for externally owned panels.

## [Toolbar](../../packages/components/src/components/toolbar/toolbar.svelte) relationship

Toolbar does not replace this variant.

Toolbar is a focus-management container for groups of controls. It answers:
"How does focus move across these controls as a toolbar?" It does not answer:
"Which control owns `role="tab"`, `aria-selected`, and `aria-controls` for the
currently visible panel?"

The review editor already composes the two concepts: a `role="toolbar"` wrapper
contains a `SegmentedControl variant="tablist"` for the editor/diff/summary
view picker. That composition is intentional. Toolbar should wrap the tablist
control; it should not subsume the tablist semantics.

## Follow-up implementation scope

Task `eef4318f` should implement this decision only. It should not remove the
prop, re-architect Tabs, add panel ownership to SegmentedControl, or change
Toolbar.

The implementation should:

- add CSS scoped to
  `.cinder-segmented-control[data-cinder-variant="tablist"]`
- remove the surface-inset background and enclosing border for the tablist
  container only
- replace the filled selected pill with an accent-colored indicator on the
  block-end edge for horizontal tablists
- use an inline-start indicator for vertical tablists
- suppress connected-bar separators for tablists
- preserve the existing focus-visible treatment
- keep radiogroup and multiple-selection visuals unchanged
- add the in-source comment at the `groupRole` derivation pointing back to this
  decision
- add regression coverage for the visual contract and the toolbar-nested review
  editor composition

The follow-up should use existing design tokens such as `--cinder-accent`,
`--cinder-border-muted`, spacing variables, and radius variables already used by
the component CSS. It should not add new tokens unless the implementation proves
there is a real token gap.

The source comment should use this canonical pointer:

```ts
// See docs/decisions/segmented-control-tablist-variant.md for why tablist remains a SegmentedControl variant.
```

## Accessibility guardrails

The intended implementation is CSS-first. It should not change the existing ARIA
or keyboard code unless a required test proves the current semantics are wrong.

The follow-up must keep the existing tablist ARIA tests green and add explicit
assertions that:

- horizontal tablists move the active tab with ArrowRight and ArrowLeft
- vertical tablists expose `aria-orientation="vertical"`
- vertical tablists move the active tab with ArrowDown and ArrowUp
- in the review editor toolbar composition, arrow-key interaction changes the
  active tab exactly once, keeps focus inside the tablist, and is not stolen by
  the outer toolbar

If those assertions fail against the current code, `eef4318f` should stop and
file a separate accessibility-prerequisite task before landing the visual work.
The CSS should not advertise tab semantics that the interaction model does not
actually satisfy.

## Verification for the follow-up

The follow-up should run the focused component and browser verification already
used by this repository, including:

```bash
bun run --filter @cinder/testing test:playwright
bun run --filter @cinder/testing test:browser:update
```

If the existing baselines were generated with the containerized update command,
use the matching [Docker](https://www.docker.com/) baseline update script instead
so the screenshot diff is stable:

```bash
bun run --filter @cinder/testing test:browser:update:docker
```

Only screenshot baselines for segmented-control and review-editor should change.
Because segmented-control screenshots contain multiple variants in one image,
the guard is region-based: the tablist region should change, while radiogroup
and multiple-selection regions should remain visually unchanged. Baselines
outside the segmented-control and review-editor screenshot directories should
not change.

## Rejected option

Removing `variant="tablist"` is rejected.

That path would be a breaking API and accessibility change. It would force the
review editor either into plain radio semantics, which are wrong for visible
panel switching, or into cinder `Tabs`, which would require restructuring the
editor layout so the tabs component owns panels that are currently rendered
elsewhere. The motivating problem is fixable with scoped CSS, so removal is
larger, riskier, and worse for the existing consumer.

If maintainers later decide to remove the prop anyway, that should be a separate
breaking-removal task with its own plan, tests, migration of review-editor,
accessibility verification, and changeset. It is not the path approved by this
decision.
