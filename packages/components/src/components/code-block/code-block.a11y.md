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

## scrollFadeVisible (Tier 3 polish)

`scrollFadeVisible` paints an opaque, INTENTIONALLY TRANSLUCENT (~35% alpha,
not fully opaque) scroll-driven fade on both inline edges of the code
viewport as a long line overflows — a fully opaque cover would hide a
partial glyph entirely, reading as a hard cutoff rather than "this line
continues." It is presentation-only and never the sole signal that a line
overflows — `overflow-x: auto` and the native/themed scrollbar remain the
authoritative, always-present affordance. `:dir(rtl)` flips the paint
direction only (`scroll(nearest inline)` is already direction-correct); see
`_scroll-fade.css`. `@media (forced-colors: active)` disables the fade
outright. It does not change keyboard scrollability (`tabindex="0"` on the
viewport, unaffected) or the copy-button/language-label semantics documented
above.

Related components: `kbd`, `copy-button`.
