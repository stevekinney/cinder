# DatePicker accessibility notes

- Uses a labelled text input for direct entry and a separate button as the `Popover` dialog trigger.
- Calendar interaction is delegated to `Calendar` (`role="grid"` pattern).
- Opening the trigger moves focus into the dialog; closing it restores focus to the trigger.
- For non-day granularities, a visible label names the native `<input type="time">`.
- Error and description text are wired with `aria-describedby`; invalid state uses `aria-invalid`.
