# AspectRatio · accessibility

## Pattern

AspectRatio affects structure rather than meaning. Use it without removing headings, landmarks, labels, or reading order from the content it contains.

Purpose: Generic media box that enforces a fixed aspect ratio for arbitrary embedded content using the native CSS aspect-ratio property.

## Use when

- Reserving stable space for embedded media, previews, or art-directed content before it loads.
- You need a generic ratio wrapper for iframe, video, canvas, or custom content rather than an image-specific primitive.

## Avoid when

- The child already owns its sizing contract and should determine its own height naturally.
- Supporting legacy browsers that lack native aspect-ratio support.

## Keyboard and focus

Keyboard behavior follows the rendered native elements and any ARIA pattern documented by the component. Avoid adding handlers that change focus order without a matching visible and programmatic state update.

Keep focus indicators visible. If you wrap or restyle AspectRatio, verify the focused element remains visually apparent in default and forced-colors modes.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When AspectRatio accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render AspectRatio in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Related components: `image`, `card`.
