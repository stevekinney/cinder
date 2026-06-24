# SubscriptionBadge · accessibility

## Pattern

SubscriptionBadge presents structured data. Preserve the component's semantic roles, row or item labels, and ordering so assistive technology can announce the same relationships that are visible on screen.

Purpose: Opinionated Badge variant that communicates billing subscription states with a standardized tone, icon, and human-readable label.

## Use when

- Displaying the billing state of a subscription in a dashboard, invoice list, or account settings page.
- Annotating a plan name, customer row, or invoice line with its current payment lifecycle state.

## Avoid when

- The subscription state is not one of the six recognized values — use Badge directly with a custom label instead.
- You need an interactive control that lets users change the state — use a Button or Select.

## Keyboard and focus

Keyboard behavior follows the rendered native elements and any ARIA pattern documented by the component. Avoid adding handlers that change focus order without a matching visible and programmatic state update.

Keep focus indicators visible. If you wrap or restyle SubscriptionBadge, verify the focused element remains visually apparent in default and forced-colors modes.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When SubscriptionBadge accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render SubscriptionBadge in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Related components: `badge`, `status-dot`, `chip`.
