# CommandItem · accessibility

## Pattern

CommandItem exposes an operable control surface. Prefer the native interactive element it renders, keep the accessible name specific to the action, and do not replace it with a non-interactive wrapper.

Purpose: Single selectable row inside a command palette or inline command menu that registers itself with the parent command list.

## Use when

- Declaring an individual command, action, or result row inside a command-palette or command-menu.
- Composing a custom palette layout via children rather than the items prop.

## Avoid when

- Used outside a command-palette or command-menu ancestor — the component throws at construction.
- Rendering a generic dropdown choice — use dropdown-item instead.

## Keyboard and focus

Activation should work with the native Enter and Space behavior of the rendered control. Custom children must not swallow those events unless they replace the whole interaction intentionally.

Keep focus indicators visible. If you wrap or restyle CommandItem, verify the focused element remains visually apparent in default and forced-colors modes.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When CommandItem accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render CommandItem in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Related components: `command-palette`, `command-menu`, `dropdown-item`.
