# HoverCard · accessibility

## Pattern

HoverCard presents layered content. Keep trigger, focus movement, dismissal, and labelling in one predictable interaction path so users can enter and leave the layer without losing context.

Purpose: Hover-and-focus triggered rich preview card for non-interactive contextual content.

## Use when

- Showing a profile, issue, or metadata preview that is richer than a tooltip but still read-only.
- Revealing supplementary preview content on pointer hover or keyboard focus without moving focus.

## Avoid when

- The floating content contains focusable controls — use popover.
- The trigger needs a short accessible description — use tooltip.

## Keyboard and focus

The trigger should remain reachable by keyboard, and the open layer should provide a clear Escape, close, or outside-interaction path consistent with the component documentation.

Keep focus indicators visible. If you wrap or restyle HoverCard, verify the focused element remains visually apparent in default and forced-colors modes.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When HoverCard accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render HoverCard in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Related components: `tooltip`, `popover`.
