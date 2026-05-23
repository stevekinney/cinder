# TimePicker Accessibility

- The text input remains the primary form control. The popover is an enhancement for choosing values without typing.
- Each scroll column uses `role="listbox"` with `role="option"` children, and the AM/PM chooser uses `role="radiogroup"`.
- Arrow keys move within a column, `Tab` advances between columns, and `Escape` closes the popover through the shared popover primitive.
- When used inside `FormField`, the component composes the field-provided `aria-describedby`, `required`, and `disabled` state instead of duplicating label wiring.
