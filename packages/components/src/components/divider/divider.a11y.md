# Divider · accessibility

## Pattern

Divider affects structure rather than meaning. Use it without removing headings, landmarks, labels, or reading order from the content it contains.

Purpose: Thin decorative or semantic separator between content regions, with optional vertical orientation and tonal variants.

## Use when

- Visually separating sections of a card, list, or toolbar without adding heading-level structure.
- Splitting a row of inline controls (e.g. a button-group toolbar) with a vertical rule.

## Avoid when

- The split between sections deserves a heading — use section-heading instead.
- Wrapping the entire viewport edge — use surface or a hand-rolled page scaffold instead.

## Keyboard and focus

Keyboard behavior follows the rendered native elements and any ARIA pattern documented by the component. Avoid adding handlers that change focus order without a matching visible and programmatic state update.

Keep focus indicators visible. If you wrap or restyle Divider, verify the focused element remains visually apparent in default and forced-colors modes.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When Divider accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render Divider in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Related components: `surface`, `section-heading`.
