# Surface · accessibility

## Pattern

Surface affects structure rather than meaning. Use it without removing headings, landmarks, labels, or reading order from the content it contains.

Purpose: Neutral background primitive that establishes a tonal layer for nested content and broadcasts its tone to descendants via context.

## Use when

- Wrapping a region in a consistent background tone such as default, raised, or sunken.
- Letting nested components adapt their styling based on the surrounding surface tone.

## Avoid when

- Building a self-contained content card with padding and elevation — use card instead.
- Standing up a full page scaffold with header and actions — use a hand-rolled page scaffold instead.

## Keyboard and focus

Keyboard behavior follows the rendered native elements and any ARIA pattern documented by the component. Avoid adding handlers that change focus order without a matching visible and programmatic state update.

Keep focus indicators visible. If you wrap or restyle Surface, verify the focused element remains visually apparent in default and forced-colors modes.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When Surface accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render Surface in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Related components: `card`.
