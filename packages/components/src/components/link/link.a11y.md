# Link · accessibility

## Pattern

Link styles text content. Keep the underlying text meaningful, avoid using visual style as the only semantic cue, and preserve heading or label structure outside the component when needed.

Purpose: Inline text link with consistent focus ring and underline behavior.

## Use when

- Embedding a navigable link inside body text or prose content.

## Avoid when

- Navigating between pages in a sidebar or nav bar — use NavigationItem.

## Keyboard and focus

Keyboard behavior follows the rendered native elements and any ARIA pattern documented by the component. Avoid adding handlers that change focus order without a matching visible and programmatic state update.

Keep focus indicators visible. If you wrap or restyle Link, verify the focused element remains visually apparent in default and forced-colors modes.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When Link accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render Link in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Related components: `navigation-item`, `button`, `breadcrumbs`.
