export type AlertDialogProps = {
  /** Controls whether the alert dialog is open; bindable for controlled usage. */
  open: boolean;
  /** Text rendered as the dialog's visible heading and accessible label. */
  title: string;
  /** Explanatory paragraph displayed in the dialog body and wired to the dialog via aria-describedby. */
  description: string;
  /** Label for the primary acknowledgement button. Default `OK`. */
  acknowledgeLabel?: string;
  /** Label for the optional cancel button. When omitted, no cancel button is rendered. */
  cancelLabel?: string;
  /** When true, styles the acknowledgement button as a danger action and, when a cancel button is rendered, gives it initial focus instead of the acknowledgement button. Default `false`. */
  destructive?: boolean;
  onacknowledge: () => void;
  oncancel?: () => void;
  triggerRef?: HTMLElement | null;
  /** Additional class names merged with the component's root class. */
  class?: string;
};
