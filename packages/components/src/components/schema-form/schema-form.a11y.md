# SchemaForm Accessibility

## Roles and Names

- The component renders a native `<form>` element and native text, number, select, and textarea controls wherever the schema shape is inspectable.
- Every generated field receives a visible label. Required fields include a visual `*` marker; schema validation still owns the actual validity contract.
- Generated descriptions and errors are connected to their controls with `aria-describedby`.
- Failed validation sets `aria-invalid="true"` on the invalid field. Boolean fields render as `button role="switch"` with `aria-checked` and use `aria-required="true"` when the schema marks them required.

## Keyboard Interactions

| Key         | Behaviour                                                           |
| ----------- | ------------------------------------------------------------------- |
| Tab         | Moves through generated controls and buttons in DOM order.          |
| Shift + Tab | Moves backward through generated controls and buttons.              |
| Enter       | Submits the form from text-like controls.                           |
| Space/Enter | Toggles generated switch controls when the switch itself has focus. |

Array add/remove controls are native buttons and use their standard keyboard behavior.

## Validation and Focus

On failed submit, the form prevents native submission, renders field-level errors, and moves focus to the first invalid control or error message. The error text has `aria-live="polite"` so newly rendered messages are announced without interrupting current speech.

On successful submit, the hidden serialized output field is updated before the callback runs. Consumers that read `FormData` can parse the same value with `readSchemaFormData`.

## Raw JSON Fallback

Unknown or unsupported schema nodes render as a labelled textarea containing JSON. Invalid JSON is reported as a field error and blocks submission. This preserves data instead of silently dropping fields the renderer cannot safely model.
