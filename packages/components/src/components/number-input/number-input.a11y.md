# Number Input — accessibility

`number-input.svelte` is a locale-aware numeric textbox with explicit increment/decrement stepper buttons.

## Provenance

This record was rewritten on 2026-09-22 against the component source and test suite current on this branch (`number-input.svelte`, `number-input-logic.svelte.ts`, and the `number-input-*.test.ts` files). The previous revision described a deliberate decision to keep native `textbox` semantics and omit `role="spinbutton"`/`aria-valuenow`/`aria-valuemin`/`aria-valuemax`; the implementation on this branch does the opposite — it sets all four. This record describes the current, implemented contract. See "What has not been verified" below for what a human or assistive-technology pass would still need to confirm.

## Role: spinbutton on a text input

The rendered `<input>` (via the shared `Input` component) carries `type="text" inputmode="decimal" role="spinbutton"` plus `aria-valuenow`/`aria-valuemin`/`aria-valuemax` (`number-input.svelte:446-473`, the literal `role="spinbutton"` attribute at line 459). This follows the [WAI-ARIA spinbutton pattern](https://www.w3.org/WAI/ARIA/apg/patterns/spinbutton/): a widget that lets the user select a value from within a range, with explicit increment/decrement affordances. Overriding the native `textbox` role this way is exactly what the pattern calls for — assistive technology should announce the range and current value, not just "editable text".

- `aria-valuenow`, `aria-valuemin`, `aria-valuemax` are `$derived` values (`number-input.svelte:269-291`) computed in **display units**: when `format.style === 'percent'`, the underlying `0`–`1` value/bounds are scaled ×100, matching what the user sees on screen (`0.5` displays as `50%` and reports `aria-valuenow="50"`). Tested by `number-input-validation.test.ts` "spinbutton exposes bounded numeric value attributes" (line 54) and "spinbutton aria-valuenow uses display units for percent formatting" (line 78).
- While the input has focus, `aria-valuenow` tracks the live, uncommitted edit buffer rather than the last-committed `value` — so a user typing a new digit hears/sees the in-progress number, not the stale committed one. Tested by "spinbutton aria-valuenow follows valid focused edits" (line 65).
- `aria-valuemin`/`aria-valuemax` are omitted (`undefined`) when the corresponding bound is not finite (`Number.isFinite` guard at `number-input.svelte:278-291`), matching the spinbutton pattern's own allowance to omit either bound when a control is unbounded in that direction. This branch is exercised by rendering without `min`/`max` in other tests in this file, but no test asserts the _attribute is absent_ — see "What has not been verified".

Range information is also exposed through:

- Consumer-authored label / description text (e.g. "Quantity, between 1 and 99") via the shared `label`/`description` props, which route through `Input`'s field wiring.
- Explicit `aria-label="Increment…"` / `aria-label="Decrement…"` on the stepper buttons, composed with the field label and step magnitude (`number-input.svelte:416-420,427-432`); tested by `number-input-steppers.test.ts` "with label and explicit step" (line 184) and "without label falls back to magnitude-only label" (line 192).
- `aria-invalid` + the error region when the consumer flags out-of-range or a commit fails to parse; tested by `number-input-validation.test.ts` "error prop sets aria-invalid and renders error element" (line 16).
- Native `:invalid` styling driven by `setCustomValidity` for `required` and malformed cases; tested by "required + empty commit → customError" (line 28) and "required + garbage → customError" (line 43).

## Keyboard

The visible input handles a small set of keys (`number-input-logic.svelte.ts`, wired through `onKeyDown` at `number-input.svelte:472`):

- **ArrowUp / ArrowDown**: increment or decrement by `step` (default 1). Tested by `number-input-steppers.test.ts` "ArrowUp / ArrowDown match increment / decrement" (line 58).
- **PageUp / PageDown**: ±10 × `step`. Tested by "PageUp / PageDown = ±10×step" (line 74).
- **Home / End**: jump to `min` / `max` when those bounds are finite (no-op when infinite). Tested by "Home → min when finite; End → max when finite" (line 91) and "Home / End no-op when bound is infinite" (line 109).
- **Enter**: commit the typed value and submit the enclosing form if it's valid; otherwise call `form.reportValidity()`.

`preventDefault` is called for ArrowUp/Down, PageUp/Down, and Home/End so caret movement does not collide with stepping. This departs from the plain WAI-ARIA spinbutton pattern's keyboard table only in that the underlying widget is a real editable `<input>`, so typed digits and caret movement (Left/Right/Backspace/Delete/selection) continue to work natively alongside the range-stepping keys — the pattern does not require suppressing text editing.

## Stepper buttons

- Two `<button type="button">`. `type="button"` matters inside a form — without it, clicking either button submits the form.
- Lucide `Plus` and `Minus` SVG icons are `aria-hidden="true"`; the accessible name comes from `aria-label="Increment…"` / `aria-label="Decrement…"`.
- Both stepper buttons carry `tabindex="-1"` unconditionally (`number-input.svelte:422,432`) — they are never reachable by Tab. This corrects the prior revision's "Tab order is visible input → increment → decrement" claim, which no longer matches the source: keyboard users operate the range exclusively through ArrowUp/Down/PageUp/PageDown/Home/End on the input (see "Keyboard" above); the stepper buttons are a pointer-only affordance.
- Stepper buttons additionally use the native `disabled` attribute at boundaries (`number-input.svelte:421,431`) — not `aria-disabled` — so a screen reader visiting them via non-linear navigation (not Tab) still hears the boundary state. Tested by `number-input-steppers.test.ts` "Increment disabled at max" (line 32) and "Decrement fires onValueChange(value-step), disabled at min" (line 39).
- Clicking a stepper restores focus to the visible input so subsequent typing flows naturally. Tested by "Refocus after stepper click" (line 173).
- Hit targets meet the 44 × 44 px minimum under `@media (pointer: coarse)`.

## Focus and focus return

There is no overlay, popup, or focus-trap in this component — focus starts wherever the consumer places it in tab order and never moves programmatically except the stepper-click-restores-input-focus behavior above. There is no "focus return from source" scenario analogous to Dropdown's trigger-focus restoration; NumberInput does not open or close anything that would need it.

## Mobile keyboards

`inputmode="decimal"` keeps the on-screen keyboard numeric while still allowing locale-aware formatted display strings (`1,234.50`, `$1,234.50`, `50%`) inside a `type="text"` field. Using `type="number"` would have meant losing grouping and currency glyphs, inconsistent stepper UI across browsers, value mutation on wheel scroll, and surprising empty/`NaN` semantics on bad paste.

## Comparison to DropdownMenu / DropdownItem and the spinbutton pattern

Unlike Dropdown's compound API (see `dropdown.a11y.md`), NumberInput has no roving-focus item collection, no arrow-key-driven selection among peer elements, and no Escape/dismiss lifecycle — it is a single-widget range control, not a menu. Its keyboard matrix is the one the WAI-ARIA spinbutton pattern itself defines (Up/Down/PageUp/PageDown/Home/End), layered on top of native text-editing keys because the underlying element is a real `<input>` rather than a non-editable custom widget. This is consistent with how GitHub Primer, Adobe Spectrum, Radix, and Mantine implement comparable "formatted numeric spinbutton" controls: `role="spinbutton"` on a real text input, not a `div`-based custom widget.

## Validity surface

- `aria-invalid="true"` whenever the consumer passes `error` (or the wrapping `FormField` reports an error).
- `setCustomValidity('Please enter a valid number.')` when typed text fails to parse on commit.
- `setCustomValidity('Please enter a number.')` when `required` and the committed value is `null`.
- Both clear automatically on the next valid commit or external `value` change.

## What we deliberately do not do

- No wheel-to-step handler. Scrolling the page over a focused number field changing its value is a well-known accessibility footgun.
- No hold-to-repeat on the stepper buttons in v1. The OS-level key repeat covers the continuous-increment use case for keyboard users, and pointer-based hold-to-repeat introduces pointer-capture and timer-leak complexity disproportionate to the benefit. Tracked as a follow-up.

## What has not been verified

This record reflects source reading and the `bun:test`/happy-dom suite only. The following have not been confirmed in a real browser or with assistive technology, and are tracked by the CIN-563 audit ledger rather than claimed here:

- Actual screen-reader announcement of `role="spinbutton"` plus live `aria-valuenow`/`aria-valuetext`-equivalent updates while typing (this component does not set `aria-valuetext`; announced value is the raw `aria-valuenow` number).
- That `aria-valuemin`/`aria-valuemax` are genuinely absent from the DOM (versus present with an empty/`"undefined"` string) when a bound is infinite — no test asserts attribute _absence_ for this case, only that the finite-bound values are correct.
- Touch/pointer hit-target sizing under `@media (pointer: coarse)` on an actual touch device.
- Mobile on-screen keyboard behavior for `inputmode="decimal"` across iOS/Android keyboard implementations.
