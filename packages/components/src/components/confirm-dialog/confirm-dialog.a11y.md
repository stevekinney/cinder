# ConfirmDialog Accessibility

## Role Inheritance

`ConfirmDialog` has no own `role`. It inherits `role="dialog"` and `aria-modal="true"` from the underlying `<Modal>`. The `dialog` role is used intentionally — not `alertdialog`. `alertdialog` is reserved for assertive, time-sensitive interruptions (system errors, process failures); user-initiated confirmation prompts are non-urgent. Consumers who need `alertdialog` for a confirm triggered by an out-of-band system event should compose `<Modal>` directly.

## ARIA Attributes

- **`aria-labelledby`**: Inherited from `<Modal>`; points at the `<h2>` title element. The title is the confirm dialog's accessible name, announced when the dialog opens.
- **`aria-describedby`**: When `description` is provided, `<dialog>` gets `aria-describedby` referencing the `<p>` in the modal body. Screen readers announce the description immediately after the title on open. When `description` is omitted, no `aria-describedby` is set — the attribute is never emitted as an empty string.

**Description constraint**: `aria-describedby` works best with short, plain text. Screen readers announce the entire referenced text as one continuous run — a paragraph plus a list would be announced as an unbroken blob. For rich body content (markup, lists, multiple paragraphs), compose `<Modal>` + `<Button>` directly instead.

## Default Focus

The cancel button carries the `autofocus` attribute. When the dialog opens, `<Modal>` detects the `[autofocus]` child and defers its body-container fallback, letting the browser move focus to the cancel button.

This is the industry-standard guard against accidental destructive confirms:

- macOS NSAlert defaults focus to the non-destructive button.
- GNOME HIG and APG's confirmation pattern example both default to cancel.
- [WCAG 3.2.1](https://www.w3.org/WAI/WCAG22/Understanding/on-focus.html) is satisfied—focus is moved by the dialog opening, not by user input.

The confirm button never carries `autofocus`. `ConfirmDialog` exposes no prop to change the default focus target — consumers who need a different focus default should compose `<Modal>` + `<Button>` directly.

**Color is never the sole destructive signal.** `destructive={true}` changes the confirm button to `variant="danger"`. The cancel button still receives default focus. The `confirmLabel` prop is required so consumers must name the action being confirmed ("Delete account", "Discard changes")—generic labels like "OK" or "Confirm" are explicitly disallowed.

## Keyboard Interactions

| Key                     | Behaviour                                                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Tab / Shift+Tab         | Cycles focus through focusable elements inside the dialog. Focus trap is inherited from `<Modal>` via native `<dialog>.showModal()`. |
| Escape                  | Closes the dialog and fires `oncancel` via Modal's native `cancel` event handler.                                                    |
| Enter on cancel button  | Dismisses without confirming.                                                                                                        |
| Enter on confirm button | Confirms the action and closes the dialog.                                                                                           |

## Cancellation Paths

`oncancel` fires on all four user-initiated dismissal paths:

1. **Cancel button click** (button owned by `ConfirmDialog`).
2. **Escape key** — via the native `cancel` event on `<dialog>`, routed through Modal's `ondismiss`.
3. **Backdrop click** — routed through Modal's `ondismiss`.
4. **Close-X button** — routed through Modal's `ondismiss`.

Parent-driven `open = false` does **not** fire `oncancel`.

## Focus Return

Inherited from `<Modal>`. When the dialog closes, focus is restored to `triggerRef` if provided, otherwise to the element that held focus when the dialog opened.

## Screen Reader Announcements

On open, supporting screen readers announce:

1. The dialog role (`dialog`).
2. The accessible name (from `aria-labelledby`, the title).
3. When `description` is provided: the description text (from `aria-describedby`).

## Label Guidelines

`confirmLabel` is required. The component is scoped to action confirmation; making the label required forces consumers to name the specific action rather than ship a generic affirmative:

- **Destructive**: "Delete", "Delete account", "Discard changes", "Remove from organization".
- **Non-destructive**: "Save", "Save changes", "Continue", "Publish".
- **Never in production**: "OK", "Confirm", "Yes" — these don't communicate what will happen.

If a truly generic affirmative is required, compose `<Modal>` + `<Button>` directly.
