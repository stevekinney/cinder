import type { DialogCancelProps } from '../../utilities/dialog-props.ts';

/**
 * Cancel semantics (shared vocabulary from {@link DialogCancelProps}):
 * when `cancelLabel` is omitted, NO cancel button is rendered — an alert
 * dialog's default shape is a single acknowledgement.
 */
export type AlertDialogProps = Omit<DialogCancelProps, 'cancelLabel'> & {
  /**
   * Label for the cancel button. When omitted, NO cancel button is rendered —
   * an alert dialog's default shape is a single acknowledgement.
   */
  cancelLabel?: string;
  /** Controls whether the alert dialog is open; bindable for controlled usage. */
  open: boolean;
  /** Text rendered as the dialog's visible heading and accessible label. */
  title: string;
  /** Explanatory paragraph displayed in the dialog body and wired to the dialog via aria-describedby. */
  description: string;
  /** Label for the primary acknowledgement button. Default `OK`. */
  acknowledgeLabel?: string;
  /** When true, styles the acknowledgement button as a danger action and, when a cancel button is rendered, gives it initial focus instead of the acknowledgement button. Default `false`. */
  destructive?: boolean;
  onAcknowledge: () => void;
  triggerRef?: HTMLElement | null;
  /** Additional class names merged with the component's root class. */
  class?: string;
};
