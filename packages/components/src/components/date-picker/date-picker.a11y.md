# DatePicker accessibility notes

- Uses a native text input as the trigger, with `Popover` for the floating panel.
- Calendar interaction is delegated to `Calendar` (`role="grid"` pattern).
- For non-day granularities, time editing uses native `<input type="time">`.
- Error and description text are wired with `aria-describedby`; invalid state uses `aria-invalid`.
