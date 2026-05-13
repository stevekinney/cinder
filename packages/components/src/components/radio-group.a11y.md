# RadioGroup · accessibility

## Pattern

A `<fieldset>` containing native `<input type="radio">` children, per [WAI-ARIA Authoring Practices: Radio Group](https://www.w3.org/WAI/ARIA/apg/patterns/radio/). The native `radiogroup` role is provided by the fieldset element; no ARIA role is added.

## Roles, names, and states

- `<fieldset>` carries the implicit `radiogroup` role.
- The `<legend>` rendered by the `legend` prop names the group; consumers without a visible legend should pass `aria-label` via the consumer composition pattern.
- Each `<input type="radio">` shares the same `name` attribute, so the browser enforces single selection automatically.
- `aria-invalid="true"` is set on each input when an `error` is supplied at the group level.
- `aria-describedby` on the fieldset references the description and error elements when either is present.

## Per-option description association

Each `Radio` accepts a `description` prop. When supplied:

- A `<p id="{id}-description">` is rendered as a sibling of the `<label>` inside the `.cinder-radio-row`.
- The input's `aria-describedby` is set to that id (composed with any caller-supplied `aria-describedby` value — the per-option description id comes first).
- Screen readers announce the description text when focus lands on the specific radio — the user-relevant scope, not the entire group.
- The row receives `data-has-description` so CSS can switch to a two-row grid layout without `:has()`.

Fieldset-level descriptions (`RadioGroupProps.description`) and per-option descriptions can coexist; they target different ARIA scopes and do not duplicate announcements.

## Card variant

`RadioGroup` accepts a `variant` prop (`'default' | 'card'`, default `'default'`). When `variant='card'`:

- The `<fieldset>` receives `data-variant="card"`.
- CSS scoped to `[data-variant='card']` draws a bordered surface around each `.cinder-radio-row`.
- State (selected, disabled, invalid) is reflected via data attributes on the row (`data-checked`, `data-disabled`, `data-invalid`) so card borders can change per state without `:has()`.

**The card border is decorative reinforcement, not the sole indicator of selection.** The native checked-state dot (`.cinder-radio:checked` background SVG) remains the primary indicator. Forced-colors mode uses border weight (`1px → 2px`) and the `Highlight` system color to ensure a non-color indicator is always present.

**Activation surface is the native `<input>` + `<label for=…>` pair.** The card padding is intentionally modest (`--cinder-space-3`) to minimise the gap between the visible card edge and the clickable area. Whole-card activation (click anywhere on the card to select the radio) is a known follow-up and is explicitly out of scope for this variant — it would require either a wrapping `<label>` or JavaScript pointer handling, both of which affect the WAI-ARIA keyboard model and WCAG 2.5.3 (Label in Name).

## `aria-invalid`

`aria-invalid="true"` is wired through `RadioGroupContext.invalid` → `ariaInvalid()` on each `<input>`. The value is exactly the string `"true"` when invalid; the attribute is omitted entirely when the group has no error.

## Keyboard

| Key               | Behavior                                                                              |
| ----------------- | ------------------------------------------------------------------------------------- |
| Tab               | Move focus to the radio group, landing on the currently-selected radio (or the first) |
| ArrowDown / Right | Move selection (and focus) to the next radio in the group, wrapping at the end        |
| ArrowUp / Left    | Move selection (and focus) to the previous radio, wrapping at the start               |
| Space             | Activate the currently-focused radio (browser-native)                                 |

All keyboard navigation is delegated to the platform — sharing a `name` causes browsers to implement the WAI-ARIA arrow-key pattern automatically.

## Form participation

Each Radio is a real `<input type="radio">`, so it participates in:

- Form submission (selected radio's `value` is sent under the shared `name`)
- Form reset (returns to `defaultChecked` per radio)
- Constraint validation (`required` on the group propagates intent; consumers may set it on individual radios)

## Disabled

`disabled` on the group propagates to every Radio that doesn't override it. Individual Radio components can pass `disabled` to override the group setting in either direction.
