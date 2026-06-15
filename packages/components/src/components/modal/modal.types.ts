import type { Snippet } from 'svelte';

type ModalSharedProps = {
  /** Controls whether the modal is open; bindable for controlled usage. */
  open: boolean;
  /** Text rendered as the modal's visible heading and used as its accessible label. */
  title: string;
  /** When true, clicking the backdrop outside the modal panel dismisses it. Default `true`. */
  dismissOnBackdropClick?: boolean;
  /** When true, pressing Escape dismisses the modal. Default `true`. */
  dismissOnEscape?: boolean;
  /** When true, renders the close button in the upper corner of the modal panel. Default `true`. */
  showCloseButton?: boolean;
  /** Additional class names merged with the component's root class. */
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
  /** ARIA role applied to the underlying dialog element. Default `dialog`. */
  role?: 'dialog';
  /** When set, applied as aria-describedby on the underlying <dialog>. Pass a short, plain description ID only. */
  describedById?: string;
};

type AlertDialogModalProps = ModalSharedProps & {
  /** ARIA role applied to the underlying dialog element. Use `alertdialog` for urgent prompts that cannot be dismissed without an explicit action. */
  role: 'alertdialog';
  /** Required for alertdialog so assistive technology receives the urgent condition and required action. */
  describedById: string;
};

export type ModalProps = DialogModalProps | AlertDialogModalProps;
