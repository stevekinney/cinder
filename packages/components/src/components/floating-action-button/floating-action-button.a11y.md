# FloatingActionButton · accessibility

## Pattern

FloatingActionButton exposes an operable control surface. Prefer the native interactive element it renders, keep the accessible name specific to the action, and do not replace it with a non-interactive wrapper.

Purpose: Circular button representing the single most important action on a screen.

## Use when

- One action dominates the page purpose (compose, add, create).

## Avoid when

- Multiple equally-important actions exist — use a toolbar or button group.
- You need it pinned to the viewport — it doesn't position itself; wrap it in your own fixed/sticky container.

## Keyboard and focus

Activation should work with the native Enter and Space behavior of the rendered control. Custom children must not swallow those events unless they replace the whole interaction intentionally.

Keep focus indicators visible. If you wrap or restyle FloatingActionButton, verify the focused element remains visually apparent in default and forced-colors modes.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When FloatingActionButton accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render FloatingActionButton in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Related components: `button`, `toolbar`.
