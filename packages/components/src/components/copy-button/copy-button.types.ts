import type { Snippet } from 'svelte';
/**
 * Props for the CopyButton component.
 *
 * Copies `value` to the clipboard when clicked and renders a brief
 * confirmation state. The `children` snippet defines the button label;
 * `confirmation` is rendered while the copied state is active.
 */
export type CopyButtonProps = {
  /** Text to copy to the clipboard. */
  value: string;
  /** Duration in ms to show the confirmation state. Default 1500. */
  confirmDuration?: number;
  /** Accessible label for the idle state. Defaults to "Copy to clipboard". */
  label?: string;
  /** Accessible label for the copied state — what `aria-live="polite"` announces
   * when the copy succeeds. Defaults to "Copied". Override this when `label` is
   * customized so the live-region announcement reflects what just happened
   * (e.g. label="Copy code" + copiedLabel="Code copied"). */
  copiedLabel?: string;
  /** Render the button with only an icon and a visually hidden label.
   * When true, defaults to a Copy icon (idle) and a Check icon (copied). */
  iconOnly?: boolean;
  /** Additional class names merged with `.cinder-copy-button`. */
  class?: string;
  /** Default content (idle state). */
  children?: Snippet;
  /** Content rendered while in the "copied" state. */
  confirmation?: Snippet;
};
