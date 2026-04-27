# Modal Accessibility

## ARIA Roles and Attributes

- The native `<dialog>` element carries an implicit `role="dialog"`.
- `aria-modal="true"` is set explicitly so screen readers that do not natively understand `<dialog>` know to restrict their virtual browse to the modal's content.
- `aria-labelledby` points to the `<h2>` title element, giving the dialog an accessible name announced when the dialog opens.

## Keyboard Interactions

| Key         | Behaviour                                                                                                                                                                            |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tab         | Cycles focus forward through all focusable elements inside the open dialog. Focus does not leave the dialog while it is open — the native `showModal()` provides this trap for free. |
| Shift + Tab | Cycles focus backward.                                                                                                                                                               |
| Escape      | Closes the dialog. The native `<dialog>` fires a `close` event on Escape; the component listens to `onclose` and sets `open = false`.                                                |

## Focus Management

- When the dialog opens, the browser moves focus to the first focusable element inside the dialog (or the dialog itself if none are focusable).
- When the dialog closes, the implementation does not currently restore focus to the trigger element. The consuming page is responsible for calling `triggerElement.focus()` in the `onclose` callback. A future iteration should accept an optional `triggerRef` prop and restore focus automatically.

## Backdrop

- Clicking the backdrop (`event.target === dialogElement`) closes the dialog. This relies on the CSS background applied to `<dialog>` rather than `::backdrop`, so the click target is always the `<dialog>` element itself, not a separate pseudo-element.

## Screen Reader Announcements

- Opening a `<dialog>` with `showModal()` causes supporting screen readers (NVDA+Firefox, JAWS+Chrome, VoiceOver+Safari) to announce the dialog role and its accessible name (from `aria-labelledby`) immediately.
- The close button carries `aria-label="Close dialog"` so it reads as "Close dialog, button" rather than the SVG icon content.
