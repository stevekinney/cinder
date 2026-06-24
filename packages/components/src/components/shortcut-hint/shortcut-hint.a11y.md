# ShortcutHint · accessibility

## Pattern

ShortcutHint styles text content. Keep the underlying text meaningful, avoid using visual style as the only semantic cue, and preserve heading or label structure outside the component when needed.

Purpose: Inline shortcut hint that renders a key combo via Kbd alongside an action label, with an accessible text representation not reliant on visual keycaps alone.

## Use when

- Showing a keyboard shortcut inline beside a label in a toolbar button, menu item, or tooltip.
- Pairing with command-palette items to surface available shortcuts.

## Avoid when

- Displaying a full shortcut reference table — use keyboard-shortcuts instead.

## Keyboard and focus

Keyboard behavior follows the rendered native elements and any ARIA pattern documented by the component. Avoid adding handlers that change focus order without a matching visible and programmatic state update.

Keep focus indicators visible. If you wrap or restyle ShortcutHint, verify the focused element remains visually apparent in default and forced-colors modes.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When ShortcutHint accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render ShortcutHint in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Related components: `kbd`, `keyboard-shortcuts`, `tooltip`.
