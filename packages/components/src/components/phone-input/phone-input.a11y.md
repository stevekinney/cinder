# PhoneInput Accessibility

## ARIA Roles and Attributes

- The outer container is a `role="group"` that owns the component's group accessible name. The accessible name source is, in order: the `label` prop, a wrapping `<FormField>` label, `aria-labelledby`, then `aria-label`. Development builds warn when none of these are present.
- The component renders **two** native controls with their own accessible names:
  - a `<select>` with the accessible name `Country code` (sourced from a visually hidden span via `aria-labelledby`)
  - an `<input type="tel">` with the accessible name `Phone number` (also via a visually hidden span)
- Both controls share the same `aria-describedby` value so the same description or error follows whichever control has focus.
- `error` sets `aria-invalid="true"` on both controls and the group; CSS uses the attribute to draw the invalid border so the state is communicated by both attribute and color.
- `required` is announced via `aria-required="true"` on the group and on the national-number input.

## Keyboard Interactions

The component is built from a native `<select>` and a native `<input type="tel">`, so every standard browser keyboard interaction works without component-level intervention. Specifically:

| Key                           | Behaviour                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------ |
| Tab                           | Moves focus to the country select, then to the phone number input.             |
| Shift+Tab                     | Moves focus back through the controls.                                         |
| Type into select              | Native typeahead on country codes.                                             |
| Type digits into input        | As-you-type national formatting via libphonenumber.                            |
| Type a `+` followed by digits | Parsed as E.164 — the component re-detects the country and updates the select. |

## Focus Behaviour

Each control carries the cinder focus ring on `:focus-visible`. The group uses a CSS grid with two columns so the controls visibly align even when the country name is long.

## Disabled State

`disabled` (or a wrapping `<FormField disabled>`) disables both controls and the hidden form input, dims the surface, and prevents user interaction. `aria-disabled="true"` lands on the group so screen readers announce the whole field as disabled.

## Submission Behaviour

The hidden `<input type="hidden">` only carries a value when the typed phone number is valid for the selected country. Incomplete or invalid input submits an empty string so a server-side validator never receives a half-typed number that looks plausible. Consumers should surface validation failure via the `error` prop.

## Country Allow-List

`countries` accepts an optional allow-list of ISO 3166-1 alpha-2 country codes. When supplied, only those countries appear in the dropdown and external `value`s pointing to a country outside the list are flagged with `reason: 'country-not-allowed'` on the `onchange` detail. The visible national-number text is preserved in that state so the user can correct it rather than silently lose their input.

## Color Contrast

- Control text uses `--cinder-text` against `--cinder-surface-raised`, satisfying WCAG AA 4.5:1 in both light and dark modes.
- Error borders use `--cinder-danger` as a redundant visual cue alongside `aria-invalid="true"`. The error text below the controls always carries the message.
- The custom select chevron is drawn with `currentColor`, so it inherits the same contrast and recolors automatically when the surface is disabled.

In Windows High Contrast Mode (`forced-colors: active`) the focus ring falls back to the system `Highlight` color so focus remains visible.
