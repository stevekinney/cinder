# Modal Accessibility

## Dialog model

Modal is the generic shell. For specialised contracts see:

- [`ConfirmDialog`](../confirm-dialog/confirm-dialog.a11y.md) — inherits `role="dialog"` from Modal; defaults cancel-button focus; the safe choice for binary decisions.
- [`AlertDialog`](../alert-dialog/alert-dialog.a11y.md) — renders Modal with `role="alertdialog"`, `dismissOnBackdropClick={false}`, `dismissOnEscape={false}`, and no close button.

## ARIA Roles and Attributes

- The native `<dialog>` element carries an implicit `role="dialog"`.
- `aria-modal="true"` is set explicitly so screen readers that do not natively understand `<dialog>` know to restrict their virtual browse to the modal's content.
- `aria-labelledby` points to the `<h2>` title element, giving the dialog an accessible name announced when the dialog opens.
- **`describedById` prop**: When provided, the value is applied as `aria-describedby` on the underlying `<dialog>`. Pass the `id` of a short, plain-text description element (typically a `<p>` in the modal body). This causes supporting screen readers to announce the description immediately after the dialog role and title. When omitted, no `aria-describedby` attribute is emitted — never pass an empty string. For long or richly structured body content, do not use `describedById`; screen readers announce the entire referenced text as one continuous run.

## `role="alertdialog"` escape hatch

Modal accepts `role="alertdialog"`. Use this only when the dialog content requires richer composition than `AlertDialog`'s plain-text `description` prop allows. When composing `role="alertdialog"` on Modal directly, you must:

1. Set `dismissOnBackdropClick={false}` — the `alertdialog` contract requires the user to take an explicit action.
2. Set `dismissOnEscape={false}` — same reason; the user must not be able to dismiss without acknowledging.
3. Set `showCloseButton={false}` — a close-X contradicts the blocking intent.
4. Provide `describedById` referencing a description element in the modal body — `aria-describedby` is required on `alertdialog` so assistive technology announces the urgent condition.

If the content fits `AlertDialog`'s plain-text `description` constraint, prefer `AlertDialog` over composing Modal + `role="alertdialog"` manually.

## Keyboard Interactions

| Key         | Behaviour                                                                                                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tab         | Cycles focus forward through all focusable elements inside the open dialog. Focus does not leave the dialog while it is open — the native `showModal()` provides this trap for free.             |
| Shift + Tab | Cycles focus backward.                                                                                                                                                                           |
| Escape      | Fires the native `cancel` event on the `<dialog>`. The component prevents the default and calls the internal `dismiss()` helper, which flips `open = false` and fires `ondismiss` (if provided). |

## Focus Management

- When the dialog opens, the browser moves focus to the first focusable element with `autofocus`, or to the modal body container (`tabindex="-1"`) if no child carries `autofocus`.
- When the dialog closes, focus is restored to `triggerRef` if provided, otherwise to the element that held focus when the dialog opened (`capturedFocus`).

## Dismissal Callbacks (`ondismiss`)

The `ondismiss` callback fires on **user-initiated dismissal** only. The three included paths are:

1. **Escape key** — via the native `cancel` event on `<dialog>` (default prevented; routed through `dismiss()`).
2. **Backdrop click** — a click whose `event.target` is the `<dialog>` element itself.
3. **Close-X button** — the `×` button in the panel corner.

The following paths do **not** fire `ondismiss`:

- Parent-driven `open = false` (a route change, a completion event, or any external state update setting the prop directly).
- The confirm-button path in `ConfirmDialog` (that fires `onconfirm`, not `ondismiss`).

State flips to `open = false` **before** the callback is invoked. A thrown callback does not leave the dialog stuck open. Callbacks are not awaited — async/rejected-promise errors are the consumer's responsibility.

## Backdrop

- Clicking the backdrop (`event.target === dialogElement`) calls `dismiss()`, which closes the dialog and fires `ondismiss`. This relies on the CSS background applied to `<dialog>` rather than `::backdrop`, so the click target is always the `<dialog>` element itself, not a separate pseudo-element.

## Screen Reader Announcements

- Opening a `<dialog>` with `showModal()` causes supporting screen readers ([NVDA](https://www.nvaccess.org/)+Firefox, [JAWS](https://www.freedomscientific.com/products/software/jaws/)+Chrome, [VoiceOver](https://www.apple.com/accessibility/vision/)+Safari) to announce the dialog role and its accessible name (from `aria-labelledby`) immediately.
- When `describedById` is set, the referenced description text is announced immediately after the accessible name.
- The close button carries `aria-label="Close dialog"` so it reads as "Close dialog, button" rather than the SVG icon content. Clicking the close-X fires `ondismiss`.
