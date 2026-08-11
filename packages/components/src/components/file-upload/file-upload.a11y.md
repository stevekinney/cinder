# FileUpload accessibility

- The dropzone is a grouped surface that keeps a native `<input type="file">` plus a visible picker button; keyboard and assistive-technology users can activate the picker through the real button while form semantics stay on the input.
- Drag feedback changes border style and background together; the state is not color-only.
- After every selection or drop, a polite live region announces accepted and rejected counts so assistive-technology users receive immediate feedback.
- Error rows render visible messages linked with `aria-describedby`; retry buttons reference the same message so the failure reason is announced when the action receives focus.
- Default rows expose a native remove button with the file name in its accessible name. Successful removal is announced through the polite live region.
- Failed controlled uploads expose a native retry button when `onRetry` is provided; locally rejected rows do not. Each retry button's accessible name includes the file name, the button remains keyboard-focusable, and its icon is decorative.
- When wrapped in `FormField`, the input inherits shared description and error wiring through context.

## 2026 upload-surface review

The closest interaction neighbours are Cinder's native-input-backed form controls and the Extend UI File Upload reference. The revised surface keeps the native file input and a visible button as the keyboard and assistive-technology path; drag-and-drop remains an optional enhancement. The title and description are visible text, drag-active copy is not conveyed by color alone, file-type icons are decorative, progress keeps native progressbar semantics, and retry is a conventional button with a file-specific accessible name. Focus emphasis falls back to the system `Highlight` color in forced-colors mode. No new focus-management or announcement model was introduced.
