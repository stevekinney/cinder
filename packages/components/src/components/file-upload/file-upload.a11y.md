# FileUpload accessibility

- The prominent dropzone is a real `<label>` wrapping a native `<input type="file">`, so keyboard activation and disabled semantics come from the platform rather than custom ARIA.
- Drag feedback changes border style and background together; the state is not color-only.
- After every selection or drop, a polite live region announces accepted and rejected counts so assistive-technology users receive immediate feedback.
- Error rows render visible messages linked with `aria-describedby`.
- When wrapped in `FormField`, the input inherits shared description and error wiring through context.
