import type { Snippet } from 'svelte';

type ModalSharedProps = {
  open: boolean;
  title: string;
  dismissOnBackdropClick?: boolean;
  dismissOnEscape?: boolean;
  showCloseButton?: boolean;
  class?: string;
  children: Snippet;
  footer?: Snippet;
  triggerRef?: HTMLElement | null;
  /**
   * Fired on user-initiated dismissal. Includes: Escape key (native dialog 'cancel' event),
   * backdrop click, and the close-X button. EXCLUDES: parent-driven open = false.
   * Callbacks are not awaited and thrown callbacks do not block close.
   */
  ondismiss?: () => void;
};

type DialogModalProps = ModalSharedProps & {
  role?: 'dialog';
  /** When set, applied as aria-describedby on the underlying <dialog>. Pass a short, plain description ID only. */
  describedById?: string;
};

type AlertDialogModalProps = ModalSharedProps & {
  role: 'alertdialog';
  /** Required for alertdialog so assistive technology receives the urgent condition and required action. */
  describedById: string;
};

export type ModalProps = DialogModalProps | AlertDialogModalProps;
