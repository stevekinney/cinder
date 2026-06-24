# Kbd · accessibility

## Pattern

Kbd styles text content. Keep the underlying text meaningful, avoid using visual style as the only semantic cue, and preserve heading or label structure outside the component when needed.

Purpose: Inline element that styles a single keystroke or shortcut sequence with the semantic kbd tag.

## Use when

- Calling out a keyboard shortcut inline within prose or a tooltip.
- Composing chorded shortcuts by rendering multiple kbd elements side by side.

## Avoid when

- Displaying a block of source code — use code-block instead.

## Keyboard and focus

Keyboard behavior follows the rendered native elements and any ARIA pattern documented by the component. Avoid adding handlers that change focus order without a matching visible and programmatic state update.

Keep focus indicators visible. If you wrap or restyle Kbd, verify the focused element remains visually apparent in default and forced-colors modes.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When Kbd accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render Kbd in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Related components: `code-block`.
