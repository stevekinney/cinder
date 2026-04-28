# Select Accessibility

## Element Choice

This component uses a native `<select>` element rather than a custom listbox. The native element
gives keyboard and pointer users correct operating-system-native behaviour for free and is
announced correctly by every major screen reader without any custom ARIA.

## ARIA Roles and Attributes

- The `<select>` element carries the implicit `listbox` role; no explicit `role` attribute is
  needed.
- When `label` prop is provided, a `<label>` element is rendered with a `for` attribute matching
  the `<select>`'s `id`. This is the recommended accessible labelling technique — it gives the
  control its accessible name and expands the click target to include the label text.
- If no `label` prop is provided, the consumer is responsible for supplying an accessible name via
  `aria-label` or `aria-labelledby` on the `<select>` through a wrapper.

## Keyboard Interactions

| Key             | Behaviour                                                          |
| --------------- | ------------------------------------------------------------------ |
| Tab / Shift+Tab | Moves focus to and from the select control.                        |
| Space / Enter   | Opens the native OS dropdown when the select has focus.            |
| Arrow Up / Down | Moves between options while the dropdown is open (OS-native).      |
| Escape          | Collapses the dropdown without changing the selection (OS-native). |

All keyboard interactions are handled natively by the browser and operating system — no custom
key-down handlers are required or added.

## Disabled State

The `disabled` prop maps directly to the native `disabled` HTML attribute on `<select>`. This
causes the element to be skipped during Tab navigation and announced as "dimmed" or "unavailable"
by screen readers. `aria-disabled` is intentionally not used because native `disabled` provides
stronger guarantees: the browser prevents value changes even from JavaScript, while `aria-disabled`
only communicates state to assistive technology.

Individual options may also be disabled via the `disabled` field on a `SelectOption` object. A
disabled option is still announced by screen readers but cannot be selected.

## Empty Options Guard

When `options` is an empty array the component renders a `<select data-cinder-empty="true">` with
no children and fires `console.warn('Select: options is empty')`. The `data-cinder-empty`
attribute provides a hook for test assertions and CSS rules. A select with no options is
functionally useless and should be treated as a developer error.

## Focus Visibility

The `.cinder-select` element relies on the browser's native `:focus-visible` outline to keep focus
visible for keyboard users. The CSS layer enhances this with a custom focus ring using
`box-shadow` so the ring respects the token-defined offset and colour. A `@media (forced-colors: active)`
block restores an `outline`-based ring for Windows High Contrast Mode where `box-shadow` is ignored.

## Color and Contrast

All colour values in `select.css` reference design tokens (`--cinder-*`). Token values must meet
WCAG 2.1 AA contrast ratios: at least 4.5:1 for normal text and 3:1 for large text and UI
components. The border-to-background contrast of the select control must meet the 3:1 non-text
contrast requirement (WCAG 1.4.11).
