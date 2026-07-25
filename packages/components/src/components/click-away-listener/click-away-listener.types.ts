import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

/**
 * Props for the ClickAwayListener component.
 *
 * A headless utility that fires `onClickAway` when the user presses a pointer
 * (mouse or touch) outside the component's root element. Useful for closing
 * inline-edit fields, custom dropdowns, or any overlay that should dismiss on
 * outside interaction without requiring a full Popover or Modal.
 */
export type ClickAwayListenerProps = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
  /**
   * Called with the triggering PointerEvent (or MouseEvent/TouchEvent on
   * browsers that do not support the Pointer Events API) when the user presses
   * a pointer device outside the root element.
   */
  onClickAway: (event: PointerEvent | MouseEvent | TouchEvent) => void;
  /**
   * When false the document listener is detached and `onClickAway` is never
   * called. Defaults to `true`.
   */
  enabled?: boolean;
  /** Content rendered inside the root element. Required. */
  children: Snippet;
  /** Additional class names merged with the root element. */
  class?: string;
};
