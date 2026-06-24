# TimeField · accessibility

## Pattern

TimeField uses a native time input for the canonical time value and a native select for optional timezone choices.

Purpose: Standalone time-of-day field that collects a canonical time string with optional timezone selection.

## Use when

- Collecting a time of day without a date, such as a reminder time or office-hours boundary.
- Pairing a time value with an optional timezone while keeping a canonical `HH:mm` or `HH:mm:ss` value.

## Avoid when

- Collecting a full date range — use date-range-field instead.

## Keyboard and focus

Keyboard behavior follows the native `<input type="time">` and `<select>` controls. Keep the label visible or otherwise programmatically associated with the time input.

## Names, roles, and state

The visible `label` prop is associated with the time input. `description` and `error` are wired through `aria-describedby`, and `error` sets `aria-invalid="true"` on the time input.

The optional timezone control uses a native select element with an accessible label. If the surrounding copy already names the timezone requirement, keep the select label concise.

## Verification

- Render TimeField with a label, description, and error.
- Confirm the time input has the expected accessible name and description.
- Tab through the time input and timezone select.
- Verify disabled and readonly states prevent editing.

Related components: `date-range-field`, `number-input`.
