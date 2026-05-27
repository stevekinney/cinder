import type { Snippet } from 'svelte';

/**
 * @schemaObject
 */
export type ContextMenuAnchorPoint = {
  x: number;
  y: number;
};

export type ContextMenuProps = {
  open?: boolean;
  onopenchange?: (open: boolean) => void;
  anchorPoint?: ContextMenuAnchorPoint | undefined;
  disabled?: boolean;
  longPressDelay?: number;
  children: Snippet;
  class?: string;
};
