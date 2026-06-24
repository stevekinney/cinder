# ChoiceGrid · accessibility

## Pattern

ChoiceGrid participates in form input or field composition. Pair each control with a visible label or an explicit accessible name, and connect validation text with the same relationship the component exposes.

Purpose: Responsive grid of large selectable choices with roving keyboard focus, selection state, and optional correct/incorrect/pending feedback for quiz and assessment surfaces.

## Use when

- Presenting a small fixed set of large selectable answers where all options should stay visible (quiz or assessment surfaces).
- Building a touch-friendly selector grid with stable cell dimensions that must not shift when feedback states are applied.

## Avoid when

- Selecting from a long dynamic list — use combobox or select instead.
- Choosing one of two to five short values in a compact inline context — use segmented-control instead.

## Keyboard and focus

Keyboard behavior should follow the native control or documented ARIA pattern. Do not add extra key handlers that conflict with text entry, selection, or assistive-technology shortcuts.

Keep focus indicators visible. If you wrap or restyle ChoiceGrid, verify the focused element remains visually apparent in default and forced-colors modes.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When ChoiceGrid accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render ChoiceGrid in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Related components: `choice-grid-item`, `segmented-control`, `radio-group`, `checkbox-group`.
