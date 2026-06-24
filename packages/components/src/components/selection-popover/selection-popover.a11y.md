# SelectionPopover · accessibility

## Pattern

SelectionPopover presents layered content. Keep trigger, focus movement, dismissal, and labelling in one predictable interaction path so users can enter and leave the layer without losing context.

Purpose: Floating toolbar anchored to a text selection that exposes a comment-on-selection action with an inline composer.

## Use when

- Letting readers annotate or comment on a highlighted range of text in a document or article surface.
- Surfacing selection-scoped actions such as quote, share, or comment near the user's pointer.

## Avoid when

- Anchoring generic non-selection content to a trigger — use popover.
- Building a general-purpose floating toolbar unrelated to text selection — compose a popover with custom controls.

## Keyboard and focus

The trigger should remain reachable by keyboard, and the open layer should provide a clear Escape, close, or outside-interaction path consistent with the component documentation.

Keep focus indicators visible. If you wrap or restyle SelectionPopover, verify the focused element remains visually apparent in default and forced-colors modes.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When SelectionPopover accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render SelectionPopover in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Related components: `popover`.
