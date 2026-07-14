# Segment · accessibility

## Pattern

Segment participates in form input or field composition. Pair each control with a visible label or an explicit accessible name, and connect validation text with the same relationship the component exposes.

Purpose: Individual option inside a SegmentedControl that renders either a selection button or a route-backed link with shared segmented styling.

## Use when

- Authoring SegmentedControl children declaratively so consumers can compose icons, labels, and badges per segment.
- Mixing disabled and enabled segments inside a single radiogroup/tablist where each segment carries its own metadata.
- Rendering route filters as real links inside `SegmentedControl variant="navigation"`.

## Avoid when

- Building a standalone toggle button — use Button or Toggle instead.
- Selecting one option from a long list — use Select or Combobox instead.

## Keyboard and focus

Keyboard behavior should follow the native control or documented ARIA pattern. Do not add extra key handlers that conflict with text entry, selection, or assistive-technology shortcuts.

Keep focus indicators visible. If you wrap or restyle Segment, verify the focused element remains visually apparent in default and forced-colors modes.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When Segment accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render Segment in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Related components: `segmented-control`, `button`, `toggle`.
