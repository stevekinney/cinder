# DiffViewer · accessibility

## Pattern

DiffViewer packages a higher-level workflow. Confirm the composed controls, labels, states, and keyboard path match the domain task instead of treating the visual shell as the accessibility contract.

Purpose: Side-by-side or unified Markdown diff surface with hunk grouping, word-level inline changes, and size-based debounce gating.

## Use when

- Comparing two Markdown documents and wanting the bundled toolbar, view-mode toggle, front-matter handling, and large-payload safeguards.
- Building a review workflow that needs hunked, line-anchored Markdown diffs out of the box as a heavyweight suite.

## Avoid when

- Showing only a counts summary — use diff-statistics on its own for a lightweight presentation.
- Diffing non-Markdown source code where syntax-aware highlighting matters more than prose-aware rendering.

## Keyboard and focus

Keyboard behavior follows the rendered native elements and any ARIA pattern documented by the component. Avoid adding handlers that change focus order without a matching visible and programmatic state update.

Keep focus indicators visible. If you wrap or restyle DiffViewer, verify the focused element remains visually apparent in default and forced-colors modes.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When DiffViewer accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render DiffViewer in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Related components: `diff-statistics`, `code-block`.
