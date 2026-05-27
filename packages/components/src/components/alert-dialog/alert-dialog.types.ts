export type AlertDialogProps = {
  open: boolean;
  title: string;
  description: string;
  acknowledgeLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onacknowledge: () => void;
  oncancel?: () => void;
  triggerRef?: HTMLElement | null;
  class?: string;
};
