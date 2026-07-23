# MarkdownEditor · accessibility

## Pattern

MarkdownEditor packages a higher-level workflow. Confirm the composed controls, labels, states, and keyboard path match the domain task instead of treating the visual shell as the accessibility contract.

Purpose: Rich Markdown editing surface bundling a Milkdown-powered ProseMirror editor, toolbar, and mark or block introspection helpers.

## Use when

- Composing or editing Markdown documents and wanting the bundled toolbar, link-aware selection, and source or WYSIWYG mode toggle.
- Building writing surfaces that need an editor handle for programmatic mark or block manipulation as part of the heavyweight suite.

## Avoid when

- Authoring a simple plain-text note — a textarea is dramatically lighter than the Milkdown bundle.
- The surface needs inline review threads on top of the editor — use review-editor for that composition.

## Keyboard and focus

Keyboard behavior follows the rendered native elements and any ARIA pattern documented by the component. Avoid adding handlers that change focus order without a matching visible and programmatic state update.

Keep focus indicators visible. If you wrap or restyle MarkdownEditor, verify the focused element remains visually apparent in default and forced-colors modes.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When MarkdownEditor accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render MarkdownEditor in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Related components: `review-editor`, `code-block`.
