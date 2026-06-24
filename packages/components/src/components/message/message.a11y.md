# Message · accessibility

## Pattern

Message presents structured data. Preserve the component's semantic roles, row or item labels, and ordering so assistive technology can announce the same relationships that are visible on screen.

Purpose: Chat-style bubble that renders a role label, optional timestamp, and arbitrary body content for transcript or run-stream views.

## Use when

- Composing a transcript of user, assistant, and system turns outside the full chat suite.
- Rendering AI agent runs, support threads, or audit logs where each entry has a speaker and a body.

## Avoid when

- Building a complete conversation surface with composer and scroll affordances — reach for the chat suite instead.
- Communicating a single non-conversational notice — callout is more appropriate.

## Keyboard and focus

Keyboard behavior follows the rendered native elements and any ARIA pattern documented by the component. Avoid adding handlers that change focus order without a matching visible and programmatic state update.

Keep focus indicators visible. If you wrap or restyle Message, verify the focused element remains visually apparent in default and forced-colors modes.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When Message accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render Message in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Related components: `chat`, `callout`.
