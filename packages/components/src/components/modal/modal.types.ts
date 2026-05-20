import type { Snippet } from 'svelte';
export type ModalProps = {
  open: boolean;
  title: string;
  class?: string;
  children: Snippet;
  footer?: Snippet;
  triggerRef?: HTMLElement | null;
  /** When set, applied as aria-describedby on the underlying <dialog>. Pass a short, plain description ID only. */
  describedById?: string;
  /**
   * Fired on user-initiated dismissal. Includes: Escape key (native dialog 'cancel' event),
   * backdrop click, and the close-X button. EXCLUDES: parent-driven open = false.
   * Callbacks are not awaited and thrown callbacks do not block close.
   */
  ondismiss?: () => void;
};
