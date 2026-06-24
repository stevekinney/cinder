# SpeedDialAction · accessibility

## Pattern

SpeedDialAction exposes an operable control surface. Prefer the native interactive element it renders, keep the accessible name specific to the action, and do not replace it with a non-interactive wrapper.

Purpose: Quick-action leaf for SpeedDial that closes the owning dial after activation.

## Use when

- Rendering a secondary quick action inside SpeedDial.

## Avoid when

- Rendering an action outside SpeedDial - use floating-action-button directly.

## Keyboard and focus

Activation should work with the native Enter and Space behavior of the rendered control. Custom children must not swallow those events unless they replace the whole interaction intentionally.

Keep focus indicators visible. If you wrap or restyle SpeedDialAction, verify the focused element remains visually apparent in default and forced-colors modes.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When SpeedDialAction accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render SpeedDialAction in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Related components: `speed-dial`, `floating-action-button`.
