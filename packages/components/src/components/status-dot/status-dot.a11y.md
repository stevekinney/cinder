# StatusDot · accessibility

## Pattern

StatusDot communicates status or supporting context. Keep the message text concise, and choose the surrounding live-region behavior based on whether the condition is immediate, persistent, or purely informational.

Purpose: Static role="img" badge that communicates an entity's state through a colored dot with an accessible text label.

## Use when

- Indicating the current state of a list row, user, deployment, or other entity alongside its name.
- Communicating status compactly when many indicators appear together without triggering live-region announcements.

## Avoid when

- Counting items or showing a numeric value — use badge instead.
- Announcing a transient status change — use toast-region or alert so assistive tech reads it.

## Keyboard and focus

Keyboard behavior follows the rendered native elements and any ARIA pattern documented by the component. Avoid adding handlers that change focus order without a matching visible and programmatic state update.

Keep focus indicators visible. If you wrap or restyle StatusDot, verify the focused element remains visually apparent in default and forced-colors modes.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When StatusDot accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render StatusDot in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Related components: `badge`.
