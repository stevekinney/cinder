# RadioGroup · accessibility

## Pattern

A `<fieldset>` containing native `<input type="radio">` children, per [WAI-ARIA Authoring Practices: Radio Group](https://www.w3.org/WAI/ARIA/apg/patterns/radio/). The native `radiogroup` role is provided by the fieldset element; no ARIA role is added.

## Roles, names, and states

- `<fieldset>` carries the implicit `radiogroup` role.
- The `<legend>` rendered by the `legend` prop names the group; consumers without a visible legend should pass `aria-label` via the consumer composition pattern.
- Each `<input type="radio">` shares the same `name` attribute, so the browser enforces single selection automatically.
- `aria-invalid="true"` is set on each input when an `error` is supplied at the group level.
- `aria-describedby` on the fieldset references the description and error elements when either is present.

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
