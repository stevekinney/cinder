import type { Snippet } from 'svelte';

/**
 * @schemaObject
 */
export type ContextMenuAnchorPoint = {
  x: number;
  y: number;
};

export type ContextMenuProps = {
  /** Controls the open state of the context menu; bindable for controlled usage. */
  open?: boolean;
  onopenchange?: (open: boolean) => void;
  /** Explicit pointer coordinates at which to anchor the menu, overriding the position captured from the right-click or long-press event. */
  anchorPoint?: ContextMenuAnchorPoint | undefined;
  /** When true, disables context-menu activation on right-click and long-press within the trigger region. Default `false`. */
  disabled?: boolean;
  /** Duration in milliseconds a touch pointer must be held before the menu opens on mobile. Default `500`. */
  longPressDelay?: number;
  children: Snippet;
  /** Additional class names merged with the component's root class. */
  class?: string;
};
