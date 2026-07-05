# ActionRow Accessibility

ActionRow renders a native `<button>` so click, Enter, Space, disabled state, focus order, and form behavior follow browser button semantics.

Use `selectedState="pressed"` for in-page selection such as master-detail sidebars and timelines. This maps `selected` to `aria-pressed="true|false"`.

Use `selectedState="current"` only when the row represents the current item in a set. When selected, ActionRow emits `aria-current` with `currentValue` and omits it when not selected.

The row title is visible text and should be enough to identify the target. Description, meta, leading, and trailing regions add context but should not be the only accessible name source.

## Verification

- Confirm the root element is a native button.
- Confirm selected rows emit either `aria-pressed` or `aria-current`, never both.
- Confirm disabled rows cannot be activated.
- Confirm rich leading, metadata, and trailing regions remain inside the button content.
