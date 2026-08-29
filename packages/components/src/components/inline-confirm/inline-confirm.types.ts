import type { Snippet } from 'svelte';

export type InlineConfirmProps = {
  prompt: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  open?: boolean;
  children?: Snippet;
  onConfirm?: () => void;
  onCancel?: () => void;
  class?: string;
};
