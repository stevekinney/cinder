import type { Snippet } from 'svelte';
import type { HTMLButtonAttributes } from 'svelte/elements';

/**
 * Props for the CopyButton component.
 *
 * Copies `value` to the clipboard when clicked and renders a brief
 * confirmation state. The `children` snippet defines the button label;
 * `confirmation` is rendered while the copied state is active.
 *
 * Extends `HTMLButtonAttributes` (minus `class`) so consumers can pass
 * any native button attribute — `id`, `data-*`, `form`, etc. The component
 * owns `aria-label`, `aria-live`, `onclick`, and `type` (always `"button"`,
 * never a form submitter): these are Omit-ted so a consumer-supplied value is
 * a compile error rather than being silently overridden at runtime (the
 * component drives the copied-state announcement and clipboard handler
 * itself). `data-cinder-copied` is also owned but is a `data-*` attribute that
 * can't be expressed in the Omit, so it's overridden by spread ordering.
 */
export type CopyButtonProps = Omit<
  HTMLButtonAttributes,
  'class' | 'aria-label' | 'aria-live' | 'onclick' | 'type'
> & {
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
