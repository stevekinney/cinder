# JsonEditor accessibility

JsonEditor uses a native `<textarea>`, so standard text-editing and focus behavior remains available without a custom keyboard model. Tab moves to the next focusable control and is never repurposed for indentation.

The required visible label is associated through `for` and `id`. Description and parse-feedback elements are included in `aria-describedby`; invalid JSON and external errors also set `aria-invalid="true"` and use an alert role. Valid parse feedback uses a status role.

Keep the label specific to the payload being edited. Placeholder text is not a replacement for the label.
