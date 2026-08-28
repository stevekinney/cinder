# CapabilityGate · accessibility

## Pattern

CapabilityGate communicates status or supporting context. Keep the message text concise, and choose the surrounding live-region behavior based on whether the condition is immediate, persistent, or purely informational.

Purpose: Present feature availability and next action for browser permission or support states, with accessible status text and focus management.

## Use when

- Surfacing that a feature requires a browser permission such as microphone or notifications.
- Communicating that a feature is unsupported in the current browser with a clear fallback path.

## Avoid when

- Performing the actual feature detection or permission request — wire that in userland.
- Storing permission state — CapabilityGate is a pure presentation component.

## Keyboard and focus

Keyboard behavior follows the rendered native elements and any ARIA pattern documented by the component. Avoid adding handlers that change focus order without a matching visible and programmatic state update.

Keep focus indicators visible. If you wrap or restyle CapabilityGate, verify the focused element remains visually apparent in default and forced-colors modes.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When CapabilityGate accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

### Review outcome

Reviewed 2026-08-28. Nearest neighbours are Alert, Banner, Callout, and Modal. Limited permission belongs in CapabilityGate because it is an availability state that shares the component's action and dismissal model. It uses the existing warning surface rather than danger styling, distinguishing constrained access from denial. Keyboard and focus behavior are unchanged; consumer actions retain the existing focus contract. The polite status region announces “Limited permission.” There is no new motion, and token-based styling remains compatible with forced colors.

`permission-limited` is a granted-but-constrained state. It uses the warning presentation and the same polite status announcement as other non-error states; it must not be announced or styled as a denial.

- Render CapabilityGate in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Related components: `alert`, `banner`, `callout`, `modal`.
