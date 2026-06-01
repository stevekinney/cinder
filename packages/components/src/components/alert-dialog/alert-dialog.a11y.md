# AlertDialog Accessibility

## Dialog model

AlertDialog is a sticky blocking overlay. See [`Modal`](../modal/modal.a11y.md) for the general dialog accessibility contract; this document covers only what AlertDialog adds or restricts.

## ARIA Role

AlertDialog renders `<Modal role="alertdialog">`. The `alertdialog` role signals to assistive technology that the dialog:

- Contains an urgent, time-sensitive, or high-consequence message.
- Requires explicit user response before the session can continue.
- Should be announced immediately by screen readers on open, with higher assertiveness than `role="dialog"`.

Do not use `alertdialog` for ordinary user-initiated confirm/cancel prompts — use [`ConfirmDialog`](../confirm-dialog/confirm-dialog.a11y.md). Overusing `alertdialog` trains users and assistive technology to ignore it.

## `aria-describedby`

`description` is required on AlertDialog. It is rendered as a `<p>` in the modal body, and the dialog's `aria-describedby` is wired to that paragraph's `id`. This is required for `alertdialog` — assistive technology uses `aria-describedby` to announce the urgent condition and required action when the dialog opens.

Keep `description` short and plain. Screen readers announce the entire `aria-describedby` target as one continuous run; a description containing nested markup, lists, or multiple sentences will be announced as an unbroken blob.

If the urgent message requires rich body content, compose [`Modal`](../modal/README.md) with `role="alertdialog"` directly (and supply `describedById` pointing at a concise summary paragraph in the body).

## Dismissal model

AlertDialog passes the following to Modal:

```
dismissOnBackdropClick={false}
dismissOnEscape={false}
showCloseButton={false}
```

This is intentional. An `alertdialog` represents a condition the user must acknowledge; Escape, backdrop click, and a close-X would all let the user bypass acknowledgement — incorrect for the `alertdialog` contract.

The only dismissal paths are:

1. **Acknowledge button** — closes the dialog and fires `onacknowledge`.
2. **Cancel button** (optional, appears when `cancelLabel` is set) — closes the dialog and fires `oncancel`.

There is no Escape, no backdrop dismiss, no close-X.

## Default Focus

When `cancelLabel` is absent (acknowledge-only mode), the acknowledge button carries `autofocus`. When both buttons are present _and_ `destructive={true}`, the cancel button carries `autofocus` — the same conservative guard ConfirmDialog uses. In the non-destructive two-button variant, the acknowledge button gets autofocus.

| Mode                                   | Autofocus target   |
| -------------------------------------- | ------------------ |
| Acknowledge-only                       | Acknowledge button |
| Cancel + acknowledge (non-destructive) | Acknowledge button |
| Cancel + acknowledge (destructive)     | Cancel button      |

## Keyboard Interactions

| Key                          | Behaviour                                                                                                                                       |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Tab                          | Cycles focus through the action buttons (and any other focusable elements in the body). Focus trap inherited from Modal's native `showModal()`. |
| Shift + Tab                  | Cycles focus backward.                                                                                                                          |
| Escape                       | **Blocked.** `dismissOnEscape={false}` means the native `cancel` event is prevented and `open` stays true.                                      |
| Enter / Space on acknowledge | Fires `onacknowledge` and closes.                                                                                                               |
| Enter / Space on cancel      | Fires `oncancel` and closes (when cancel button is rendered).                                                                                   |

## Screen Reader Announcements

On open, supporting screen readers announce:

1. The `alertdialog` role (typically with higher assertiveness than `dialog`).
2. The accessible name from `aria-labelledby` (the title).
3. The description from `aria-describedby` (the `description` prop text).

## Focus Return

Inherited from `<Modal>`. When the dialog closes, focus returns to `triggerRef` if provided, otherwise to the element that held focus when the dialog opened.

## Label Guidelines

`acknowledgeLabel` defaults to "OK" but should be overridden in production to describe the action: "Sign in", "I understand", "Delete workspace". Generic labels are acceptable for truly generic acknowledgements (e.g. a session-expiry notice where "OK" or "Sign in" conveys all necessary intent), but action-specific labels are always clearer.

`cancelLabel` is optional. Only supply it when a genuine alternative action is meaningful — for example, a destructive alert that offers "Cancel" as a way to abort before proceeding.
