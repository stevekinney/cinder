# Tooltip Accessibility

## ARIA Roles and Attributes

- The tooltip element has `role="tooltip"` which identifies it as supplementary description content.
- The trigger wrapper has `aria-describedby` pointing to the tooltip element's `id`. When the tooltip is visible, assistive technologies announce the tooltip text as the description of the trigger.
- `aria-hidden` on the tooltip element reflects its visibility state (`"true"` when hidden, `"false"` when shown). Screen readers will not read the tooltip text when `aria-hidden="true"`, preventing redundant announcements while it is off-screen.

## Keyboard Interactions

| Key         | Behaviour                                                                                      |
| ----------- | ---------------------------------------------------------------------------------------------- |
| Tab         | Moves focus to the trigger element. Tooltip appears on `:focus-visible` (via `focusin` event). |
| Shift + Tab | Moves focus away from the trigger. Tooltip hides on `blur`.                                    |

The tooltip does not receive focus itself — it is purely a description element. The trigger element (slotted via `children`) must be natively focusable (a `<button>`, `<a>`, or element with `tabindex="0"`) to satisfy keyboard accessibility.

## Hover Behaviour

- Tooltip shows after a 100 ms delay on `mouseenter` to prevent flash on accidental hover.
- Tooltip hides immediately on `mouseleave`.

## Notes on CSS Anchor Positioning

When the browser supports `anchor-name` (Chrome 125+, Safari 18.2+), the tooltip uses CSS Anchor Positioning to attach itself to the trigger without JavaScript. In browsers without support, a CSS `position: absolute` fallback is used. Both paths produce equivalent results — the `data-cinder-placement` attribute drives placement via CSS.

## Content Guidance

- Tooltip text should be brief (a single phrase or sentence).
- Do not use a tooltip as the sole means of conveying critical information — it is not accessible to touch-only users.
- Avoid repeating text already visible on screen.
