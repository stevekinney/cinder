# Input Accessibility

## ARIA Roles and Attributes

- The `<input>` element is a native form control; no additional `role` is needed.
- The `label` prop renders a `<label>` element with a `for` attribute equal to the `id` prop. This programmatically associates the label with the input so screen readers announce the label text when the input receives focus.
- The `description` prop renders a `<p>` element whose `id` is `{id}-description`. The input's `aria-describedby` attribute references this id so assistive technologies read the description text as supplementary information after the label.
- The `error` prop renders a `<p>` element whose `id` is `{id}-error`. Two attributes change on the input simultaneously: `aria-invalid="true"` signals to assistive tech that the field is in an error state, and `aria-describedby` includes `{id}-error` so the error message is announced.
- When both `description` and `error` are present, `aria-describedby` lists both ids separated by a space (`{id}-description {id}-error`). Screen readers announce them in order.
- The error `<p>` carries `aria-live="polite"` so dynamically injected error messages are announced without interrupting ongoing speech.

## Keyboard Interactions

| Key         | Behaviour                                                                           |
| ----------- | ----------------------------------------------------------------------------------- |
| Tab         | Moves focus to the input. The associated label text is announced by screen readers. |
| Shift + Tab | Moves focus away from the input.                                                    |
| Type        | Updates the bound `value`. No custom keydown handling is added by the component.    |

The input is a native `<input>` element, so all standard browser keyboard interactions (cursor movement, selection, cut/copy/paste) work without any component-level intervention.

## Focus Behaviour

Focus styling is provided by the `.cinder-input:focus-visible` rule using a `box-shadow` ring so the outline is visible in all color schemes. The `outline: transparent` pattern prevents a double-ring in browsers that render both `outline` and `box-shadow`.

In Windows High Contrast Mode (`forced-colors: active`), `box-shadow` is suppressed by the browser. A fallback `outline` rule restores focus visibility using the system `Highlight` color.

## Disabled State

When `disabled={true}` is passed, the native `disabled` attribute is set on `<input>`. The label receives `data-disabled="true"` which CSS uses to apply `cursor: not-allowed`, visually communicating the field is inactive. Disabled inputs are skipped by the tab order automatically via the browser's native behavior.

## Color Contrast

- Label text uses `--cinder-text` (light: oklch 20%, dark: oklch 92%) against the page background, satisfying WCAG AA 4.5:1 for normal text.
- Placeholder text uses `--cinder-text-subtle` which is intentionally lower contrast. Placeholders are not a substitute for labels — the visible `<label>` element carries the accessible name.
- Error text uses `--cinder-danger` which is calibrated to pass WCAG AA contrast against the component surface in both light and dark modes.
- The error-state border uses `--cinder-danger` as a redundant visual cue alongside `aria-invalid`. Color alone is not relied upon — the error text below the input provides the message in all cases.

## Content Guidance

- Always provide a `label` unless the input's purpose is unambiguous from surrounding context (e.g., a search field immediately following a "Search" heading). Even then, pass a visually hidden label via CSS (`sr-only`) rather than omitting it.
- Keep `description` text concise — one sentence of supplementary guidance. Do not repeat information already in the label.
- `error` messages must describe what went wrong and, where possible, how to fix it. Avoid generic messages like "Invalid input."
- Do not rely solely on placeholder text to communicate requirements; use `description` instead, as placeholder text disappears on input and is not consistently announced by all screen reader/browser combinations.
