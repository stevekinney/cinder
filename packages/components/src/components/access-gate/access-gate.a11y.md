# AccessGate · accessibility

## Pattern

AccessGate communicates status or supporting context. Keep the message text concise, and choose the surrounding live-region behavior based on whether the condition is immediate, persistent, or purely informational.

Purpose: Authorization-scope gate that keeps unavailable actions visible with an accessible reason or replaces locked sections with a scope-required placeholder.

## Use when

- Showing a mutating action that the current user cannot activate because an application authorization scope is missing.
- Replacing a panel, tab, or administrative section with a lock state that names the missing scope or permission.

## Avoid when

- Checking browser permissions, media capabilities, or feature support — use capability-gate instead.
- Resolving roles, scopes, or policies — compute granted in application code and pass the boolean in.

## Keyboard and focus

Keyboard behavior follows the rendered native elements and any ARIA pattern documented by the component. Avoid adding handlers that change focus order without a matching visible and programmatic state update.

Keep focus indicators visible. If you wrap or restyle AccessGate, verify the focused element remains visually apparent in default and forced-colors modes.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When AccessGate accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render AccessGate in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Related components: `capability-gate`, `button`, `callout`, `empty-state`.
