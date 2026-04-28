# Pagination Accessibility

## ARIA Roles and Attributes

- The root element is a `<nav>` with `aria-label="Pagination"`. This landmark role lets screen reader users jump directly to the pagination control via the landmark navigation shortcut, and the label distinguishes it from other navigation landmarks on the page (e.g., site navigation).
- Each page number `<button>` carries a descriptive `aria-label`: the current page announces as `"Page N, current page"` while non-current pages announce as `"Go to page N"`. This ensures the control's purpose is clear even when the visual number alone would be ambiguous.
- The current page button has `aria-current="page"`. This is the ARIA pattern recommended by WCAG 2.1 SC 1.3.1 for indicating the active item in a set of pagination controls. Screen readers such as NVDA, JAWS, and VoiceOver announce it as "current" alongside the button label.
- Previous and next step buttons carry explicit `aria-label` values (`"Go to previous page"` / `"Go to next page"`) because they contain only SVG icons. The SVGs have `aria-hidden="true"` and `focusable="false"` to prevent them from being announced or reached by keyboard in IE/Edge legacy mode.
- When a step button is at a boundary (previous on page 1, next on the last page) it receives both the native `disabled` attribute and `aria-disabled="true"`. The native `disabled` prevents click and keyboard activation; `aria-disabled` ensures assistive technologies that expose button state announce it as disabled.
- Ellipsis spans carry `aria-hidden="true"` — they are purely decorative separators and add no navigational value to the accessibility tree.
- The optional result count paragraph (`<p class="cinder-pagination__count">`) uses `aria-live="polite"` so assistive technologies announce count changes (e.g., after filtering) without interrupting the user.

## Keyboard Interactions

| Key           | Behaviour                                                                        |
| ------------- | -------------------------------------------------------------------------------- |
| Tab           | Moves focus through previous button, each page button, next button sequentially. |
| Shift+Tab     | Reverses focus order through the same sequence.                                  |
| Space / Enter | Activates the focused button (browser default for `<button type="button">`).     |

Disabled step buttons are removed from the tab order via the native `disabled` attribute, so keyboard users skip them automatically at boundaries.

## Screen Reader Behaviour

When a user activates a page button or a step button, `currentPage` changes and the component re-renders. Because the page buttons update in place (same DOM structure, reactive `aria-current` and `aria-label` attributes), screen readers that track attribute mutations (VoiceOver on Safari, NVDA + Firefox, JAWS + Chrome) will announce the newly current button on the next focus move.

If you require an immediate announcement after page change, insert a visually hidden `aria-live="assertive"` status region outside this component that announces "Now on page N of M" in response to the `currentPage` binding change.

## Color and Contrast

- The current page button uses `--cinder-accent` (background) and `--cinder-accent-contrast` (text). Ensure your token values meet WCAG 2.1 SC 1.4.3 minimum contrast ratio of 4.5:1 for normal text.
- Disabled step buttons use `--cinder-text-disabled` (or fallback `--cinder-text-muted`). Disabled controls are exempt from the WCAG contrast requirement per SC 1.4.3, but sufficient contrast is still a usability best practice.
- Focus rings are implemented via `box-shadow` using `--cinder-ring-color`, `--cinder-ring-width`, and `--cinder-ring-offset`. A `forced-colors: active` media query restores a solid `outline` for Windows High Contrast mode, where `box-shadow` is suppressed by the OS.

## Touch and Pointer Targets

Minimum interactive size for all buttons is `2.25rem × 2.25rem` (36 px × 36 px), meeting WCAG 2.5.8 (AAA) and WCAG 2.5.5 (AA) target size guidelines. On narrow viewports (≤ 480 px) the page number list is hidden and only the previous/next step buttons remain visible, maintaining sufficient target size for touch users.

## Content Guidance

- `totalCount`, when provided, is formatted with `Intl.NumberFormat` (`en-US` locale by default). If your application requires a different locale, format the value before passing it and omit `totalCount`, rendering the count string yourself.
- Avoid placing the pagination component inside another `<nav>` landmark — nesting landmark elements of the same type is not meaningful and may confuse screen reader users exploring by landmark.
- The `class` prop merges with `.cinder-pagination` — do not override `role` or `aria-label` via CSS class convention; use component props for semantic attributes.
