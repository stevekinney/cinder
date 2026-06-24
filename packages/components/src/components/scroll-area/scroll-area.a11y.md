# ScrollArea · accessibility

## Pattern

ScrollArea affects structure rather than meaning. Use it without removing headings, landmarks, labels, or reading order from the content it contains.

Purpose: Bounded scrolling container that constrains overflowing content within a max height or width while remaining keyboard-focusable.

## Use when

- Containing a long list or large block of content inside a fixed-size region.
- Preserving keyboard scrollability for overflow content in a card or surface.

## Avoid when

- Wrapping the entire page — let the document scroll natively.
- Hiding overflow without scrollbars — use plain CSS overflow utilities instead.

## Keyboard and focus

Keyboard behavior follows the rendered native elements and any ARIA pattern documented by the component. Avoid adding handlers that change focus order without a matching visible and programmatic state update.

Keep focus indicators visible. If you wrap or restyle ScrollArea, verify the focused element remains visually apparent in default and forced-colors modes.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When ScrollArea accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render ScrollArea in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Related components: `surface`.
