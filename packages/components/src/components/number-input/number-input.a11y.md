# Number Input — accessibility

`number-input.svelte` is a locale-aware numeric textbox with explicit increment/decrement stepper
buttons. It deliberately departs from the `role="spinbutton"` pattern.

## Role decision: textbox, not spinbutton

The visible input is a real `<input type="text" inputmode="decimal">` and keeps its native
`textbox` role. The component does **not** set `role="spinbutton"`, `aria-valuemin`, `aria-valuemax`,
or `aria-valuenow`.

Rationale:

- `aria-valuemin` / `aria-valuemax` / `aria-valuenow` belong to range widgets
  (`spinbutton`, `slider`, `progressbar`, `meter`, `scrollbar`). Applying them to a `textbox` is
  invalid ARIA and gets flagged by axe and Lighthouse.
- `role="spinbutton"` overrides the native textbox role. Screen readers stop announcing the
  editable-text affordance, which is exactly the affordance we want users to hear.
- The WAI-ARIA spinbutton pattern assumes a custom widget with hand-rolled keyboard handling.
  This control is a real `<input>` that gets textbox semantics natively.
- GitHub Primer, Adobe Spectrum, Radix, and Mantine all ship their number inputs as plain
  textboxes for the same reasons.

Range information is exposed through:

- Consumer-authored label / description text ("Quantity, between 1 and 99").
- Explicit `aria-label="Increment"` / `aria-label="Decrement"` on the stepper buttons.
- `aria-invalid` + the error region when the consumer flags out-of-range.
- Native `:invalid` styling driven by `setCustomValidity` for `required` and malformed cases.

## Keyboard

The visible input handles a small set of keys:

- **ArrowUp / ArrowDown**: increment or decrement by `step` (default 1).
- **PageUp / PageDown**: ±10 × `step`.
- **Home / End**: jump to `min` / `max` when those bounds are finite (no-op when infinite).
- **Enter**: commit the typed value and submit the enclosing form if it's valid; otherwise call
  `form.reportValidity()`.

`preventDefault` is called for ArrowUp/Down, PageUp/Down, and Home/End so caret movement does not
collide with stepping.

## Stepper buttons

- Two `<button type="button">`. `type="button"` matters inside a form — without it, clicking either
  button submits the form.
- Visible glyphs (`+` and U+2212 minus) are `aria-hidden="true"`; the accessible name comes from
  `aria-label="Increment"` / `aria-label="Decrement"`.
- Stepper buttons use the native `disabled` attribute at boundaries — not `aria-disabled`. This
  removes them from the tab order, which matches user expectation when the value is already at the
  limit.
- Tab order is visible input → increment → decrement.
- Clicking a stepper restores focus to the visible input so subsequent typing flows naturally.
- Hit targets meet the 44 × 44 px minimum under `@media (pointer: coarse)`.

## Mobile keyboards

`inputmode="decimal"` keeps the on-screen keyboard numeric while still allowing locale-aware
formatted display strings (`1,234.50`, `$1,234.50`, `50%`) inside a `type="text"` field. Using
`type="number"` would have meant losing grouping and currency glyphs, inconsistent stepper UI
across browsers, value mutation on wheel scroll, and surprising empty/`NaN` semantics on bad
paste.

## Validity surface

- `aria-invalid="true"` whenever the consumer passes `error` (or the wrapping `FormField` reports
  an error).
- `setCustomValidity('Please enter a valid number.')` when typed text fails to parse on commit.
- `setCustomValidity('Please enter a number.')` when `required` and the committed value is `null`.
- Both clear automatically on the next valid commit or external `value` change.

## What we deliberately do not do

- No `aria-valuemin` / `aria-valuemax` / `aria-valuenow` (see role decision above).
- No wheel-to-step handler. Scrolling the page over a focused number field changing its value is
  a well-known accessibility footgun.
- No hold-to-repeat on the stepper buttons in v1. The OS-level key repeat covers the
  continuous-increment use case for keyboard users, and pointer-based hold-to-repeat introduces
  pointer-capture and timer-leak complexity disproportionate to the benefit. Tracked as a
  follow-up.
