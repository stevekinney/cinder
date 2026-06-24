# PermissionMatrix · accessibility

## Pattern

PermissionMatrix presents structured data. Preserve the component's semantic roles, row or item labels, and ordering so assistive technology can announce the same relationships that are visible on screen.

Purpose: Categorical permission matrix for scanning discrete access states across scopes and operations.

## Use when

- Showing whether scopes, roles, or policy categories grant specific operations.
- Each cell represents a discrete state such as granted, denied, or not applicable.

## Avoid when

- Showing numeric density or magnitude across two categorical dimensions — use matrix-chart instead.
- Rendering editable permissions — use a purpose-built form or data-grid instead.

## Keyboard and focus

Native table reading order is the keyboard contract. Sort controls, when present, are real buttons inside header cells and use `aria-sort` on the header cell.

Keep focus indicators visible. If you wrap or restyle PermissionMatrix, verify the focused element remains visually apparent in default and forced-colors modes.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When PermissionMatrix accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render PermissionMatrix in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Related components: `matrix-chart`, `data-grid`, `table`.
