import type { Snippet } from 'svelte';

export type InlineConfirmProps = {
  /** Confirmation prompt text. */
  prompt: string;
  /** Label for the confirming action. */
  confirmLabel: string;
  /** Label for the cancelling action. Defaults to `'Cancel'`. @default 'Cancel' */
  cancelLabel?: string;
  /** Marks the confirming action as destructive. Defaults to `false`. @default false */
  destructive?: boolean;
  /**
   * Whether the confirmation is open. Bindable, and component-owned on
   * close: confirming, clicking Cancel, and pressing Escape all set this
   * to `false` before calling `onConfirm`/`onCancel`, so a bound parent
   * observes the confirmation as already closed by the time either
   * callback runs—neither callback can veto or delay that close. Defaults
   * to `false`.
   * @default false
   */
  open?: boolean;
  /** Additional content rendered below the prompt, above the confirm/cancel actions, while the confirmation is open. */
  children?: Snippet;
  /** Called when the user confirms the action, after `open` is already set to `false`. */
  onConfirm?: () => void;
  /** Called when the user cancels the action (via the Cancel action or Escape), after `open` is already set to `false`. */
  onCancel?: () => void;
  /** Additional class merged with the component's root class. */
  class?: string;
};
