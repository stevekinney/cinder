# TagInput accessibility

`TagInput` is a token-entry field: the text input owns text entry, while committed
tags move into a separate composite widget that users can revisit and edit.

## Structure

- The committed tags render inside a plain `<ul>` (implicit `role="list"`) — NOT
  a `role="listbox"`. Committed tags are confirmed values with a per-item remove
  command, not selectable options. A listbox would force every child to be a
  `role="option"`, which legally cannot contain the interactive remove button
  (axe `aria-required-children` + `nested-interactive`).
- Each tag renders as a `<li>` (implicit `role="listitem"`) holding the tag label
  plus a real `<button aria-label="Remove {tag}">`.
- The visible text input is a sibling that comes after the list in DOM order.

The remove button being a genuine, named control means it is reachable by
keyboard, pointer, voice control (Dragon, Voice Control), and switch access.

## Keyboard model

- `Enter` commits the pending text when the trimmed candidate is non-empty.
- A configured delimiter key (comma by default) also commits the pending text.
- `Backspace` on an empty input moves focus to the last tag's remove button.
- `Backspace` or `Delete` on a focused remove button removes that tag.
- `ArrowLeft`, `ArrowRight`, `Home`, and `End` move focus across the remove
  buttons with a roving-tabindex model.
- `ArrowRight` from the final tag returns focus to the text input.

The remove buttons own DOM focus and carry the roving tabindex: exactly one is in
the tab order at a time (the focused one, or the first when none is focused, so a
Tab-only user can always reach the list). When the list is empty no button is in
the tab order.

## Labels and descriptions

- When wrapped in `FormField`, the text input inherits `aria-describedby`,
  `aria-invalid`, `aria-required`, and disabled state from context.
- The tag list receives the `FormField` label through `aria-labelledby`.
- Standalone `aria-label` and `aria-labelledby` props apply to both the text
  input and the tag list.

## Error messaging

Inline duplicate, max-cap, and validation failures render below the control and
are included in the input's `aria-describedby` chain so screen readers announce
them alongside `FormField` description and error text.

## Form submission and reset

- When `name` is provided, the component renders one hidden input per tag using
  the same field name so native form submission preserves free-form values
  without lossy delimiter encoding.
- Set `commitOnSubmit` when the parent form should commit a non-empty pending
  draft before submission. The submit-time commit uses the same validation,
  duplicate, and max-tag checks as Enter and delimiter commits; invalid drafts
  keep focusable form state in place and prevent submission.
- In uncontrolled mode, native form reset restores `defaultValue`, clears the
  pending input buffer, and clears inline validation errors.
- Controlled mode does not mutate itself on reset; the parent remains the source
  of truth.
