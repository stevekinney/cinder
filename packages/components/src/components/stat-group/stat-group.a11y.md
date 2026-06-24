# StatGroup · accessibility

## Pattern

StatGroup presents structured data. Preserve the component's semantic roles, row or item labels, and ordering so assistive technology can announce the same relationships that are visible on screen.

Purpose: Grid container that arranges a set of stat tiles into a responsive multi-column layout with shared labelling.

## Use when

- Showing a row of related stat tiles such as the top metrics of a dashboard.
- Giving a cluster of stat entries a single accessible group label.

## Avoid when

- Rendering exactly one metric — use stat on its own.
- Building a freeform card grid unrelated to numeric metrics — compose surface or grid-list directly.

## Keyboard and focus

Keyboard behavior follows the rendered native elements and any ARIA pattern documented by the component. Avoid adding handlers that change focus order without a matching visible and programmatic state update.

Keep focus indicators visible. If you wrap or restyle StatGroup, verify the focused element remains visually apparent in default and forced-colors modes.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When StatGroup accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render StatGroup in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Related components: `stat`.
