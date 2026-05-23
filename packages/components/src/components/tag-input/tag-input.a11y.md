# TagInput accessibility

`TagInput` is a token-entry field: the text input owns text entry, while committed
tags move into a separate composite widget that users can revisit and edit.

## Structure

- The committed tags render inside `<ul role="listbox" aria-multiselectable="true">`.
- Each tag renders as `<li role="option" aria-selected="true">`.
- The visible text input is a sibling that comes after the listbox in DOM order.

This shape follows the task contract for a listbox-backed tag editor while still
keeping native text entry in a real `<input>`.

## Keyboard model

- `Enter` commits the pending text when the trimmed candidate is non-empty.
- A configured delimiter key (comma by default) also commits the pending text.
- `Backspace` on an empty input moves focus to the last tag.
- `Backspace` or `Delete` on a focused tag removes it.
- `ArrowLeft`, `ArrowRight`, `Home`, and `End` move focus across tags with a
  roving-tabindex model.
- `ArrowRight` from the final tag returns focus to the text input.

The tag options own DOM focus. The nested remove buttons are kept at
`tabindex="-1"` so they do not create a second focus stop inside each option.
Pointer users can still activate them directly.

## Labels and descriptions

- When wrapped in `FormField`, the text input inherits `aria-describedby`,
  `aria-invalid`, `aria-required`, and disabled state from context.
- The listbox receives the `FormField` label through `aria-labelledby`.
- Standalone `aria-label` and `aria-labelledby` props apply to both the text
  input and the listbox.

## Error messaging

Inline duplicate, max-cap, and validation failures render below the control and
are included in the input's `aria-describedby` chain so screen readers announce
them alongside `FormField` description and error text.

## Form submission and reset

- When `name` is provided, the component renders one hidden input per tag using
  the same field name so native form submission preserves free-form values
  without lossy delimiter encoding.
- In uncontrolled mode, native form reset restores `defaultValue`, clears the
  pending input buffer, and clears inline validation errors.
- Controlled mode does not mutate itself on reset; the parent remains the source
  of truth.
