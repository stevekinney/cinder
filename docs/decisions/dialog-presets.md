# Dialog preset boundary

Decision: preserve `Modal`, `ConfirmDialog`, and `AlertDialog` as separate
public entries. The latter two are intentionally opinionated presets over the
Modal primitive, not duplicate shells.

- **Modal** is the nearest alternative when content is rich, has more than two
  actions, or needs custom focus and dismissal policy. It owns the generic
  modal lifecycle: focus capture/restore, native dialog top-layer semantics,
  body scroll lock, optional Escape/backdrop dismissal, and close button.
- **ConfirmDialog** is the nearest alternative for a user-initiated binary
  decision. It acknowledges the user's action with explicit confirm/cancel
  buttons, defaults focus to cancel, and routes Escape, backdrop, and close-X
  to `onCancel`. It must remain safely dismissible because the user initiated
  the interruption.
- **AlertDialog** is the nearest alternative for system-initiated urgent
  acknowledgement. It uses `role="alertdialog"`, requires a concise
  description, disables Escape/backdrop/close-X dismissal, and can close only
  through an explicit action: acknowledgement, or the preset's explicit cancel
  alternative when `cancelLabel` is supplied. Use Modal with
  `role="alertdialog"` only when richer body composition is required and the
  same dismissal restrictions are supplied.

All three preserve native dialog focus trapping, keyboard behavior, dismissal
events, and ARIA naming/description contracts. Do not fold the presets into
Modal variants: doing so would turn acknowledgement policy into a collection
of booleans and make it easier to accidentally weaken the urgent blocking
contract. New dialog APIs must choose one of these boundaries and retain the
existing keyboard, focus, dismissal, and ARIA tests.
