/**
 * A thin opinionated preset over `<Modal>` for destructive-action confirmations.
 *
 * Composes `<Modal>` + two `<Button>`s. Does not open its own `<dialog>` or manage
 * its own focus trap — all of that is owned by `<Modal>`.
 *
 * Default focus lands on the **cancel** button (`autofocus`) — the industry-standard
 * guard against accidental destructive confirms.
 *
 * For richer body content (markup, lists, multi-paragraph text), compose `<Modal>` +
 * `<Button>` directly. `aria-describedby` works best with short, plain-text descriptions.
 */
export type ConfirmDialogProps = {
  /** Controls visibility. Bindable. */
  open: boolean;
  /** Modal title; passed through to <Modal>. */
  title: string;
  /**
   * Optional body description — short, plain text only. Rendered as a single <p> and wired
   * to aria-describedby. For rich content (markup, lists, multiple paragraphs), compose
   * <Modal> + <Button> directly — screen readers announce aria-describedby targets as one
   * continuous run.
   */
  description?: string;
  /** Cancel button label. Defaults to "Cancel". */
  cancelLabel?: string;
  /**
   * Confirm button label. Required — no default. Name the action being confirmed:
   * - Destructive: "Delete", "Discard changes", "Remove from organization".
   * - Non-destructive: "Save", "Continue", "Publish".
   * Never use "OK" or "Confirm" in production — they don't describe the action.
   */
  confirmLabel: string;
  /**
   * When true, the confirm button uses variant="danger". The cancel button still
   * receives default focus regardless — color is never the sole destructive signal.
   */
  destructive?: boolean;
  /** Fired when the user activates the confirm button. Required. Component closes itself after. */
  onconfirm: () => void;
  /**
   * Fired when the user cancels via ANY dismissal affordance — cancel button, Escape,
   * backdrop click, or the close-X button. Optional.
   * Parent-driven `open = false` does NOT fire this callback.
   * Callbacks are not awaited; thrown callbacks do not block close.
   */
  oncancel?: () => void;
  /** Forwarded to <Modal>; focus is restored here on close. */
  triggerRef?: HTMLElement | null;
  /** Optional extra class on the underlying <Modal>. Destructured as `class: className` per repo convention. */
  class?: string;
};
