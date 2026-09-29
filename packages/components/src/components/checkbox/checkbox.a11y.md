# Checkbox · accessibility

## Pattern

Native `<input type="checkbox">` per [WAI-ARIA Authoring Practices: Checkbox](https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/). No ARIA role is added because the native role is correct.

## Roles, names, and states

- The native input owns its role (`checkbox`).
- `aria-checked` and the `checked` attribute are managed by the browser.
- `aria-invalid="true"` is set when an `error` prop is supplied; cleared otherwise.
- `aria-describedby` references the description element and the error element when either is present, so screen readers announce both alongside the label.
- The `<label for={id}>` rendered by the `label` prop is the canonical accessible name. Consumers who supply their own labelling outside the component should pass `aria-labelledby` via rest props.
- The `error` message renders in a `<p aria-live="polite">`, matching Input's error live region: it mounts by default even before any error exists, rather than being created only once `error` is first set, since a freshly-mounted live region is not reliably announced by NVDA or JAWS. See `checkbox/README.md`'s "Callback order" for the related `onchange`/`onValueChangeRequest`/`onValueChange` firing order and value semantics.

## Indeterminate

`indeterminate` is a DOM property, not an attribute. The component sets it via an effect each time the prop changes; toggling `checked` clears it (matching native behavior). This is the standard pattern for "select all"-style master checkboxes.

## Keyboard

| Key   | Behavior                  |
| ----- | ------------------------- |
| Space | Toggle the checkbox state |
| Tab   | Move focus into / out     |

All native; the component adds nothing.

## Form participation

The checkbox is a real `<input>` element, so it participates in:

- Form submission (only when checked, value is the `value` attribute, defaulting to `"on"`)
- Form reset (returns to `defaultChecked`)
- Constraint validation (`required`, `:invalid`)
- Reactive labels (`<label for=…>` and clicking the label)

Cinder does not customize any of these — they work as the platform defines them.

## Disabled

`disabled` sets the native attribute. The label receives `data-disabled` for visual treatment.
