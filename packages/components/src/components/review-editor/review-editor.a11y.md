# ReviewEditor · accessibility

## Pattern

ReviewEditor packages a higher-level workflow. Confirm the composed controls, labels, states, and keyboard path match the domain task instead of treating the visual shell as the accessibility contract.

Purpose: Markdown editor extended with inline review threads, anchored comments, and collaborative annotation state.

## Use when

- Building a document review experience that needs both a Markdown editor and anchored comment threads in one bundled surface.
- Threading reviewer commentary against specific selections inside a long-form document.

## Avoid when

- Plain authoring with no review threads — markdown-editor is the lighter primitive.
- Reviewing diffs between two documents rather than annotating one — use diff-viewer instead.

## Keyboard and focus

Keyboard behavior follows the rendered native elements and any ARIA pattern documented by the component. Avoid adding handlers that change focus order without a matching visible and programmatic state update.

Keep focus indicators visible. If you wrap or restyle ReviewEditor, verify the focused element remains visually apparent in default and forced-colors modes.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When ReviewEditor accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render ReviewEditor in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Related components: `markdown-editor`.
