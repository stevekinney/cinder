# Card · accessibility

## Pattern

Card affects structure rather than meaning. Use it without removing headings, landmarks, labels, or reading order from the content it contains.

Purpose: Surface container that groups related content with optional header, title, description, and footer regions.

## Use when

- Grouping a self-contained unit of content such as a summary, preview, or settings panel.
- Composing a list of comparable items where each needs its own framed region.

## Avoid when

- Rendering a bare visual surface without slotted regions — use surface instead.
- Presenting a single key metric — use stat or stat-group instead.

## Keyboard and focus

Keyboard behavior follows the rendered native elements and any ARIA pattern documented by the component. Avoid adding handlers that change focus order without a matching visible and programmatic state update.

Keep focus indicators visible. If you wrap or restyle Card, verify the focused element remains visually apparent in default and forced-colors modes.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

Cards with a generated `title` default to `role="group"` and are labelled by that heading. Caller-supplied `role` and `aria-labelledby` values are preserved. If `description` is present, the root is described by that text and any caller-supplied `aria-describedby` ids. `tone="danger"` adds a visible icon next to the generated title as a non-color risk signal; the icon is hidden from assistive technology because the danger meaning must be communicated in the title, description, and action labels.

Use `tone="danger"` for high-risk settings and destructive actions where the container itself needs to communicate risk. Keep the actual control semantics inside the card native: use `Toggle` for immediate on/off settings, `Button` for commands, and `ConfirmDialog` for irreversible or broad-scope confirmation flows.

When Card accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render Card in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Related components: `surface`, `stat`, `stacked-list-item`, `section-heading`.
