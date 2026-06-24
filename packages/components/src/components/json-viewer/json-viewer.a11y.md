# JsonViewer · accessibility

## Pattern

JsonViewer presents structured data. Preserve the component's semantic roles, row or item labels, and ordering so assistive technology can announce the same relationships that are visible on screen.

Purpose: Collapsible tree visualization of an arbitrary JSON value with hard depth and byte caps and a fallback for oversized payloads.

## Use when

- Inspecting structured API responses, debug payloads, or configuration documents inside an admin or developer surface.
- Rendering a JSON-serializable value with predictable initial-collapse behavior and no virtualization needs.

## Avoid when

- The payload is large enough to need search, filter, or virtualization — compose a custom viewer instead.
- Showing arbitrary source code rather than a JSON value — code-block is the right surface for that.

## Keyboard and focus

Keyboard behavior follows the rendered native elements and any ARIA pattern documented by the component. Avoid adding handlers that change focus order without a matching visible and programmatic state update.

Keep focus indicators visible. If you wrap or restyle JsonViewer, verify the focused element remains visually apparent in default and forced-colors modes.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When JsonViewer accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render JsonViewer in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Related components: `code-block`, `tree`.
