# Chat · accessibility

## Pattern

Chat packages a higher-level workflow. Confirm the composed controls, labels, states, and keyboard path match the domain task instead of treating the visual shell as the accessibility contract.

Purpose: Opinionated conversation surface bundling message list, composer, attachments, and scroll affordances for AI or support transcripts.

## Use when

- Shipping a full chat surface with composer, scroll-anchor, unread indicator, and attachments bundled as one heavyweight drop-in.
- Building an AI assistant or support thread where conversation state is modeled as a transcript of role-tagged messages.

## Avoid when

- Rendering a one-off message list — compose lighter primitives directly instead of pulling the full suite.
- The transcript is read-only and needs no composer — a simple list of message bubbles is a better fit.

## Keyboard and focus

Keyboard behavior follows the rendered native elements and any ARIA pattern documented by the component. Avoid adding handlers that change focus order without a matching visible and programmatic state update.

Keep focus indicators visible. If you wrap or restyle Chat, verify the focused element remains visually apparent in default and forced-colors modes.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When Chat accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render Chat in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Related components: `markdown-editor`.
