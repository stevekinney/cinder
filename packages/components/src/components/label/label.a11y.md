# Label · accessibility

## Pattern

Label participates in form input or field composition. Pair each control with a visible label or an explicit accessible name, and connect validation text with the same relationship the component exposes.

Purpose: Standalone label primitive that associates text with a custom control via for and matches the visual treatment of built-in inputs.

## Use when

- Building a hand-rolled field that wraps multiple inputs needing one shared label.
- Matching the disabled or required visual treatment of cinder inputs on a custom control.

## Avoid when

- Labelling a built-in input that already renders its own label prop — pass label instead.

## Keyboard and focus

Keyboard behavior should follow the native control or documented ARIA pattern. Do not add extra key handlers that conflict with text entry, selection, or assistive-technology shortcuts.

Keep focus indicators visible. If you wrap or restyle Label, verify the focused element remains visually apparent in default and forced-colors modes.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When Label accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render Label in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Related components: `form-field`, `input`, `checkbox`, `radio-group`.
