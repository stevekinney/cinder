# Meter · accessibility

## Pattern

Meter communicates a bounded measurement whose value can rise and fall over time.

Purpose: Bounded measurement gauge with meter semantics for readings like battery, quota, CPU, and memory utilization.

## Use when

- Showing a fluctuating value within a known minimum and maximum range.
- Communicating low/optimal/high regions of a bounded measurement.

## Avoid when

- Reporting task completion over time such as uploads/imports — use progress.

## Keyboard and focus

Keyboard behavior follows the rendered native elements and any ARIA pattern documented by the component. Avoid adding handlers that change focus order without a matching visible and programmatic state update.

Keep focus indicators visible. If you wrap or restyle Meter, verify the focused element remains visually apparent in default and forced-colors modes.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When Meter accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render Meter in the playground or a focused test fixture.
- Inspect the accessible name, role, and value state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Related components: `progress`, `stat`, `slider`.
