# FileUpload accessibility

- The dropzone is a grouped surface that keeps a native `<input type="file">` plus a visible `Choose files` button; keyboard and assistive-technology users can activate the picker through the real button while form semantics stay on the input.
- Drag feedback changes border style and background together; the state is not color-only.
- After every selection or drop, a polite live region announces accepted and rejected counts so assistive-technology users receive immediate feedback.
- Error rows render visible messages linked with `aria-describedby`.
- When wrapped in `FormField`, the input inherits shared description and error wiring through context.
