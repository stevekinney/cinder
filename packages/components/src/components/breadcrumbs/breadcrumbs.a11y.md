# Breadcrumbs · accessibility

## Pattern

Breadcrumbs helps users move through destinations or hierarchy. Keep link text and selected/current state accurate so keyboard and assistive-technology users get the same location cues as sighted pointer users.

Purpose: Hierarchical wayfinding trail showing the ancestor path of the current page with the final entry marked as aria-current.

## Use when

- Surfacing where the user sits inside a deep, nested hierarchy.
- Letting the user jump back to any ancestor view in one click.

## Avoid when

- Switching between sibling sections at the same level — use navigation-bar or tabs.
- Showing an ordered task progression — use steps instead.

## Keyboard and focus

The browser tab order should follow visual order. Use current/selected state only for the destination or item that is actually current.

Keep focus indicators visible. If you wrap or restyle Breadcrumbs, verify the focused element remains visually apparent in default and forced-colors modes.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When Breadcrumbs accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render Breadcrumbs in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Related components: `navigation-bar`, `side-navigation`, `steps`.
