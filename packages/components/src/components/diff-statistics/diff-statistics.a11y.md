# DiffStatistics · accessibility

## Pattern

DiffStatistics packages a higher-level workflow. Confirm the composed controls, labels, states, and keyboard path match the domain task instead of treating the visual shell as the accessibility contract.

Purpose: Compact added, removed, and modified line-count summary that accompanies a Markdown diff view.

## Use when

- Surfacing a quick numeric summary of changes alongside or in lieu of a full diff surface.
- Annotating a list of files or pull requests with line-change counts as part of the diff-viewer suite.

## Avoid when

- Rendering the actual hunked diff content — pair with diff-viewer for the full document comparison.
- Generic numeric badges that have nothing to do with diffs — reach for stat or badge instead.

## Keyboard and focus

Keyboard behavior follows the rendered native elements and any ARIA pattern documented by the component. Avoid adding handlers that change focus order without a matching visible and programmatic state update.

Keep focus indicators visible. If you wrap or restyle DiffStatistics, verify the focused element remains visually apparent in default and forced-colors modes.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When DiffStatistics accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render DiffStatistics in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Related components: `diff-viewer`.
