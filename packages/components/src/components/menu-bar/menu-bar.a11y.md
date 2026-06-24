# MenuBar · accessibility

## Pattern

MenuBar helps users move through destinations or hierarchy. Keep link text and selected/current state accurate so keyboard and assistive-technology users get the same location cues as sighted pointer users.

Purpose: Command menubar for application chrome such as File, Edit, and View menus.

## Use when

- Building a desktop-style command menubar with dropdown command groups.
- Exposing top-level application menus that need arrow-key traversal and optional submenus.

## Avoid when

- Linking between routes or sections — use navigation-bar or side-navigation instead.
- Showing one standalone trigger with a menu — use dropdown, dropdown-menu, and dropdown-item directly.

## Keyboard and focus

The browser tab order should follow visual order. Use current/selected state only for the destination or item that is actually current.

Keep focus indicators visible. If you wrap or restyle MenuBar, verify the focused element remains visually apparent in default and forced-colors modes.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When MenuBar accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render MenuBar in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Related components: `navigation-bar`, `dropdown`, `dropdown-menu`, `dropdown-item`.
