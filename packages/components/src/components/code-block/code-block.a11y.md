# CodeBlock · accessibility

## Pattern

CodeBlock presents structured data. Preserve the component's semantic roles, row or item labels, and ordering so assistive technology can announce the same relationships that are visible on screen.

Purpose: Block container for multi-line source code with automatic syntax highlighting and a copy-to-clipboard control.

## Use when

- Displaying a multi-line code sample or terminal transcript inside documentation or chat.
- Letting the reader copy a snippet to the clipboard via the copyable prop.

## Avoid when

- Annotating a single inline keystroke or shortcut — use kbd instead.
- Rendering rich prose that happens to include code — embed it in markdown instead.

## Keyboard and focus

Keyboard behavior follows the rendered native elements and any ARIA pattern documented by the component. Avoid adding handlers that change focus order without a matching visible and programmatic state update.

Keep focus indicators visible. If you wrap or restyle CodeBlock, verify the focused element remains visually apparent in default and forced-colors modes.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When CodeBlock accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render CodeBlock in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Related components: `kbd`, `copy-button`.
